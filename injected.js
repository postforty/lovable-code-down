/**
 * Lovable Code Downloader - Injected Script (v1.0.8)
 * 1. Hooks URL.createObjectURL and HTMLAnchorElement.prototype.click to intercept official Lovable downloads.
 * 2. Scans React Query / TanStack Query cache for full project files.
 * 3. Accesses Monaco Editor instances and React Fiber models.
 */

(function () {
  if (window.__LOVABLE_INJECTED_READY__) return;
  window.__LOVABLE_INJECTED_READY__ = true;

  console.log("⚡ Lovable Injected Script active.");

  let latestDownloadedText = null;
  let latestDownloadedBlob = null;
  let interceptActive = false;

  // 1. Hook URL.createObjectURL to intercept Blobs created by Lovable's Download button
  const originalCreateObjectURL = URL.createObjectURL;
  URL.createObjectURL = function (obj) {
    if (interceptActive && obj instanceof Blob) {
      latestDownloadedBlob = obj;
      obj.text().then((txt) => {
        latestDownloadedText = txt;
      });
    }
    return originalCreateObjectURL.apply(this, arguments);
  };

  // 2. Hook HTMLAnchorElement.prototype.click to suppress individual file download popups during extraction
  const originalAnchorClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (interceptActive && this.download) {
      // Suppress individual download while we capture it
      return;
    }
    return originalAnchorClick.apply(this, arguments);
  };

  // Listen for messages from Content Script
  window.addEventListener("message", async (event) => {
    if (!event.data) return;

    // A. Intercept Lovable's official Download button click
    if (event.data.type === "LCD_INTERCEPT_DOWNLOAD_CLICK") {
      interceptActive = true;
      latestDownloadedText = null;
      latestDownloadedBlob = null;

      // Click the official Download button in page
      const downloadBtn = Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent.includes("Download") || b.textContent.includes("다운로드")
      );

      if (downloadBtn) {
        downloadBtn.click();
      }

      // Wait briefly for Blob creation
      let waitMs = 300;
      while (waitMs > 0 && !latestDownloadedText) {
        await new Promise((r) => setTimeout(r, 50));
        waitMs -= 50;
      }

      interceptActive = false;

      window.postMessage(
        {
          type: "LCD_RESPONSE_INTERCEPT_DOWNLOAD",
          reqId: event.data.reqId,
          content: latestDownloadedText,
        },
        "*"
      );
    }

    // B. Bulk State Extraction
    if (event.data.type === "LCD_REQUEST_STATE_EXTRACTION") {
      const files = await extractFullProjectFromReactState();
      window.postMessage(
        {
          type: "LCD_RESPONSE_STATE_EXTRACTION",
          files: files,
        },
        "*"
      );
    }

    // C. Active File Code Extraction (Monaco / Fiber)
    if (event.data.type === "LCD_REQUEST_ACTIVE_CODE") {
      const code = getFullActiveCode(event.data.filePath);
      window.postMessage(
        {
          type: "LCD_RESPONSE_ACTIVE_CODE",
          reqId: event.data.reqId,
          code: code,
        },
        "*"
      );
    }
  });

  // Extract full code using Monaco API or React Fiber
  function getFullActiveCode(targetPath) {
    // 1. Check window.monaco
    try {
      if (window.monaco && window.monaco.editor && window.monaco.editor.getModels) {
        const models = window.monaco.editor.getModels();
        if (models && models.length > 0) {
          if (targetPath) {
            const m = models.find((mod) => {
              const p = mod.uri ? mod.uri.path || mod.uri.fsPath || "" : "";
              return p.endsWith(targetPath) || targetPath.endsWith(p.replace(/^\//, ""));
            });
            if (m && m.getValue) {
              const val = m.getValue();
              if (val && val.length > 0) return val;
            }
          }
          const last = models[models.length - 1];
          if (last && last.getValue) return last.getValue();
        }
      }
    } catch (_) {}

    // 2. Check React Fiber on code editor containers
    const editorEls = [
      document.querySelector(".code-editor-wrapper"),
      document.querySelector(".monaco-editor"),
      document.querySelector("main"),
    ].filter(Boolean);

    for (const el of editorEls) {
      const fiberKey = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
      if (fiberKey) {
        let fiber = el[fiberKey];
        for (let i = 0; i < 25 && fiber; i++) {
          const props = fiber.memoizedProps;
          if (props) {
            if (typeof props.code === "string" && props.code.length > 10) return props.code;
            if (typeof props.content === "string" && props.content.length > 10) return props.content;
            if (props.file && typeof props.file.content === "string") return props.file.content;
            if (props.editor && props.editor.getValue) return props.editor.getValue();
          }
          fiber = fiber.return;
        }
      }
    }

    return null;
  }

  // Scan React Query / TanStack Query Cache and Root Fiber for full project
  async function extractFullProjectFromReactState() {
    const files = {};

    try {
      const rootEl = document.querySelector("#root") || document.querySelector("body > div");
      if (rootEl) {
        const fiberKey = Object.keys(rootEl).find(
          (k) => k.startsWith("__reactFiber$") || k.startsWith("__reactContainer$")
        );
        if (fiberKey) {
          const rootFiber = rootEl[fiberKey];
          const found = scanFiberForFiles(rootFiber, new Set(), 0);
          if (found && Object.keys(found).length >= 3) {
            Object.assign(files, found);
          }
        }
      }
    } catch (_) {}

    return Object.keys(files).length > 0 ? files : null;
  }

  function scanFiberForFiles(fiber, visited, depth) {
    if (!fiber || depth > 30 || visited.has(fiber)) return null;
    visited.add(fiber);

    const candidates = [fiber.memoizedProps, fiber.memoizedState, fiber.stateNode];

    for (const obj of candidates) {
      if (!obj || typeof obj !== "object") continue;

      // Check TanStack Query
      if (obj.getQueryCache && typeof obj.getQueryCache === "function") {
        try {
          const queries = obj.getQueryCache().getAll();
          for (const q of queries) {
            if (q.state && q.state.data) {
              const res = checkObjectForFiles(q.state.data);
              if (res && Object.keys(res).length >= 3) return res;
            }
          }
        } catch (_) {}
      }

      // Check Zustand / Redux
      if (obj.getState && typeof obj.getState === "function") {
        try {
          const state = obj.getState();
          const res = checkObjectForFiles(state);
          if (res && Object.keys(res).length >= 3) return res;
        } catch (_) {}
      }

      const res = checkObjectForFiles(obj);
      if (res && Object.keys(res).length >= 3) return res;
    }

    if (fiber.child) {
      const r = scanFiberForFiles(fiber.child, visited, depth + 1);
      if (r) return r;
    }
    if (fiber.sibling) {
      const r = scanFiberForFiles(fiber.sibling, visited, depth + 1);
      if (r) return r;
    }

    return null;
  }

  function checkObjectForFiles(obj) {
    if (!obj || typeof obj !== "object") return null;

    const keys = Object.keys(obj);
    const codeExts = /\.(tsx|ts|js|jsx|json|css|html|md|toml|lock|gitignore|prettier.*)$/i;
    const fileKeys = keys.filter((k) => codeExts.test(k) || k.includes("/"));

    if (fileKeys.length >= 3) {
      const result = {};
      let validCount = 0;
      for (const k of fileKeys) {
        const val = obj[k];
        if (typeof val === "string") {
          result[k] = val;
          validCount++;
        } else if (val && typeof val.content === "string") {
          result[k] = val.content;
          validCount++;
        }
      }
      if (validCount >= 3) return result;
    }

    const nested = ["files", "projectFiles", "fileTree", "fileMap", "sources", "documents", "project", "data"];
    for (const key of nested) {
      if (obj[key] && typeof obj[key] === "object") {
        const r = checkObjectForFiles(obj[key]);
        if (r) return r;
      }
    }

    return null;
  }
})();
