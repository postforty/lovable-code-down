/**
 * Lovable Code Downloader - Injected Script (v1.2.1, Main World Context)
 * 1. Hooks navigator.clipboard & copy event to intercept editor's "Copy file content" button.
 * 2. Scans CodeMirror 6 / Monaco Editor state buffers directly (100% loss-free).
 * 3. Provides real-time active editor state queries (breadcrumb, tab, CM6 buffer) for sync verification.
 * 4. Extracts full/partial project files from React Query / TanStack Query cache & React Fiber.
 */

(function () {
  if (window.__LOVABLE_INJECTED_READY__) return;
  window.__LOVABLE_INJECTED_READY__ = true;

  console.log("⚡ Lovable Injected Script (v1.2.1) active in Main World.");

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
          if (selection && selection.length > 0) {
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

  // Helper: Find editor-scoped Copy Button (prevents clicking chat message copy buttons)
  function findEditorScopedCopyButton() {
    // 1. Document-wide query strictly for file-copy specific labels (Highest safety)
    const specificCopyBtn = document.querySelector(
      "button[aria-label='Copy file content'], button[aria-label='Copy code'], button[title='Copy file content'], button[title='Copy code'], button[aria-label='코드 복사']"
    );
    if (specificCopyBtn) return specificCopyBtn;

    // 2. Check code editor containers and their header toolbars
    const editorContainers = document.querySelectorAll(
      ".cm-editor, [data-editor], .monaco-editor, .code-viewer, [data-testid*='code'], [data-testid*='editor']"
    );

    for (const container of editorContainers) {
      let headerArea = container.parentElement;
      for (let i = 0; i < 4 && headerArea; i++) {
        const copyBtns = headerArea.querySelectorAll(
          "button[aria-label*='Copy' i], button[title*='Copy' i], button[aria-label*='복사'], button[title*='복사']"
        );
        for (const btn of copyBtns) {
          const l = (btn.getAttribute("aria-label") || btn.getAttribute("title") || "").toLowerCase();
          if (!l.includes("preview") && !l.includes("미리보기") && !l.includes("link") && !l.includes("url")) {
            return btn;
          }
        }
        headerArea = headerArea.parentElement;
      }
    }

    return null;
  }

  // Helper: Extract full CodeMirror 6 document text directly from EditorView
  function getCodeMirror6Doc() {
    try {
      const cmEditors = document.querySelectorAll(".cm-editor, .cm-content, [data-editor]");
      for (const el of cmEditors) {
        // 1. Direct cmView property
        let view = el.cmView?.view || el.parentElement?.cmView?.view;

        // 2. Scan DOM element properties
        if (!view) {
          for (const key of Object.keys(el)) {
            if (el[key]?.view?.state?.doc) {
              view = el[key].view;
              break;
            } else if (el[key]?.state?.doc) {
              view = el[key];
              break;
            }
          }
        }

        // 3. Scan React Fiber
        if (!view) {
          const fiberKey = Object.keys(el).find(
            (k) => k.startsWith("__reactFiber$") || k.startsWith("__reactContainer$")
          );
          if (fiberKey && el[fiberKey]) {
            let fiber = el[fiberKey];
            for (let i = 0; i < 20 && fiber; i++) {
              if (fiber.memoizedProps?.view?.state?.doc) {
                view = fiber.memoizedProps.view;
                break;
              }
              if (fiber.memoizedState?.view?.state?.doc) {
                view = fiber.memoizedState.view;
                break;
              }
              fiber = fiber.return;
            }
          }
        }

        if (view && view.state && view.state.doc) {
          const docStr = view.state.doc.toString();
          if (docStr !== null && docStr !== undefined) {
            return docStr;
          }
        }
      }
    } catch (_) {}
    return null;
  }

  // Helper: Query active editor metadata for synchronization
  function getActiveEditorInfo() {
    let breadcrumb = "";
    let activeTab = "";
    let docLength = 0;
    let docPreview = "";

    // 1. Breadcrumbs
    const breadcrumbEls = document.querySelectorAll(
      "[data-testid='breadcrumb'], .breadcrumb, nav[aria-label='breadcrumb'], .code-header span, header [data-filename]"
    );
    for (const b of breadcrumbEls) {
      const text = b.textContent?.trim() || "";
      if (text.length > 0) {
        breadcrumb = text;
        break;
      }
    }

    // 2. Active Tab
    const tabEl = document.querySelector(
      "[role='tab'][aria-selected='true'], [role='tab'][data-state='active'], [role='tab'].active, .tab-active"
    );
    if (tabEl) {
      activeTab = tabEl.textContent?.replace(/x$/, "").trim() || "";
    }

    // 3. CM6 doc info
    const docStr = getCodeMirror6Doc();
    if (docStr !== null && docStr !== undefined) {
      docLength = docStr.length;
      docPreview = docStr.slice(0, 80);
    }

    return { breadcrumb, activeTab, docLength, docPreview };
  }

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

    // B. Bulk State Extraction (Extracts whatever files exist in memory cache)
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

    // C. Intercept "Copy file content" button click (Scoped)
    if (event.data.type === "LCD_REQUEST_COPY_INTERCEPT") {
      interceptActive = true;
      latestCopiedText = null;

      const copyBtn = findEditorScopedCopyButton();

      if (copyBtn) {
        copyBtn.click();
        let waitMs = 450;
        while (waitMs > 0 && !latestCopiedText) {
          await new Promise((r) => setTimeout(r, 25));
          waitMs -= 25;
        }
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

    // E. Query current editor active file information
    if (event.data.type === "LCD_REQUEST_ACTIVE_FILE_INFO") {
      const info = getActiveEditorInfo();
      window.postMessage(
        {
          type: "LCD_RESPONSE_ACTIVE_FILE_INFO",
          reqId: event.data.reqId,
          info: info,
        },
        "*"
      );
    }
  });

  // Extract full code directly from CodeMirror 6, Monaco, or React Fiber
  function getFullActiveCode(targetPath) {
    // 1. CodeMirror 6 EditorView buffer extraction (Highest priority, 100% complete)
    const cmDoc = getCodeMirror6Doc();
    if (cmDoc !== null && cmDoc !== undefined && cmDoc.length > 0) {
      return cmDoc;
    }

    // 2. Monaco Editor models (Strict path matching)
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
        }
      }
    } catch (_) {}

    // 3. React Fiber on code editor containers
    try {
      const editorEls = [
        document.querySelector(".cm-editor"),
        document.querySelector(".code-editor-wrapper"),
        document.querySelector(".monaco-editor"),
        document.querySelector("[data-editor]"),
      ].filter(Boolean);

      for (const el of editorEls) {
        const fiberKey = Object.keys(el).find(
          (k) => k.startsWith("__reactFiber$") || k.startsWith("__reactContainer$")
        );
        if (fiberKey) {
          let fiber = el[fiberKey];
          for (let i = 0; i < 25 && fiber; i++) {
            const props = fiber.memoizedProps;
            if (props) {
              if (props.file && typeof props.file.content === "string" && props.file.content.length > 0) {
                const filePath = props.file.path || props.file.name || "";
                if (!targetPath || !filePath || filePath.endsWith(targetPath) || targetPath.endsWith(filePath.replace(/^\//, ""))) {
                  return props.file.content;
                }
              }
              if (typeof props.code === "string" && props.code.length > 0) return props.code;
              if (typeof props.content === "string" && props.content.length > 0) return props.content;
              if (props.value && typeof props.value === "string" && props.value.length > 0) return props.value;
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
    const allFiles = {};

    try {
      const rootEl = document.querySelector("#root") || document.querySelector("body > div");
      if (rootEl) {
        const fiberKey = Object.keys(rootEl).find(
          (k) => k.startsWith("__reactFiber$") || k.startsWith("__reactContainer$")
        );
        if (fiberKey) {
          const rootFiber = rootEl[fiberKey];
          scanFiberForFiles(rootFiber, allFiles, new Set(), 0);
        }
      }
    } catch (_) {}

    return Object.keys(allFiles).length > 0 ? allFiles : null;
  }

  function scanFiberForFiles(fiber, allFiles, visited, depth) {
    if (!fiber || depth > 30 || visited.has(fiber)) return;
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
              if (res && Object.keys(res).length > 0) {
                Object.assign(allFiles, res);
              }
            }
          }
        } catch (_) {}
      }

      // Check Zustand / Redux
      if (obj.getState && typeof obj.getState === "function") {
        try {
          const state = obj.getState();
          const res = checkObjectForFiles(state);
          if (res && Object.keys(res).length > 0) {
            Object.assign(allFiles, res);
          }
        } catch (_) {}
      }

      const res = checkObjectForFiles(obj);
      if (res && Object.keys(res).length > 0) {
        Object.assign(allFiles, res);
      }
    }

    if (fiber.child) {
      scanFiberForFiles(fiber.child, allFiles, visited, depth + 1);
    }
    if (fiber.sibling) {
      scanFiberForFiles(fiber.sibling, allFiles, visited, depth + 1);
    }
  }

  function checkObjectForFiles(obj) {
    if (!obj || typeof obj !== "object") return null;

    // Handle Array of file objects: [ { path: "src/App.tsx", content: "..." }, ... ]
    if (Array.isArray(obj)) {
      const result = {};
      for (const item of obj) {
        if (item && typeof item === "object") {
          const path = item.path || item.name || item.filePath || item.filename || item.key;
          const content = item.content || item.code || item.value || item.text || item.source;
          if (typeof path === "string" && typeof content === "string" && (path.includes(".") || path.includes("/"))) {
            result[path.replace(/^\//, "")] = content;
          }
        }
      }
      if (Object.keys(result).length >= 1) return result;
    }

    const keys = Object.keys(obj);
    const codeExts = /\.(tsx|ts|js|jsx|mjs|cjs|mts|cts|json|json5|jsonc|css|scss|sass|less|html|md|mdx|svg|toml|yaml|yml|lock|lockb|gitignore|dockerignore|prettierrc|eslintrc|stylelintrc|config\..*|prisma|graphql|gql|astro|svelte|vue|wasm|sh|bash|sql|env.*)$/i;
    const exactRootFiles = new Set([
      "Dockerfile", "Dockerfile.dev", "Dockerfile.prod", "Containerfile",
      "LICENSE", "LICENCE", "LICENSE-MIT", "LICENSE-APACHE", "LICENSE-2.0", "LICENSE.md", "LICENSE.txt",
      "UNLICENSE", "COPYING", "AUTHORS", "CONTRIBUTING", "CONTRIBUTING.md", "CHANGELOG", "CHANGELOG.md",
      "CODE_OF_CONDUCT", "CODE_OF_CONDUCT.md", "SECURITY", "SECURITY.md", "Makefile", "CNAME",
      "Procfile", "Gemfile", "Rakefile", "Brewfile", "README", "README.md", "_headers", "_redirects",
      "robots.txt", "humans.txt", "browserslist", "bun.lock", "bun.lockb", "pnpm-lock.yaml", "package-lock.json",
      "yarn.lock", "Cargo.lock", "Cargo.toml", "go.mod", "go.sum", "composer.lock", "composer.json",
      "Pipfile", "Pipfile.lock", "pyproject.toml", "requirements.txt"
    ]);

    const fileKeys = keys.filter(
      (k) =>
        codeExts.test(k) ||
        k.includes("/") ||
        exactRootFiles.has(k) ||
        (k.startsWith(".") && !k.startsWith(".."))
    );

    if (fileKeys.length >= 1) {
      const result = {};
      let validCount = 0;
      for (const k of fileKeys) {
        const val = obj[k];
        const cleanPath = k.replace(/\\/g, "/").replace(/^\//, "");
        if (typeof val === "string") {
          result[cleanPath] = val;
          validCount++;
        } else if (val && typeof val.content === "string") {
          result[cleanPath] = val.content;
          validCount++;
        } else if (val && typeof val.code === "string") {
          result[cleanPath] = val.code;
          validCount++;
        } else if (val && typeof val.value === "string") {
          result[cleanPath] = val.value;
          validCount++;
        } else if (val && typeof val.text === "string") {
          result[cleanPath] = val.text;
          validCount++;
        }
      }
      if (validCount >= 1) return result;
    }

    const nested = ["files", "projectFiles", "fileTree", "fileMap", "sources", "documents", "project", "data"];
    for (const key of nested) {
      if (obj[key] && typeof obj[key] === "object") {
        const r = checkObjectForFiles(obj[key]);
        if (r && Object.keys(r).length > 0) return r;
      }
    }

    return null;
  }
})();
