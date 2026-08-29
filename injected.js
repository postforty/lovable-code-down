/**
 * Lovable Code Downloader - Injected Script (v1.0.6)
 * Validates real source code strings and inspects React state, TanStack Query, and Monaco models.
 */

(function () {
  console.log("⚡ Lovable Injected Script active in main page context.");

  // Helper to validate whether a string is actual source code (and NOT UI layout flags like "horizontal")
  function isValidCode(str, fileName) {
    if (typeof str !== "string") return false;
    const trimmed = str.trim();
    if (trimmed.length === 0) return false;

    // Reject UI layout / state tokens
    const bannedKeywords = [
      "horizontal", "vertical", "auto", "default", "codeEditor", "preview",
      "both", "left", "right", "top", "bottom", "ltr", "rtl", "open", "closed"
    ];
    if (bannedKeywords.includes(trimmed.toLowerCase())) return false;

    // If it's a JSON file, should start with { or [
    if (fileName && fileName.endsWith(".json")) {
      return trimmed.startsWith("{") || trimmed.startsWith("[");
    }

    // Code usually has newlines, or code tokens
    if (trimmed.includes("\n") || trimmed.includes(";") || trimmed.startsWith("<") || trimmed.startsWith("{") || trimmed.startsWith("import") || trimmed.startsWith("export")) {
      return true;
    }

    return trimmed.length > 15;
  }

  // Listen for extraction requests from content script
  window.addEventListener("message", async (event) => {
    if (!event.data) return;

    // 1. Bulk state extraction request
    if (event.data.type === "LCD_REQUEST_STATE_EXTRACTION") {
      const files = await extractFilesFromPageState();
      window.postMessage(
        {
          type: "LCD_RESPONSE_STATE_EXTRACTION",
          files: files,
        },
        "*"
      );
    }

    // 2. Active file full code extraction request
    if (event.data.type === "LCD_REQUEST_ACTIVE_CODE") {
      const code = getFullActiveFileCode(event.data.filePath);
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

  // Extract complete un-truncated code from Monaco Editor API or React Fiber
  function getFullActiveFileCode(targetPath) {
    try {
      // 1. Try window.monaco editor models (Global Model API)
      if (window.monaco && window.monaco.editor) {
        if (window.monaco.editor.getModels) {
          const models = window.monaco.editor.getModels();
          if (models && models.length > 0) {
            if (targetPath) {
              const matchedModel = models.find((m) => {
                const p = m.uri ? m.uri.path || m.uri.fsPath || "" : "";
                return p.endsWith(targetPath) || targetPath.endsWith(p.replace(/^\//, ""));
              });
              if (matchedModel && matchedModel.getValue) {
                const val = matchedModel.getValue();
                if (isValidCode(val, targetPath)) return val;
              }
            }
            // Fallback: active or latest model
            for (let i = models.length - 1; i >= 0; i--) {
              const val = models[i].getValue();
              if (isValidCode(val, targetPath)) return val;
            }
          }
        }

        // 2. Try active Monaco editors
        if (window.monaco.editor.getEditors) {
          const editors = window.monaco.editor.getEditors();
          if (editors && editors.length > 0) {
            for (const ed of editors) {
              const model = ed.getModel && ed.getModel();
              if (model && model.getValue) {
                const val = model.getValue();
                if (isValidCode(val, targetPath)) return val;
              }
            }
          }
        }
      }

      // 3. Try React Fiber on .monaco-editor, .code-editor-wrapper, and main
      const targets = [
        document.querySelector(".monaco-editor"),
        document.querySelector(".code-editor-wrapper"),
        document.querySelector("[data-testid='code-editor']"),
        document.querySelector("main"),
      ].filter(Boolean);

      for (const el of targets) {
        const fiberKey = Object.keys(el).find(
          (k) => k.startsWith("__reactFiber$") || k.startsWith("__reactContainer$")
        );
        if (fiberKey) {
          let fiber = el[fiberKey];
          for (let i = 0; i < 30 && fiber; i++) {
            const props = fiber.memoizedProps;
            if (props) {
              if (isValidCode(props.code, targetPath)) return props.code;
              if (isValidCode(props.content, targetPath)) return props.content;
              if (isValidCode(props.value, targetPath)) return props.value;
              if (props.file && isValidCode(props.file.content, targetPath)) return props.file.content;
              if (props.file && isValidCode(props.file.value, targetPath)) return props.file.value;
              if (props.editor && props.editor.getValue) {
                const val = props.editor.getValue();
                if (isValidCode(val, targetPath)) return val;
              }
            }

            // Check memoized state hooks
            let stateNode = fiber.memoizedState;
            while (stateNode) {
              if (typeof stateNode.memoizedState === "string" && isValidCode(stateNode.memoizedState, targetPath)) {
                return stateNode.memoizedState;
              }
              stateNode = stateNode.next;
            }

            fiber = fiber.return;
          }
        }
      }
    } catch (e) {
      console.warn("[LCD] getFullActiveFileCode error:", e);
    }

    return null;
  }

  // Bulk scan for files across React Fiber, TanStack Query Cache, and IndexedDB
  async function extractFilesFromPageState() {
    const files = {};

    // 1. Try Monaco Editor Models if available
    try {
      if (window.monaco && window.monaco.editor && window.monaco.editor.getModels) {
        const models = window.monaco.editor.getModels();
        if (models && models.length > 0) {
          models.forEach((m) => {
            const path = (m.uri && m.uri.path ? m.uri.path : "").replace(/^\//, "");
            const val = m.getValue();
            if (path && isValidCode(val, path)) {
              files[path] = val;
            }
          });
        }
      }
    } catch (e) {
      console.warn("[LCD] Monaco scan error:", e);
    }

    // 2. Try scanning React Fiber Tree for full file data structures
    try {
      const rootEl = document.querySelector("#root") || document.querySelector("body > div");
      if (rootEl) {
        const fiberKey = Object.keys(rootEl).find(
          (k) => k.startsWith("__reactFiber$") || k.startsWith("__reactContainer$")
        );
        if (fiberKey) {
          const rootFiber = rootEl[fiberKey];
          const foundFiles = scanFiberForFiles(rootFiber, new Set(), 0);
          if (foundFiles && Object.keys(foundFiles).length > 0) {
            Object.assign(files, foundFiles);
          }
        }
      }
    } catch (e) {
      console.warn("[LCD] React Fiber scan error:", e);
    }

    // 3. Try scanning IndexedDB for cached files
    try {
      const idbFiles = await scanIndexedDB();
      if (idbFiles && Object.keys(idbFiles).length > 0) {
        Object.assign(files, idbFiles);
      }
    } catch (e) {
      console.warn("[LCD] IDB scan error:", e);
    }

    return Object.keys(files).length > 0 ? files : null;
  }

  // Recursive React Fiber scanner
  function scanFiberForFiles(fiber, visited, depth) {
    if (!fiber || depth > 25 || visited.has(fiber)) return null;
    visited.add(fiber);

    const candidates = [
      fiber.memoizedProps,
      fiber.memoizedState,
      fiber.stateNode,
    ];

    for (const obj of candidates) {
      if (!obj || typeof obj !== "object") continue;

      const filesMap = checkObjectForFiles(obj);
      if (filesMap && Object.keys(filesMap).length >= 3) {
        return filesMap;
      }

      // Check Zustand / Redux store state
      if (obj.getState && typeof obj.getState === "function") {
        try {
          const state = obj.getState();
          const stateFiles = checkObjectForFiles(state);
          if (stateFiles && Object.keys(stateFiles).length >= 3) {
            return stateFiles;
          }
        } catch (_) {}
      }

      // Check TanStack Query / React Query Client
      if (obj.getQueryCache && typeof obj.getQueryCache === "function") {
        try {
          const queries = obj.getQueryCache().getAll();
          for (const q of queries) {
            if (q.state && q.state.data) {
              const queryFiles = checkObjectForFiles(q.state.data);
              if (queryFiles && Object.keys(queryFiles).length >= 3) {
                return queryFiles;
              }
            }
          }
        } catch (_) {}
      }
    }

    // Traverse child and sibling
    if (fiber.child) {
      const res = scanFiberForFiles(fiber.child, visited, depth + 1);
      if (res) return res;
    }
    if (fiber.sibling) {
      const res = scanFiberForFiles(fiber.sibling, visited, depth + 1);
      if (res) return res;
    }

    return null;
  }

  function checkObjectForFiles(obj) {
    if (!obj || typeof obj !== "object") return null;

    const keys = Object.keys(obj);
    const codeExts = /\.(tsx|ts|js|jsx|json|css|html|md|toml|lock|gitignore)$/i;
    const fileKeys = keys.filter((k) => codeExts.test(k) || k.includes("/"));

    if (fileKeys.length >= 3) {
      const result = {};
      let validCount = 0;
      for (const k of fileKeys) {
        const val = obj[k];
        if (typeof val === "string" && isValidCode(val, k)) {
          result[k] = val;
          validCount++;
        } else if (val && typeof val.content === "string" && isValidCode(val.content, k)) {
          result[k] = val.content;
          validCount++;
        } else if (val && typeof val.value === "string" && isValidCode(val.value, k)) {
          result[k] = val.value;
          validCount++;
        }
      }
      if (validCount >= 3) return result;
    }

    const nestedProps = ["files", "projectFiles", "fileTree", "fileMap", "sources", "documents", "project", "data"];
    for (const prop of nestedProps) {
      if (obj[prop] && typeof obj[prop] === "object") {
        const nestedRes = checkObjectForFiles(obj[prop]);
        if (nestedRes) return nestedRes;
      }
    }

    return null;
  }

  // Scan IndexedDB for code files
  async function scanIndexedDB() {
    if (!window.indexedDB || !window.indexedDB.databases) return null;
    const files = {};

    try {
      const dbs = await window.indexedDB.databases();
      for (const dbInfo of dbs) {
        if (!dbInfo.name) continue;
        const db = await openDB(dbInfo.name, dbInfo.version);
        if (!db) continue;

        for (let i = 0; i < db.objectStoreNames.length; i++) {
          const storeName = db.objectStoreNames[i];
          try {
            const records = await getAllFromStore(db, storeName);
            for (const item of records) {
              if (!item) continue;
              if (item.path && item.content && isValidCode(item.content, item.path)) {
                files[item.path] = item.content;
              }
            }
          } catch (_) {}
        }
        db.close();
      }
    } catch (_) {}

    return Object.keys(files).length > 0 ? files : null;
  }

  function openDB(name, version) {
    return new Promise((resolve) => {
      const req = indexedDB.open(name, version);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  }

  function getAllFromStore(db, storeName) {
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch (_) {
        resolve([]);
      }
    });
  }
})();
