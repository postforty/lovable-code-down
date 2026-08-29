/**
 * Lovable Code Downloader - Content Script (v1.0.2)
 * Robust TreeWalker-based file tree extractor and ZIP downloader.
 */

(function () {
  if (window.__LOVABLE_CODE_DOWNLOADER_INJECTED__) return;
  window.__LOVABLE_CODE_DOWNLOADER_INJECTED__ = true;

  console.log("⚡ Lovable Code Downloader active.");

  let isExtracting = false;
  let shouldAbort = false;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Initialize
  function init() {
    injectMainWorldScript();
    createFloatingButton();
    createProgressModal();
  }

  // Inject script to access window/React context
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

    btn.title = "Lovable 프로젝트 소스코드 전체를 ZIP으로 다운로드합니다.";
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
          <p id="lcd-modal-desc">파일 트리의 모든 소스 코드를 추출하여 ZIP으로 다운로드합니다.</p>
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
    addLog("Lovable 코드 수집 프로세스 시작", "info");

    try {
      // 1. Ensure Code Tab is active
      await ensureCodeViewActive();

      // 2. Try fast in-memory extraction
      addLog("메모리 상태 고속 추출(Fast Mode) 시도 중...", "info");
      let collectedFiles = await requestStateFromInjected();

      if (collectedFiles && Object.keys(collectedFiles).length > 0) {
        addLog(`⚡ 고속 추출 성공! ${Object.keys(collectedFiles).length}개 파일 확보`, "success");
      } else {
        // 3. TreeWalker-based DOM Crawler
        addLog("TreeWalker 기반 정밀 파일 탐색 시작...", "info");
        collectedFiles = await runTreeWalkerCrawler();
      }

      if (shouldAbort) {
        addLog("작업이 사용자에 의해 중단되었습니다.", "warning");
        return;
      }

      const fileCount = Object.keys(collectedFiles).length;
      if (fileCount === 0) {
        throw new Error("수집된 파일이 없습니다. 화면 좌측/중앙에 파일 목록이 열려 있는지 확인해 주세요.");
      }

      addLog(`✨ 총 ${fileCount}개 파일 수집 완료! ZIP 압축 생성 중...`, "success");
      updateProgress(90, "", "ZIP 압축 패키징 중...");

      // 4. Bundle into ZIP
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

      // 5. Trigger Browser Download
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
      addLog(`🎉 성공: '${fileName}' 다운로드가 시작되었습니다.`, "success");
      showToast(`🎉 '${fileName}' 다운로드가 완료되었습니다!`);
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

  // Request state from injected script
  function requestStateFromInjected() {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        window.removeEventListener("message", handler);
        resolve(null);
      }, 600);

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

  // ----------------------------------------------------
  // TreeWalker-based File Crawler
  // ----------------------------------------------------

  async function runTreeWalkerCrawler() {
    const files = {};

    // 1. Expand all folders
    addLog("📁 모든 폴더 열기(Expand) 진행 중...", "info");
    await expandAllFoldersViaTreeWalker();

    // 2. Discover all file nodes across DOM
    const fileItems = discoverFileItemsViaTreeWalker();
    addLog(`🔍 총 ${fileItems.length}개의 소스코드 파일 발견됨`, "info");

    if (fileItems.length === 0) {
      // Debug log: print sample text nodes found on page
      dumpDebugTextNodes();
      return files;
    }

    const total = fileItems.length;

    // 3. Click each file and read content
    for (let i = 0; i < total; i++) {
      if (shouldAbort) break;

      const item = fileItems[i];
      updateProgress(((i + 1) / total) * 85, item.fullPath, `파일 수집 중 (${i + 1}/${total})`);

      try {
        // Scroll element into view and trigger click
        const clickable = item.element;
        clickable.scrollIntoView({ block: "nearest", inline: "nearest" });

        clickable.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
        clickable.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        clickable.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));

        // Wait for Code Editor to load
        await sleep(300);

        const content = await getEditorContentWithPolling();
        files[item.fullPath] = content;
        addLog(`✔ ${item.fullPath} (${content.length} chars)`, "info");
      } catch (err) {
        addLog(`⚠ ${item.fullPath} 읽기 실패: ${err.message}`, "warning");
        files[item.fullPath] = `// Error reading file: ${err.message}`;
      }
    }

    return files;
  }

  // Expand folders by clicking any text node or chevron representing a folder
  async function expandAllFoldersViaTreeWalker() {
    for (let loop = 0; loop < 6; loop++) {
      if (shouldAbort) break;

      const knownFolders = [".lovable", ".wrangler", "public", "src", "components", "ui", "hooks", "lib", "routes", "deploy"];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
      let textNode;
      let opened = false;

      while ((textNode = walker.nextNode())) {
        const val = textNode.nodeValue.trim().replace(/^[>›▼▶\s]+/, "");
        if (!val || val.length > 30) continue;

        // If this text matches a known folder or starts with >
        const isFolder = knownFolders.some((f) => val === f || val.startsWith(f)) || textNode.nodeValue.includes(">");
        const isFile = isFileName(val);

        if (isFolder && !isFile) {
          const parent = textNode.parentElement;
          if (parent && !parent.hasAttribute("data-lcd-expanded")) {
            const clickable = parent.closest("div, button, [role='treeitem']") || parent;
            clickable.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
            parent.setAttribute("data-lcd-expanded", "true");
            opened = true;
            await sleep(80);
          }
        }
      }

      // Also click any collapsed chevron SVGs
      const svgs = document.querySelectorAll("svg");
      for (const svg of svgs) {
        if (svg.innerHTML.includes("polyline") || svg.classList.contains("lucide-chevron-right")) {
          const btn = svg.closest("button, div.cursor-pointer, div");
          if (btn && !btn.hasAttribute("data-lcd-svg-clicked")) {
            btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
            btn.setAttribute("data-lcd-svg-clicked", "true");
            opened = true;
            await sleep(60);
          }
        }
      }

      if (!opened) break;
      await sleep(150);
    }
  }

  // Discover all file items using TreeWalker text matching
  function discoverFileItemsViaTreeWalker() {
    const fileRegex = /([a-zA-Z0-9_\-\.\/]+\.(?:tsx|ts|js|jsx|json|css|html|md|ico|txt|lock|toml|ya?ml|svg|png|jpg|webp|env|gitignore|prettierignore|prettierrc|eslintrc[a-zA-Z0-9_\-\.]*)|AGENTS\.md|Dockerfile|Makefile|LICENSE|bun\.lock|bunfig\.toml|components\.json|package\.json|README\.md|tsconfig\.json|vite\.config\.ts)/i;

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let textNode;
    const items = [];
    const seenPaths = new Set();

    while ((textNode = walker.nextNode())) {
      const raw = textNode.nodeValue.trim();
      if (!raw || raw.length > 80) continue;

      // Extract filename from text (handles cases like "{ } package.json" or "MI AGENTS.md")
      const match = raw.match(fileRegex);
      if (match && match[1]) {
        const fileName = match[1];
        const parent = textNode.parentElement;
        if (!parent || parent.closest("#lcd-modal") || parent.closest("#lcd-floating-btn")) {
          continue;
        }

        const clickable = parent.closest("button, div[role='treeitem'], div.cursor-pointer, div.flex, div") || parent;
        const fullPath = calculatePath(parent, fileName);

        if (!seenPaths.has(fullPath)) {
          seenPaths.add(fullPath);
          items.push({
            name: fileName,
            fullPath: fullPath,
            element: clickable,
          });
        }
      }
    }

    return items;
  }

  // Check if string is a file name
  function isFileName(str) {
    const clean = str.replace(/^[>›▼▶{}\s]+/, "").trim();
    return /\.(tsx|ts|js|jsx|json|css|html|md|ico|txt|lock|toml|ya?ml|svg|png|jpg|env|gitignore|prettier.*|eslint.*)$/i.test(clean) ||
      ["Dockerfile", "Makefile", "LICENSE", "AGENTS.md", "README.md", "bun.lock", "bunfig.toml", "components.json"].includes(clean);
  }

  // Calculate hierarchical path
  function calculatePath(el, fileName) {
    const parts = [];
    let current = el.parentElement;

    while (current && current !== document.body && parts.length < 5) {
      // Find sibling or parent folder name
      const folderEl = current.querySelector(":scope > button, :scope > div.font-medium, :scope > span, :scope > div");
      if (folderEl && folderEl !== el) {
        const text = folderEl.textContent.trim().replace(/^[>›▼▶\s]+/, "");
        if (text && !text.includes("\n") && !text.includes(".") && text.length < 25) {
          if (!parts.includes(text)) {
            parts.unshift(text);
          }
        }
      }
      current = current.parentElement;
    }

    // Default structure heuristics if tree hierarchy is flattened
    if (parts.length === 0) {
      if (["favicon.ico", "robots.txt"].includes(fileName)) return `public/${fileName}`;
      if (["router.tsx", "routeTree.gen.ts", "server.ts", "start.ts", "styles.css"].includes(fileName)) return `src/${fileName}`;
      if (["project.json"].includes(fileName)) return `.lovable/${fileName}`;
    }

    return parts.length > 0 ? `${parts.join("/")}/${fileName}` : fileName;
  }

  // Dump sample text nodes for debugging if no files found
  function dumpDebugTextNodes() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let node;
    let count = 0;
    const samples = [];
    while ((node = walker.nextNode()) && count < 8) {
      const val = node.nodeValue.trim();
      if (val && val.length < 30 && !val.includes("\n")) {
        samples.push(val);
        count++;
      }
    }
    addLog(`발견된 텍스트 샘플: ${samples.join(", ")}`, "warning");
  }

  // Extract editor content with polling
  async function getEditorContentWithPolling() {
    let retries = 6;
    while (retries > 0) {
      const code = readEditorContent();
      if (code && code.trim().length > 0) {
        return code;
      }
      await sleep(100);
      retries--;
    }
    return readEditorContent() || "";
  }

  // Read editor content from Monaco, CodeMirror, or DOM
  function readEditorContent() {
    // 1. Monaco Editor Models
    if (window.monaco && window.monaco.editor) {
      const models = window.monaco.editor.getModels();
      if (models && models.length > 0) {
        return models[models.length - 1].getValue();
      }
    }

    // 2. Monaco Editor View Lines
    const monacoLines = document.querySelectorAll(".monaco-editor .view-line");
    if (monacoLines && monacoLines.length > 0) {
      return Array.from(monacoLines)
        .map((l) => l.textContent || "")
        .join("\n");
    }

    // 3. CodeMirror
    const cmLines = document.querySelectorAll(".cm-line");
    if (cmLines && cmLines.length > 0) {
      return Array.from(cmLines)
        .map((l) => l.textContent || "")
        .join("\n");
    }

    // 4. Pre / Code block
    const codeTag = document.querySelector("main pre code, .code-viewer pre, pre code, pre");
    if (codeTag) {
      return codeTag.textContent || "";
    }

    // 5. Textarea
    const textarea = document.querySelector(".monaco-editor textarea, main textarea");
    if (textarea && textarea.value) {
      return textarea.value;
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
