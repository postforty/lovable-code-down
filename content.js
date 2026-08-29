/**
 * Lovable Code Downloader - Content Script
 * Extracts full project code from Lovable.dev and downloads it as a ZIP file.
 */

(function () {
  if (window.__LOVABLE_CODE_DOWNLOADER_INJECTED__) return;
  window.__LOVABLE_CODE_DOWNLOADER_INJECTED__ = true;

  console.log("⚡ Lovable Code Downloader extension active.");

  let isExtracting = false;
  let shouldAbort = false;

  // Utility sleep
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Initialize UI when DOM is ready
  function init() {
    createFloatingButton();
    createProgressModal();
    observeHeader();
  }

  // Detect project name from page header
  function getProjectName() {
    const titleEl =
      document.querySelector("header h1, header h2") ||
      document.querySelector("[data-testid='project-title']") ||
      document.querySelector("button[aria-haspopup='menu'] span") ||
      document.querySelector("header button span") ||
      document.querySelector("header span.font-medium") ||
      document.querySelector("header div.font-semibold");

    if (titleEl && titleEl.textContent.trim()) {
      return titleEl.textContent.trim().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_");
    }

    // Check URL path (e.g. /projects/xyz)
    const match = window.location.pathname.match(/\/projects?\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `lovable_${match[1]}`;
    }

    return "lovable_project";
  }

  // Create Modern Floating Action Button (FAB)
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

    btn.title = "Lovable 프로젝트 전체 소스 코드를 ZIP으로 다운로드합니다.";
    btn.addEventListener("click", startExtractionFlow);
    document.body.appendChild(btn);
  }

  // Create Progress & Log Modal
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
            Lovable 소스 코드 추출기
          </div>
          <button class="lcd-modal-close" id="lcd-modal-close-btn" title="닫기">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="lcd-modal-body">
          <p id="lcd-modal-desc">프로젝트 파일 트리 및 소스 코드를 수집하여 ZIP 파일로 패키징합니다.</p>
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

    // Event listeners for modal
    document.getElementById("lcd-modal-close-btn").addEventListener("click", hideModal);
    document.getElementById("lcd-cancel-btn").addEventListener("click", () => {
      if (isExtracting) {
        shouldAbort = true;
        addLog("수집 취소 요청됨...", "warning");
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

  // Observe and inject quick download button into header if available
  function observeHeader() {
    const checkHeader = () => {
      const upgradeBtn = document.querySelector("button:has-text('Upgrade'), button.bg-primary");
      const codeTabBtn = Array.from(document.querySelectorAll("button, [role='tab']")).find(
        (el) => el.textContent.includes("코드") || el.textContent.includes("Code")
      );

      if (codeTabBtn && !document.querySelector(".lcd-header-btn")) {
        const headerBtn = document.createElement("button");
        headerBtn.className = "lcd-header-btn";
        headerBtn.innerHTML = `📥 ZIP 다운로드`;
        headerBtn.title = "프로젝트 전체 소스코드 ZIP 다운로드";
        headerBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          startExtractionFlow();
        });
        if (codeTabBtn.parentElement) {
          codeTabBtn.parentElement.appendChild(headerBtn);
        }
      }
    };

    checkHeader();
    const observer = new MutationObserver(checkHeader);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ----------------------------------------------------
  // Extraction Logic
  // ----------------------------------------------------

  async function startExtractionFlow() {
    if (isExtracting) return;
    if (typeof JSZip === "undefined") {
      alert("JSZip 라이브러리가 로드되지 않았습니다. 페이지를 새로고침한 후 다시 시도해 주세요.");
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
    addLog("프로젝트 다운로드 작업 시작", "info");

    try {
      // Step 1: Ensure Code view is active
      await ensureCodeViewActive();

      // Step 2: Try Fast In-Memory State Extraction first
      let collectedFiles = await tryFastStateExtraction();

      // Step 3: If fast extraction didn't get all files, run DOM crawler
      if (!collectedFiles || Object.keys(collectedFiles).length === 0) {
        addLog("DOM 기반 파일 트리 스캔 모드 가동", "info");
        collectedFiles = await runDomTreeCrawler();
      }

      if (shouldAbort) {
        addLog("작업이 취소되었습니다.", "warning");
        return;
      }

      const fileCount = Object.keys(collectedFiles).length;
      if (fileCount === 0) {
        throw new Error("수집된 파일이 없습니다. 화면에 코드 탭과 파일 트리가 열려 있는지 확인해 주세요.");
      }

      addLog(`총 ${fileCount}개 파일 수집 완료! 압축 파일(.zip) 생성 중...`, "success");
      updateProgress(90, "", "ZIP 파일 패키징 중...");

      // Step 4: Bundle into ZIP using JSZip
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

      // Step 5: Trigger Browser Download
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
      }, 2000);

      updateProgress(100, fileName, "다운로드 완료!");
      addLog(`성공: '${fileName}' 다운로드가 시작되었습니다.`, "success");
      showToast(`🎉 '${fileName}' 다운로드가 완료되었습니다!`);
    } catch (err) {
      console.error("[Lovable Code Downloader]", err);
      addLog(`오류 발생: ${err.message}`, "warning");
      updateProgress(0, "", "오류 발생");
      alert(`코드 다운로드 중 오류가 발생했습니다:\n${err.message}`);
    } finally {
      isExtracting = false;
      if (startBtn) startBtn.disabled = false;
    }
  }

  // Ensure "Code" / "코드" tab is clicked and open
  async function ensureCodeViewActive() {
    addLog("코드 뷰 상태 확인 중...", "info");
    const tabs = Array.from(document.querySelectorAll("button, [role='tab'], div[role='button']"));
    const codeTab = tabs.find((el) => {
      const text = el.textContent || "";
      return text.includes("코드") || text.includes("Code") || el.innerHTML.includes("</>");
    });

    if (codeTab) {
      const isSelected =
        codeTab.getAttribute("aria-selected") === "true" ||
        codeTab.classList.contains("active") ||
        codeTab.getAttribute("data-state") === "active";
      if (!isSelected) {
        addLog("코드 탭 활성화 클릭", "info");
        codeTab.click();
        await sleep(600);
      }
    }
  }

  // Attempt to extract files from React internal Fiber / Zustand / Redux state
  async function tryFastStateExtraction() {
    try {
      // Check if global state has files
      if (window.__LOVABLE_FILES__ && typeof window.__LOVABLE_FILES__ === "object") {
        addLog("전역 파일 캐시에서 데이터 발견!", "success");
        return window.__LOVABLE_FILES__;
      }

      // Check IndexedDB or CacheStorage if available
      return null;
    } catch (e) {
      return null;
    }
  }

  // DOM Crawler to recursively expand folders and read code editor contents
  async function runDomTreeCrawler() {
    const files = {};

    // 1. Find file tree container
    let treeContainer = findFileTreeContainer();
    if (!treeContainer) {
      addLog("파일 트리 컨테이너를 탐색 중...", "info");
      await sleep(500);
      treeContainer = findFileTreeContainer();
    }

    if (!treeContainer) {
      throw new Error("파일 트리 목록을 찾을 수 없습니다. 코드 패널이 열려 있는지 확인해 주세요.");
    }

    // 2. Expand all closed folders
    addLog("모든 폴더 펼치는 중...", "info");
    await expandAllFolders(treeContainer);

    // 3. Scan all file nodes
    const fileItems = getFileNodes(treeContainer);
    addLog(`총 ${fileItems.length}개의 파일 항목 감지됨. 순차 수집 시작...`, "info");

    const total = fileItems.length;
    for (let i = 0; i < total; i++) {
      if (shouldAbort) break;

      const item = fileItems[i];
      const filePath = item.path;

      updateProgress(((i + 1) / total) * 85, filePath, `파일 수집 중 (${i + 1}/${total})`);

      try {
        // Click the file item to load into editor
        item.element.scrollIntoView({ block: "nearest" });
        item.element.click();
        await sleep(220); // wait for editor to update

        // Extract content from editor
        const codeContent = getEditorContent();
        files[filePath] = codeContent;
        addLog(`✔ ${filePath} (${codeContent.length} bytes)`, "info");
      } catch (err) {
        addLog(`⚠ ${filePath} 읽기 실패: ${err.message}`, "warning");
        files[filePath] = `// Error reading file: ${err.message}`;
      }
    }

    return files;
  }

  // Locate the file tree DOM container
  function findFileTreeContainer() {
    // Search by input "Search code" or typical tree container classes
    const searchInput = document.querySelector('input[placeholder*="Search"], input[placeholder*="검색"]');
    if (searchInput) {
      let parent = searchInput.parentElement;
      for (let i = 0; i < 6; i++) {
        if (parent && (parent.querySelectorAll("button, div[role='treeitem'], div.cursor-pointer").length > 3)) {
          return parent;
        }
        if (parent) parent = parent.parentElement;
      }
    }

    // Fallback: look for elements with filenames like package.json, src, etc.
    const packageJsonEl = Array.from(document.querySelectorAll("*")).find(
      (el) => el.childNodes.length === 1 && el.textContent.trim() === "package.json"
    );
    if (packageJsonEl) {
      let parent = packageJsonEl.parentElement;
      for (let i = 0; i < 5; i++) {
        if (parent && parent.querySelectorAll("*").length > 10) {
          return parent;
        }
        if (parent) parent = parent.parentElement;
      }
    }

    return document.body;
  }

  // Expand all collapsed folder nodes
  async function expandAllFolders(container) {
    let hasExpanded = true;
    let passes = 0;

    while (hasExpanded && passes < 6) {
      hasExpanded = false;
      passes++;

      // Find collapsed folder arrows/buttons (e.g. svg with chevron-right, >, aria-expanded="false")
      const elements = Array.from(container.querySelectorAll("button, div[role='treeitem'], div.cursor-pointer, div"));
      for (const el of elements) {
        const isCollapsed =
          el.getAttribute("aria-expanded") === "false" ||
          el.getAttribute("data-state") === "closed" ||
          el.classList.contains("collapsed");

        const hasFolderIcon = el.innerHTML.includes("chevron-right") || el.innerHTML.includes("<polyline");
        const isLeafFile = /\.(tsx|ts|js|jsx|json|css|html|md|ico|lock|toml|ya?ml)$/i.test(el.textContent.trim());

        if ((isCollapsed || hasFolderIcon) && !isLeafFile) {
          // Check if this looks like a folder name
          const text = el.textContent.trim();
          if (text && !text.includes("\n") && text.length < 40) {
            el.click();
            hasExpanded = true;
            await sleep(80);
          }
        }
      }
    }
  }

  // Extract all file nodes with calculated relative paths
  function getFileNodes(container) {
    const items = [];
    const elements = Array.from(
      container.querySelectorAll("button, div[role='treeitem'], div.cursor-pointer, div[tabindex='0']")
    );

    const fileRegex = /\.(tsx|ts|js|jsx|json|css|html|md|ico|txt|lock|toml|ya?ml|svg|png|jpg|env.*|gitignore|prettier.*|eslint.*)$/i;
    const specialFiles = ["Dockerfile", "Makefile", "LICENSE", "AGENTS.md", "README", "bun.lock", "bunfig.toml", "components.json"];

    const seenPaths = new Set();

    elements.forEach((el) => {
      const text = el.textContent.trim();
      if (!text || text.includes("\n") || text.length > 80) return;

      const isFile = fileRegex.test(text) || specialFiles.includes(text);
      if (isFile) {
        const fullPath = calculateFilePath(el, text);
        if (!seenPaths.has(fullPath)) {
          seenPaths.add(fullPath);
          items.push({
            name: text,
            path: fullPath,
            element: el,
          });
        }
      }
    });

    return items;
  }

  // Calculate file relative path based on indentation or DOM hierarchy
  function calculateFilePath(el, fileName) {
    const pathSegments = [];
    let current = el.parentElement;

    // Check style padding-left or parent folder markers
    while (current && current !== document.body && pathSegments.length < 8) {
      const folderHeader = current.querySelector(":scope > button, :scope > div.font-medium, :scope > div.flex");
      if (folderHeader && folderHeader !== el) {
        const folderName = folderHeader.textContent.trim();
        if (folderName && !folderName.includes("\n") && !folderName.includes(".") && folderName.length < 30) {
          if (!pathSegments.includes(folderName)) {
            pathSegments.unshift(folderName);
          }
        }
      }
      current = current.parentElement;
    }

    if (pathSegments.length > 0) {
      return `${pathSegments.join("/")}/${fileName}`;
    }
    return fileName;
  }

  // Extract text content from Monaco Editor / Prism / Pre Code container
  function getEditorContent() {
    // 1. Try Monaco Editor Model API if exposed
    if (window.monaco && window.monaco.editor) {
      const models = window.monaco.editor.getModels();
      if (models && models.length > 0) {
        return models[models.length - 1].getValue();
      }
    }

    // 2. Try Monaco Editor View Lines DOM
    const monacoLines = document.querySelectorAll(".monaco-editor .view-line, .monaco-editor .view-lines > div");
    if (monacoLines && monacoLines.length > 0) {
      return Array.from(monacoLines)
        .map((line) => line.textContent || "")
        .join("\n");
    }

    // 3. Try CodeMirror
    const cmLines = document.querySelectorAll(".cm-line, .cm-content");
    if (cmLines && cmLines.length > 0) {
      return Array.from(cmLines)
        .map((line) => line.textContent || "")
        .join("\n");
    }

    // 4. Try pre / code tag
    const codeTag = document.querySelector("main pre code, .code-viewer pre, pre");
    if (codeTag) {
      return codeTag.textContent || "";
    }

    // 5. Try textarea / input
    const textarea = document.querySelector("main textarea, .monaco-editor textarea");
    if (textarea && textarea.value) {
      return textarea.value;
    }

    return "";
  }

  // Listen for messages from popup or background script
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
