/**
 * Lovable Code Downloader - Content Script (v1.1.3)
 * Universal Editor Text Extractor for CodeMirror 6, Monaco, and React SPAs.
 */

(function () {
  if (window.__LOVABLE_CODE_DOWNLOADER_INJECTED__) return;
  window.__LOVABLE_CODE_DOWNLOADER_INJECTED__ = true;

  console.log("⚡ Lovable Code Downloader (v1.1.3) active.");

  let isExtracting = false;
  let shouldAbort = false;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Initialize UI
  function init() {
    createFloatingButton();
    createProgressModal();
  }

  // Project name
  function getProjectName() {
    const titleEl =
      document.querySelector("header h1, header h2") ||
      document.querySelector("[data-testid='project-title']") ||
      document.querySelector("header span.font-medium") ||
      document.querySelector("header div.font-semibold") ||
      document.querySelector("header button span");

    if (titleEl && titleEl.textContent.trim()) {
      const clean = titleEl.textContent.trim().replace(/[^\w\s-가-힣]/g, "").trim().replace(/\s+/g, "_");
      if (clean) return clean;
    }

    const match = window.location.pathname.match(/\/projects?\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `lovable_${match[1]}`;
    }

    return "lovable_project";
  }

  // Floating Action Button
  function createFloatingButton() {
    if (document.getElementById("lcd-floating-btn")) return;

    const btn = document.createElement("button");
    btn.id = "lcd-floating-btn";
    btn.innerHTML = `
      <svg viewBox="0 0 24 24">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      <span>코드 전체 다운로드 (ZIP)</span>
    `;

    btn.title = "Lovable 프로젝트의 전체 소스코드를 ZIP으로 다운로드합니다.";
    btn.addEventListener("click", startExtractionFlow);
    document.body.appendChild(btn);
  }

  // Progress Modal
  function createProgressModal() {
    if (document.getElementById("lcd-modal-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "lcd-modal-overlay";
    overlay.innerHTML = `
      <div id="lcd-modal">
        <div class="lcd-modal-header">
          <div class="lcd-modal-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ec4899" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Lovable 소스 코드 일괄 추출기
          </div>
          <button class="lcd-modal-close" id="lcd-modal-close-btn" title="닫기">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="lcd-modal-body">
          <p id="lcd-modal-desc">모든 파일의 원본 소스코드를 100% 온전히 수집하여 ZIP으로 압축합니다.</p>
          <div class="lcd-progress-container">
            <div class="lcd-progress-bar-bg">
              <div class="lcd-progress-bar-fill" id="lcd-progress-fill"></div>
            </div>
            <div class="lcd-status-text">
              <span id="lcd-status-msg">대기 중...</span>
              <span id="lcd-status-percent">0%</span>
            </div>
          </div>
          <div class="lcd-current-file" id="lcd-current-file"></div>
          <div class="lcd-log-box" id="lcd-log-box"></div>
        </div>
        <div class="lcd-modal-footer">
          <button class="lcd-btn lcd-btn-secondary" id="lcd-cancel-btn">취소</button>
          <button class="lcd-btn lcd-btn-primary" id="lcd-start-btn">다운로드 시작</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById("lcd-modal-close-btn").addEventListener("click", hideModal);
    document.getElementById("lcd-cancel-btn").addEventListener("click", () => {
      if (isExtracting) {
        shouldAbort = true;
        addLog("수집 중단 요청됨...", "warning");
      } else {
        hideModal();
      }
    });
    document.getElementById("lcd-start-btn").addEventListener("click", () => {
      if (!isExtracting) {
        startExtractionFlow();
      }
    });
  }

  function showModal() {
    const overlay = document.getElementById("lcd-modal-overlay");
    if (overlay) overlay.classList.add("active");
  }

  function hideModal() {
    const overlay = document.getElementById("lcd-modal-overlay");
    if (overlay) overlay.classList.remove("active");
  }

  function addLog(message, type = "info") {
    const logBox = document.getElementById("lcd-log-box");
    if (!logBox) return;
    const item = document.createElement("div");
    item.className = `lcd-log-item ${type}`;
    const time = new Date().toLocaleTimeString("ko-KR", { hour12: false });
    item.textContent = `[${time}] ${message}`;
    logBox.appendChild(item);
    logBox.scrollTop = logBox.scrollHeight;
  }

  function updateProgress(percent, currentFile, statusMsg) {
    const fill = document.getElementById("lcd-progress-fill");
    const percentEl = document.getElementById("lcd-status-percent");
    const msgEl = document.getElementById("lcd-status-msg");
    const fileEl = document.getElementById("lcd-current-file");

    if (fill) fill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    if (percentEl) percentEl.textContent = `${Math.round(percent)}%`;
    if (statusMsg && msgEl) msgEl.textContent = statusMsg;
    if (currentFile && fileEl) fileEl.textContent = `📄 ${currentFile}`;
  }

  function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "lcd-toast";
    toast.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
      <span>${message}</span>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.3s";
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // ----------------------------------------------------
  // Extraction Workflow
  // ----------------------------------------------------

  async function startExtractionFlow() {
    if (isExtracting) return;
    if (typeof JSZip === "undefined") {
      alert("JSZip 라이브러리가 준비되지 않았습니다. 페이지를 새로고침(F5)한 후 다시 시도해 주세요.");
      return;
    }

    isExtracting = true;
    shouldAbort = false;
    showModal();

    const startBtn = document.getElementById("lcd-start-btn");
    if (startBtn) startBtn.disabled = true;

    const logBox = document.getElementById("lcd-log-box");
    if (logBox) logBox.innerHTML = "";

    updateProgress(0, "", "준비 중...");
    addLog("Lovable 정밀 소스코드 추출 엔진 시작", "info");

    try {
      let collectedFiles = {};

      // 1. 최우선: React State Bulk Extraction 시도 (정밀 검증)
      addLog("🧠 React 내부 메모리 저장소(TanStack Query/Fiber) 검증 스캔 중...", "info");
      const bulkFiles = await requestBulkStateExtraction();

      if (bulkFiles && Object.keys(bulkFiles).length >= 4) {
        addLog(`✨ 성공! 메모리 저장소에서 ${Object.keys(bulkFiles).length}개의 원본 코드를 즉시 추출했습니다. (무손실)`, "success");
        collectedFiles = bulkFiles;
      } else {
        addLog("ℹ 파일 트리 직접 탐색 및 CodeMirror 6 정밀 버퍼 추출 엔진으로 진행합니다.", "info");

        // 2. Ensure Code Tab is active
        await ensureCodeViewActive();

        // 3. Step 1: Expand ALL folders
        addLog("📁 파일 트리의 모든 폴더를 여는 중...", "info");
        await expandAllTreeFolders();

        // 4. Step 2: Collect ALL files
        addLog("🔍 전체 파일 탐색 및 소스코드 정밀 수집 시작...", "info");
        collectedFiles = await collectAllTreeFiles();
      }

      if (shouldAbort) {
        addLog("수집 작업이 중단되었습니다.", "warning");
        return;
      }

      const fileCount = Object.keys(collectedFiles).length;
      if (fileCount === 0) {
        throw new Error("수집된 파일이 없습니다. 파일 목록을 다시 확인해 주세요.");
      }

      addLog(`✨ 총 ${fileCount}개 파일 수집 완료! ZIP 압축 생성 중...`, "success");
      updateProgress(90, "", "ZIP 파일 패키징 중...");

      // Generate ZIP
      const zip = new JSZip();
      for (const [path, content] of Object.entries(collectedFiles)) {
        zip.file(path, content);
      }

      const projectName = getProjectName();
      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });

      // Trigger Browser Download
      const fileName = `${projectName}.zip`;
      const downloadUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
        a.remove();
      }, 3000);

      updateProgress(100, fileName, "다운로드 완료!");
      addLog(`🎉 성공: '${fileName}' (${Math.round(zipBlob.size / 1024)} KB) 다운로드가 완료되었습니다!`, "success");
      showToast(`🎉 '${fileName}' 다운로드가 시작되었습니다!`);
    } catch (err) {
      console.error("[Lovable Code Downloader]", err);
      addLog(`❌ 오류: ${err.message}`, "warning");
      updateProgress(0, "", "오류 발생");
      alert(`코드 다운로드 중 오류가 발생했습니다:\n${err.message}`);
    } finally {
      isExtracting = false;
      if (startBtn) startBtn.disabled = false;
    }
  }

  // Request bulk extraction from React state via injected script
  function requestBulkStateExtraction() {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        window.removeEventListener("message", handler);
        resolve(null);
      }, 1500);

      function handler(event) {
        if (event.data && event.data.type === "LCD_RESPONSE_STATE_EXTRACTION") {
          clearTimeout(timeout);
          window.removeEventListener("message", handler);
          resolve(event.data.files);
        }
      }

      window.addEventListener("message", handler);
      window.postMessage({ type: "LCD_REQUEST_STATE_EXTRACTION" }, "*");
    });
  }

  // Ensure "Code" / "코드" tab is clicked and active
  async function ensureCodeViewActive() {
    const allButtons = Array.from(document.querySelectorAll("button, [role='tab'], div[role='button'], a"));
    const codeTab = allButtons.find((el) => {
      const text = el.textContent || "";
      return text.includes("코드") || text.includes("Code") || el.innerHTML.includes("</>");
    });

    if (codeTab) {
      const isSelected =
        codeTab.getAttribute("aria-selected") === "true" ||
        codeTab.classList.contains("active") ||
        codeTab.getAttribute("data-state") === "active";
      if (!isSelected) {
        addLog("코드 탭을 활성화합니다.", "info");
        codeTab.click();
        await sleep(500);
      }
    }
  }

  // Find all tree items across document and Shadow DOMs
  function getAllTreeElements() {
    const items = [];

    // Check document
    document.querySelectorAll("[role='treeitem'], button[data-item-type]").forEach((el) => items.push(el));

    // Check custom element shadowRoot
    const customTree = document.querySelector("file-tree-container");
    if (customTree && customTree.shadowRoot) {
      customTree.shadowRoot.querySelectorAll("[role='treeitem'], button[data-item-type]").forEach((el) => items.push(el));
    }

    return items;
  }

  function isFolderItem(el, label) {
    if (el.hasAttribute("aria-expanded")) return true;
    if (el.getAttribute("data-item-type") === "folder") return true;
    
    // Known Lovable folders
    const knownFolders = [".lovable", "src", "public", "assets", "components", "ui", "hooks", "lib", "routes", "pages", "utils", "styles"];
    if (knownFolders.includes(label)) return true;
    
    // Heuristic: If it has NO extension and is not a dotfile, it's highly likely a folder
    const hasExtension = /\.[a-zA-Z0-9]+$/.test(label);
    const isDotFile = /^\.[a-zA-Z0-9]+$/.test(label);
    
    if (!hasExtension && !isDotFile) return true;
    
    return false;
  }

  function getLabel(btn) {
    let label = btn.getAttribute("aria-label") || "";
    if (!label) {
      label = btn.innerText || btn.textContent || "";
      label = label.split('\n')[0].trim();
    }
    return label;
  }

  function getIndent(btn, label) {
    const ariaLevel = btn.getAttribute("aria-level");
    if (ariaLevel) return parseInt(ariaLevel, 10) * 100;
    
    const style = window.getComputedStyle(btn);
    let pl = parseFloat(style.paddingLeft) || 0;
    let innerLeft = btn.getBoundingClientRect().left;
    
    const walker = document.createTreeWalker(btn, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent.trim();
      if (text.length > 0 && label.includes(text)) {
        if (node.parentElement) {
          innerLeft = node.parentElement.getBoundingClientRect().left;
          break;
        }
      }
    }
    return Math.round((pl + innerLeft) / 6) * 6;
  }

  async function scrollToTreeTop() {
    let firstVisible = null;
    for (let i = 0; i < 15; i++) {
      let visible = getAllTreeElements().filter(el => el.getBoundingClientRect().height > 0);
      if (visible.length === 0) break;
      if (firstVisible === visible[0]) break; // Reached the top
      firstVisible = visible[0];
      firstVisible.scrollIntoView({ block: "end" });
      await sleep(150);
    }
  }

  // Expand all closed folders
  async function expandAllTreeFolders() {
    await scrollToTreeTop();
    let hasOpenedNew = true;
    let pass = 0;
    const clickedFolders = new Set();

    while (hasOpenedNew && pass < 100) {
      if (shouldAbort) break;
      pass++;
      hasOpenedNew = false;

      let visibleItems = getAllTreeElements().filter(el => el.getBoundingClientRect().height > 0);
      let pathStack = [];
      let foundUnopenedFolder = false;
      
      for (let i = 0; i < visibleItems.length; i++) {
        if (shouldAbort) break;
        
        let btn = visibleItems[i];
        let label = getLabel(btn);
        if (!label || label === "Options") continue;
        
        let indent = getIndent(btn, label);
        
        while (pathStack.length > 0 && pathStack[pathStack.length - 1].indent >= indent) {
          pathStack.pop();
        }
        
        if (isFolderItem(btn, label)) {
           let folderPath = pathStack.map(p => p.name).join('/');
           let fullPath = folderPath ? `${folderPath}/${label}` : label;
           pathStack.push({ name: label, indent: indent });
           
           if (!clickedFolders.has(fullPath)) {
               // Check if visually open
               let isOpen = false;
               if (btn.getAttribute("aria-expanded") === "true") isOpen = true;
               else if (i + 1 < visibleItems.length) {
                   const nextBtn = visibleItems[i + 1];
                   const nextIndent = getIndent(nextBtn, getLabel(nextBtn));
                   if (nextIndent > indent) isOpen = true; // Child is visible
               }
               
               if (!isOpen) {
                   clickedFolders.add(fullPath);
                   addLog(`📂 폴더 열기 시도: ${fullPath}`, "info");
                   
                   btn.scrollIntoView({ block: "center" });
                   const svg = btn.querySelector("svg");
                   if (svg) svg.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                   else btn.click();
                   
                   await sleep(350); 
                   hasOpenedNew = true;
                   foundUnopenedFolder = true;
                   break;
               }
           }
        }
      }
      
      if (!foundUnopenedFolder) {
         if (visibleItems.length > 0) {
             const lastItem = visibleItems[visibleItems.length - 1];
             lastItem.scrollIntoView({ block: "start" });
             await sleep(250);
             let newVisible = getAllTreeElements().filter(el => el.getBoundingClientRect().height > 0);
             if (newVisible.length > 0 && newVisible[newVisible.length - 1] !== lastItem) {
                 hasOpenedNew = true; // Found more items down below
             }
         }
      }
    }
  }

  // Collect all files from the tree
  async function collectAllTreeFiles() {
    const files = {};
    const processedLabels = new Set();
    
    await scrollToTreeTop();
    addLog(`가상화 트리 파일 수집 시작...`, "info");

    let consecutiveNoNewItems = 0;

    while (consecutiveNoNewItems < 5) {
      if (shouldAbort) break;
      
      let visibleItems = getAllTreeElements().filter(el => el.getBoundingClientRect().height > 0);
      let foundNew = false;
      let pathStack = [];

      for (let i = 0; i < visibleItems.length; i++) {
        if (shouldAbort) break;
        
        let btn = visibleItems[i];
        let label = getLabel(btn);
        if (!label || label === "Options" || label === "horizontal") continue;
        
        let indent = getIndent(btn, label);
        
        // Update path stack based on indentation
        while (pathStack.length > 0 && pathStack[pathStack.length - 1].indent >= indent) {
          pathStack.pop();
        }
        
        let isFolder = isFolderItem(btn, label);
        let folderPath = pathStack.map(p => p.name).join('/');
        folderPath = folderPath.replace(/\s*\/\s*/g, '/');
        let fullPath = folderPath ? `${folderPath}/${label}` : label;
        
        if (isFolder) {
          pathStack.push({ name: label, indent: indent });
          continue; // Skip folders
        }
        
        // Trust the tab if it has a clear full path
        let finalPath = fullPath;
        const activeTab = document.querySelector("[role='tab'][aria-selected='true'], [role='tab'][data-state='active'], [role='tab'].active");
        if (activeTab) {
          let tabText = activeTab.innerText || activeTab.textContent || "";
          tabText = tabText.split('\n')[0].replace(/x$/, "").trim();
          if (tabText.includes("/") && tabText.endsWith(label)) {
            finalPath = tabText.replace(/^\//, "");
          }
        }

        if (processedLabels.has(finalPath)) continue;
        
        // Found a new file!
        foundNew = true;
        processedLabels.add(finalPath);
        
        updateProgress(Math.min(90, processedLabels.size * 2), finalPath, `파일 수집 중 (${processedLabels.size}개 완료)`);
        
        btn.scrollIntoView({ block: "center" });
        btn.click();
        await sleep(400); // Wait for file to render in CodeMirror
        
        try {
          const isImage = /\.(jpg|jpeg|png|webp|gif|ico|svg)$/i.test(finalPath);
          if (isImage) {
            const imgContent = await tryGetImageContent();
            files[finalPath] = imgContent || "// Image asset";
            addLog(`✔ [이미지] ${finalPath}`, "info");
          } else {
            const content = await getEditorContentRobust(finalPath);
            if (content !== null && content !== undefined) {
              files[finalPath] = content;
              const previewSnippet = content.replace(/\s+/g, " ").slice(0, 30);
              addLog(`✔ ${finalPath} (${content.length} B) [${previewSnippet}...]`, "info");
            } else {
               addLog(`⚠ ${finalPath} 내용을 읽을 수 없습니다. (접근 불가)`, "warning");
            }
          }
        } catch (err) {
          addLog(`⚠ ${finalPath} 수집 실패: ${err.message}`, "warning");
          files[finalPath] = `// Error reading file: ${err.message}`;
        }
        
        break; // Process one file, then rescan visible items to handle virtual shifts
      }
      
      if (!foundNew) {
         if (visibleItems.length > 0) {
             const lastItem = visibleItems[visibleItems.length - 1];
             lastItem.scrollIntoView({ block: "start" });
             await sleep(250);
         }
         consecutiveNoNewItems++;
      } else {
         consecutiveNoNewItems = 0;
      }
    }


    return files;
  }

  // Handle image assets
  async function tryGetImageContent() {
    const imgEl = document.querySelector("main img, .code-viewer img, img[src*='blob:'], img[src*='http']");
    if (imgEl && imgEl.src) {
      try {
        const res = await fetch(imgEl.src);
        return await res.blob();
      } catch (_) {}
    }
    return null;
  }

  // ----------------------------------------------------
  // Robust Universal Editor Code Extractor
  // ----------------------------------------------------

  async function getEditorContentRobust(filePath) {
    // 1. 최우선: "Copy file content" 버튼 훅 활용 (에디터 내장 기능, 100% 무손실 원본)
    try {
      const copiedCode = await requestCopyInterceptFromInjected();
      if (copiedCode && typeof copiedCode === "string" && copiedCode.length > 0) {
        return cleanCodeText(copiedCode);
      }
    } catch (err) {
      console.warn("Copy button intercept failed:", err);
    }

    // 2. 차선: CodeMirror 6 EditorView / Monaco API / React Fiber 인스턴스에서 원본 텍스트 직접 추출
    try {
      const activeCode = await requestActiveCodeFromInjected(filePath);
      if (activeCode && typeof activeCode === "string" && activeCode.trim().length > 0) {
        return cleanCodeText(activeCode);
      }
    } catch (_) {}

    // 3. 3차: CodeMirror 6 DOM 라인별 파싱 (오직 .cm-editor 내부의 .cm-line만 엄격히 수집)
    const cmContainer = document.querySelector(".cm-editor, .cm-content");
    if (cmContainer) {
      const cmLines = cmContainer.querySelectorAll(".cm-line");
      if (cmLines.length > 0) {
        const lines = Array.from(cmLines).map((l) => l.textContent || "").join("\n");
        if (lines.trim().length > 0) {
          return cleanCodeText(lines);
        }
      }
    }

    // 4. 4차: 에디터 내부 pre 태그 추출
    const editorPre = document.querySelector(".cm-editor pre, .monaco-editor pre");
    if (editorPre && editorPre.textContent && editorPre.textContent.trim().length > 0) {
      return cleanCodeText(editorPre.textContent);
    }

    return "";
  }

  function cleanCodeText(raw) {
    if (!raw) return "";
    let lines = raw.split("\n");

    while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
      lines.pop();
    }

    return lines.join("\n");
  }

  function requestCopyInterceptFromInjected() {
    return new Promise((resolve) => {
      const reqId = "req_" + Math.random().toString(36).substr(2, 9);
      const timeout = setTimeout(() => {
        window.removeEventListener("message", handler);
        resolve(null);
      }, 500);

      function handler(event) {
        if (event.data && event.data.type === "LCD_RESPONSE_COPY_INTERCEPT" && event.data.reqId === reqId) {
          clearTimeout(timeout);
          window.removeEventListener("message", handler);
          resolve(event.data.code);
        }
      }

      window.addEventListener("message", handler);
      window.postMessage({ type: "LCD_REQUEST_COPY_INTERCEPT", reqId }, "*");
    });
  }

  function requestActiveCodeFromInjected(filePath) {
    return new Promise((resolve) => {
      const reqId = "req_" + Math.random().toString(36).substr(2, 9);
      const timeout = setTimeout(() => {
        window.removeEventListener("message", handler);
        resolve(null);
      }, 400);

      function handler(event) {
        if (event.data && event.data.type === "LCD_RESPONSE_ACTIVE_CODE" && event.data.reqId === reqId) {
          clearTimeout(timeout);
          window.removeEventListener("message", handler);
          resolve(event.data.code);
        }
      }

      window.addEventListener("message", handler);
      window.postMessage({ type: "LCD_REQUEST_ACTIVE_CODE", filePath, reqId }, "*");
    });
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "START_DOWNLOAD") {
      startExtractionFlow();
      sendResponse({ status: "STARTED" });
    } else if (request.action === "GET_STATUS") {
      sendResponse({
        isExtracting,
        projectName: getProjectName(),
      });
    }
    return true;
  });

  // Start initialization
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
