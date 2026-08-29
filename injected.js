/**
 * Lovable Code Downloader - Injected Script (Runs in page context)
 * Directly inspects React Fiber, Zustand/Redux stores, and Monaco instances.
 */

(function () {
  console.log("⚡ Lovable Injected Script active in main page context.");

  // Listen for extraction requests from content script
  window.addEventListener("message", async (event) => {
    if (event.data && event.data.type === "LCD_REQUEST_STATE_EXTRACTION") {
      const files = await extractFilesFromPageState();
      window.postMessage(
        {
          type: "LCD_RESPONSE_STATE_EXTRACTION",
          files: files,
        },
        "*"
      );
    }
  });

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
            if (path && val) {
              files[path] = val;
            }
          });
        }
      }
    } catch (e) {
      console.warn("[LCD] Monaco scan error:", e);
    }

    // 2. Try scanning React Fiber Tree for file data structures
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

    // Check props, state, and memoizedState
    const candidates = [
      fiber.memoizedProps,
      fiber.memoizedState,
      fiber.stateNode,
    ];

    for (const obj of candidates) {
      if (!obj || typeof obj !== "object") continue;

      // Check if this object is a files map: e.g. { "src/App.tsx": "..." } or { "package.json": { content: "..." } }
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

    // Direct map of path -> string content
    const keys = Object.keys(obj);
    const codeExts = /\.(tsx|ts|js|jsx|json|css|html|md|toml|lock|gitignore)$/i;
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
        } else if (val && typeof val.value === "string") {
          result[k] = val.value;
          validCount++;
        }
      }
      if (validCount >= 3) return result;
    }

    // Check nested properties like obj.files, obj.fileTree, obj.project.files
    const nestedProps = ["files", "projectFiles", "fileTree", "fileMap", "sources", "documents"];
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
              if (item.path && (item.content || item.value)) {
                files[item.path] = item.content || item.value;
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
