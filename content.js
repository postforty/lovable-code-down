/**
 * Lovable Code Downloader - Content Script (v1.0.6)
 * Virtualized Shadow DOM Tree Crawler & Full Monaco Editor Extractor.
 */

(function () {
  if (window.__LOVABLE_CODE_DOWNLOADER_INJECTED__) return;
  window.__LOVABLE_CODE_DOWNLOADER_INJECTED__ = true;

  console.log("⚡ Lovable Code Downloader active.");

  let isExtracting = false;
  let shouldAbort = false;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Initialize UI & Main World Injected Script
  function init() {
    injectMainWorldScript();
    createFloatingButton();
    createProgressModal();
  }

  // Inject script to access window.monaco / React Fiber in page context
  function injectMainWorldScript() {
    try {
      const script = document.createElement("script");
      script.src = chrome.runtime.getURL("injected.js");
      (document.head || document.documentElement).appendChild(script);
      script.onload = () => script.remove();
    } catch (e) {
      console.warn("[LCD] Main world injection error:", e);
    }
  }

  // Get project name
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
          <p id="lcd-modal-desc">가상화 파일 트리를 스크롤하며 모든 폴더와 원본 소스코드를 수집합니다.</p>
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
    addLog("Lovable 전체 코드 수집 프로세스 시작", "info");

    try {
      // 1. Ensure Code Tab is active
      await ensureCodeViewActive();

      // 2. Locate Shadow Root
      const shadowRoot = await getTreeShadowRoot();
      if (!shadowRoot) {
        throw new Error("<file-tree-container> Shadow Root를 찾을 수 없습니다. 코드 패널을 확인해 주세요.");
      }

      const scrollContainer = findScrollContainer(shadowRoot);
      addLog("✔ 가상화 탐색기(Shadow DOM) 연결 완료", "success");

      // 3. Step 1: Expand ALL folders with Virtual Scrolling
      addLog("📁 가상화 트리를 스크롤하며 모든 폴더를 여는 중...", "info");
      await expandAllFoldersWithScroll(shadowRoot, scrollContainer);

      // 4. Step 2: Collect ALL files with Virtual Scrolling and full Monaco code
      addLog("🔍 전체 파일 탐색 및 무손실 소스코드 수집 시작...", "info");
      const collectedFiles = await collectAllFilesWithScroll(shadowRoot, scrollContainer);

      if (shouldAbort) {
        addLog("수집 작업이 중단되었습니다.", "warning");
        return;
      }

      const fileCount = Object.keys(collectedFiles).length;
      if (fileCount === 0) {
        throw new Error("수집된 파일이 없습니다. 파일 목록을 다시 확인해 주세요.");
      }

      addLog(`✨ 총 ${fileCount}개 파일 무손실 수집 완료! ZIP 압축 중...`, "success");
      updateProgress(90, "", "ZIP 파일 패키징 중...");

      // 5. Generate ZIP
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

      // 6. Trigger Browser Download
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
      addLog(`🎉 성공: '${fileName}' 전체 파일 다운로드가 완료되었습니다!`, "success");
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

  // Locate <file-tree-container> Shadow Root
  async function getTreeShadowRoot() {
    for (let retry = 0; retry < 10; retry++) {
      const el = document.querySelector("file-tree-container");
      if (el && el.shadowRoot) {
        return el.shadowRoot;
      }
      if (el) return el.shadowRoot || el;
      await sleep(200);
    }
    return null;
  }

  // Find scrollable container inside Shadow DOM or host
  function findScrollContainer(shadowRoot) {
    const scrollEl =
      shadowRoot.querySelector("[data-file-tree-virtualized-scroll='true']") ||
      shadowRoot.querySelector("[role='tree']") ||
      shadowRoot.querySelector("div[style*='overflow']") ||
      shadowRoot.firstElementChild;

    return scrollEl || document.body;
  }

  // Expand all folders while scrolling through the virtualized list
  async function expandAllFoldersWithScroll(shadowRoot, scrollContainer) {
    let hasOpenedNew = true;
    let pass = 0;

    while (hasOpenedNew && pass < 8) {
      if (shouldAbort) break;
      pass++;
      hasOpenedNew = false;

      // Scroll from top to bottom
      scrollContainer.scrollTop = 0;
      await sleep(100);

      let maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
      let currentScroll = 0;
      const step = 200;

      while (currentScroll <= maxScroll + step) {
        if (shouldAbort) break;

        const closedFolders = Array.from(
          shadowRoot.querySelectorAll("button[data-item-type='folder'][aria-expanded='false']")
        );

        for (const btn of closedFolders) {
          const folderPath = btn.getAttribute("data-item-path") || btn.getAttribute("aria-label");
          addLog(`📂 폴더 열기: ${folderPath}`, "info");

          btn.scrollIntoView({ block: "nearest" });
          btn.click();
          hasOpenedNew = true;
          await sleep(60);
        }

        currentScroll += step;
        scrollContainer.scrollTop = currentScroll;
        await sleep(80);
        maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
      }

      await sleep(150);
    }

    // Scroll back to top
    scrollContainer.scrollTop = 0;
    await sleep(150);
  }

  // Collect all files by scrolling through the virtualized tree
  async function collectAllFilesWithScroll(shadowRoot, scrollContainer) {
    const files = {};
    const collectedPaths = new Set();

    // Pass 1: Scroll from TOP to BOTTOM
    scrollContainer.scrollTop = 0;
    await sleep(100);

    let maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
    let currentScroll = 0;
    const step = 150;

    while (currentScroll <= maxScroll + step * 2) {
      if (shouldAbort) break;

      await processVisibleFiles(shadowRoot, files, collectedPaths);

      currentScroll += step;
      scrollContainer.scrollTop = currentScroll;
      await sleep(100);
      maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
    }

    // Pass 2: Scroll from BOTTOM to TOP to ensure complete coverage
    addLog("🔄 역방향 검증 스캔 중...", "info");
    while (currentScroll >= -step) {
      if (shouldAbort) break;

      await processVisibleFiles(shadowRoot, files, collectedPaths);

      currentScroll -= step;
      scrollContainer.scrollTop = Math.max(0, currentScroll);
      await sleep(80);
    }

    scrollContainer.scrollTop = 0;
    return files;
  }

  // Process currently visible file buttons in Shadow DOM
  async function processVisibleFiles(shadowRoot, files, collectedPaths) {
    const visibleFileButtons = Array.from(
      shadowRoot.querySelectorAll("button[data-item-type='file']")
    );

    for (const btn of visibleFileButtons) {
      if (shouldAbort) break;

      const rawPath = btn.getAttribute("data-item-path") || btn.getAttribute("aria-label");
      if (!rawPath) continue;

      const cleanPath = rawPath.replace(/^\//, "");
      if (collectedPaths.has(cleanPath)) continue;

      collectedPaths.add(cleanPath);
      updateProgress(0, cleanPath, `파일 수집 중 (${collectedPaths.size}개 수집됨)`);

      try {
        btn.scrollIntoView({ block: "center" });
        btn.click();
        await sleep(240); // Wait for Monaco model/editor to load

        const isImage = /\.(jpg|jpeg|png|webp|gif|ico|svg)$/i.test(cleanPath);
        if (isImage) {
          const imgContent = await tryGetImageContent();
          files[cleanPath] = imgContent || "// Image asset";
          addLog(`✔ [이미지] ${cleanPath}`, "info");
        } else {
          // Extract full un-truncated source code
          const content = await getFullEditorContent(cleanPath);
          files[cleanPath] = content;
          addLog(`✔ ${cleanPath} (${content.length} chars)`, "info");
        }
      } catch (err) {
        addLog(`⚠ ${cleanPath} 수집 실패: ${err.message}`, "warning");
        files[cleanPath] = `// Error reading file: ${err.message}`;
      }
    }
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

  // Request complete code from injected script (Monaco Editor Model API / React Fiber)
  function requestActiveCodeFromInjected(filePath) {
    return new Promise((resolve) => {
      const reqId = "req_" + Math.random().toString(36).substr(2, 9);
      const timeout = setTimeout(() => {
        window.removeEventListener("message", handler);
        resolve(null);
      }, 500);

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

  function isValidCodeString(str, fileName) {
    if (typeof str !== "string") return false;
    const trimmed = str.trim();
    if (trimmed.length === 0) return false;
    const bannedKeywords = ["horizontal", "vertical", "auto", "default", "codeeditor", "preview", "both"];
    if (bannedKeywords.includes(trimmed.toLowerCase())) return false;
    if (fileName && fileName.endsWith(".json")) {
      return trimmed.startsWith("{") || trimmed.startsWith("[");
    }
    return trimmed.includes("\n") || trimmed.includes(";") || trimmed.startsWith("<") || trimmed.startsWith("{") || trimmed.length > 15;
  }

  // Extract full editor content without truncation
  async function getFullEditorContent(filePath) {
    let retries = 6;
    while (retries > 0) {
      // 1. Direct Monaco API via Injected Script (Zero-truncation guaranteed)
      const directCode = await requestActiveCodeFromInjected(filePath);
      if (isValidCodeString(directCode, filePath)) {
        return directCode;
      }

      // 2. DOM fallback
      const domCode = readEditorContentDOM(filePath);
      if (isValidCodeString(domCode, filePath)) {
        return domCode;
      }

      await sleep(100);
      retries--;
    }

    const fallbackCode = (await requestActiveCodeFromInjected(filePath)) || readEditorContentDOM(filePath) || "";
    return isValidCodeString(fallbackCode, filePath) ? fallbackCode : readEditorContentDOM(filePath) || "";
  }

  // Read editor content from DOM fallback
  function readEditorContentDOM(filePath) {
    // 1. Monaco Editor Models (if globally accessible)
    if (window.monaco && window.monaco.editor) {
      const models = window.monaco.editor.getModels();
      if (models && models.length > 0) {
        const val = models[models.length - 1].getValue();
        if (isValidCodeString(val, filePath)) return val;
      }
    }

    // 2. Pre / Code block
    const codeTag = document.querySelector("main pre code, .code-viewer pre, pre code, pre");
    if (codeTag) {
      const val = codeTag.textContent || "";
      if (isValidCodeString(val, filePath)) return val;
    }

    // 3. Textarea
    const textarea = document.querySelector(".monaco-editor textarea, main textarea");
    if (textarea && textarea.value) {
      const val = textarea.value;
      if (isValidCodeString(val, filePath)) return val;
    }

    // 4. Monaco Editor View Lines DOM
    const monacoLines = document.querySelectorAll(".monaco-editor .view-line");
    if (monacoLines && monacoLines.length > 0) {
      const val = Array.from(monacoLines)
        .map((l) => l.textContent || "")
        .join("\n");
      if (isValidCodeString(val, filePath)) return val;
    }

    // 5. CodeMirror Lines
    const cmLines = document.querySelectorAll(".cm-line");
    if (cmLines && cmLines.length > 0) {
      const val = Array.from(cmLines)
        .map((l) => l.textContent || "")
        .join("\n");
      if (isValidCodeString(val, filePath)) return val;
    }

    return "";
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
