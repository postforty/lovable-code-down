/**
 * Lovable Code Downloader - Injected Script (v1.1.2, Main World Context)
 * 1. Hooks navigator.clipboard & copy event to intercept "Copy file content" button.
 * 2. Scans CodeMirror 6 / Monaco Editor state buffers directly (100% loss-free).
 * 3. Scans React Query / TanStack Query cache for full project files.
 */

(function () {
  if (window.__LOVABLE_INJECTED_READY__) return;
  window.__LOVABLE_INJECTED_READY__ = true;

  console.log("⚡ Lovable Injected Script (v1.1.2) active in Main World.");

  let latestDownloadedText = null;
  let latestDownloadedBlob = null;
  let latestCopiedText = null;
  let interceptActive = false;

  // 1. Hook navigator.clipboard.writeText
  if (navigator.clipboard) {
    const originalWriteText = navigator.clipboard.writeText;
    navigator.clipboard.writeText = function (text) {
      if (interceptActive) {
        latestCopiedText = text;
        return Promise.resolve();
      }
      return originalWriteText.apply(this, arguments);
    };
  }

  // 2. Hook document 'copy' event fallback
  document.addEventListener(
    "copy",
    function (e) {
      if (interceptActive) {
        try {
          const selection = window.getSelection()?.toString();
          if (selection && selection.length > 5) {
            latestCopiedText = selection;
          }
        } catch (_) {}
      }
    },
    true
  );

  // 3. Hook URL.createObjectURL
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

  // 4. Hook HTMLAnchorElement.prototype.click
  const originalAnchorClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (interceptActive && this.download) {
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

      const downloadBtn = Array.from(document.querySelectorAll("button")).find(
        (b) =>
          b.getAttribute("aria-label") === "Download" ||
          b.textContent.includes("Download") ||
          b.textContent.includes("다운로드")
      );

      if (downloadBtn) {
        downloadBtn.click();
      }

      let waitMs = 400;
      while (waitMs > 0 && !latestDownloadedText) {
        await new Promise((r) => setTimeout(r, 40));
        waitMs -= 40;
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

    // C. Intercept "Copy file content" button click
    if (event.data.type === "LCD_REQUEST_COPY_INTERCEPT") {
      interceptActive = true;
      latestCopiedText = null;

      // Exact targeting: Try finding by aria-label first
      let copyBtn = document.querySelector("button[aria-label='Copy file content'], button[aria-label='Copy'], button[title='Copy']");

      // Fallback: look for a button with a copy SVG (typical lucide-react copy icon)
      if (!copyBtn) {
        const buttons = document.querySelectorAll("button");
        for (const b of buttons) {
          const svg = b.querySelector("svg");
          if (svg && svg.innerHTML.includes("rect") && (svg.innerHTML.includes("x=\"9\"") || svg.innerHTML.includes("x=\"8\"")) && svg.innerHTML.includes("path")) {
            // Found a button with overlapping rectangles/paths resembling a copy icon
            copyBtn = b;
            break;
          }
        }
      }

      if (copyBtn) {
        copyBtn.click();
      } else {
        console.warn("[Lovable Code Downloader] 복사 버튼을 찾을 수 없습니다.");
      }

      // Wait for clipboard API / copy event to be triggered
      let waitMs = 450;
      while (waitMs > 0 && !latestCopiedText) {
        await new Promise((r) => setTimeout(r, 25));
        waitMs -= 25;
      }

      interceptActive = false;

      window.postMessage(
        {
          type: "LCD_RESPONSE_COPY_INTERCEPT",
          reqId: event.data.reqId,
          code: latestCopiedText,
        },
        "*"
      );
    }

    // D. Active File Code Extraction (CodeMirror 6 / Monaco / Fiber)
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

  // Extract full code directly from CodeMirror 6, Monaco, or React Fiber
  function getFullActiveCode(targetPath) {
    // 1. CodeMirror 6 EditorView buffer extraction
    try {
      const cmEditors = document.querySelectorAll(".cm-editor, .cm-content");
      for (const el of cmEditors) {
        if (el.cmView && el.cmView.view && el.cmView.view.state && el.cmView.view.state.doc) {
          const docStr = el.cmView.view.state.doc.toString();
          if (docStr && docStr.trim().length > 0) return docStr;
        }
        let p = el;
        for (let i = 0; i < 6 && p; i++) {
          if (p.cmView && p.cmView.view && p.cmView.view.state && p.cmView.view.state.doc) {
            const docStr = p.cmView.view.state.doc.toString();
            if (docStr && docStr.trim().length > 0) return docStr;
          }
          p = p.parentElement;
        }
      }
    } catch (_) {}

    // 2. Monaco Editor models
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

    // 3. React Fiber on code editor containers
    try {
      const editorEls = [
        document.querySelector(".cm-editor"),
        document.querySelector(".code-editor-wrapper"),
        document.querySelector(".monaco-editor"),
      ].filter(Boolean);

      for (const el of editorEls) {
        const fiberKey = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
        if (fiberKey) {
          let fiber = el[fiberKey];
          for (let i = 0; i < 25 && fiber; i++) {
            const props = fiber.memoizedProps;
            if (props) {
              if (typeof props.code === "string" && props.code.length > 5) return props.code;
              if (typeof props.content === "string" && props.content.length > 5) return props.content;
              if (props.file && typeof props.file.content === "string" && props.file.content.length > 5) {
                return props.file.content;
              }
              if (props.value && typeof props.value === "string" && props.value.length > 5) return props.value;
              if (props.editor && props.editor.getValue) return props.editor.getValue();
            }
            fiber = fiber.return;
          }
        }
      }
    } catch (_) {}

    return null;
  }

  // Scan React Query / TanStack Query Cache and Root Fiber
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
          if (found && validateProjectFiles(found)) {
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
              if (res && validateProjectFiles(res)) return res;
            }
          }
        } catch (_) {}
      }

      // Check Zustand / Redux
      if (obj.getState && typeof obj.getState === "function") {
        try {
          const state = obj.getState();
          const res = checkObjectForFiles(state);
          if (res && validateProjectFiles(res)) return res;
        } catch (_) {}
      }

      const res = checkObjectForFiles(obj);
      if (res && validateProjectFiles(res)) return res;
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

  function validateProjectFiles(files) {
    if (!files || typeof files !== "object") return false;
    const paths = Object.keys(files);
    if (paths.length < 4) return false;

    const hasCoreFiles = paths.some(
      (p) =>
        p.includes("package.json") ||
        p.includes("index.html") ||
        p.includes("src/") ||
        p.includes("vite.config") ||
        p.includes("components.json")
    );

    let validContentCount = 0;
    for (const p of paths) {
      const content = files[p];
      if (typeof content === "string" && content.trim().length > 0) {
        validContentCount++;
      }
    }

    return hasCoreFiles && validContentCount >= 4;
  }

  function checkObjectForFiles(obj) {
    if (!obj || typeof obj !== "object") return null;

    const keys = Object.keys(obj);
    const codeExts = /\.(tsx|ts|js|jsx|json|css|html|md|toml|lock|gitignore|prettierrc|config\..*)$/i;
    const fileKeys = keys.filter((k) => codeExts.test(k) || k.includes("/"));

    if (fileKeys.length >= 4) {
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
      if (validCount >= 4) return result;
    }

    const nested = ["files", "projectFiles", "fileTree", "fileMap", "sources", "documents", "project", "data"];
    for (const key of nested) {
      if (obj[key] && typeof obj[key] === "object") {
        const r = checkObjectForFiles(obj[key]);
        if (r && validateProjectFiles(r)) return r;
      }
    }

    return null;
  }
})();
