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
  }

  // Detect project name from page header or URL
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

  // Create Floating Action Button (FAB)
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

    btn.title = "Lovable 프로젝트의 모든 폴더와 소스코드를 ZIP으로 다운로드합니다.";
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
          <p id="lcd-modal-desc">파일 트리의 모든 폴더를 자동으로 열고 소스 코드를 수집하여 ZIP으로 압축합니다.</p>
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
      alert("JSZip 라이브러리가 로드되지 않았습니다. 페이지를 새로고침(F5)한 후 다시 시도해 주세요.");
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
    addLog("Lovable 코드 일괄 수집 작업 시작", "info");

    try {
      // 1. Ensure Code View Tab is Active
      await ensureCodeViewActive();

      // 2. Expand All Tree Folders Completely
      addLog("📁 파일 트리의 모든 폴더를 자동으로 여는 중...", "info");
      await expandAllFoldersCompletely();

      // 3. Scan Tree and Collect All Files
      addLog("🔍 전체 파일 목록 분석 중...", "info");
      const collectedFiles = await collectAllFilesFromTree();

      if (shouldAbort) {
        addLog("수집 작업이 중단되었습니다.", "warning");
        return;
      }

      const fileCount = Object.keys(collectedFiles).length;
      if (fileCount === 0) {
        throw new Error("수집된 파일이 없습니다. 화면에 코드 패널과 파일 트리가 열려 있는지 확인해 주세요.");
      }

      addLog(`✨ 총 ${fileCount}개 파일 수집 완료! ZIP 압축 파일 생성 중...`, "success");
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
      addLog(`🎉 성공: '${fileName}' 다운로드가 완료되었습니다!`, "success");
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
        addLog("코드 탭을 활성화합니다.", "info");
        codeTab.click();
        await sleep(600);
      }
    }
  }

  // Find the file tree container (left sidebar of code view)
  function getTreeContainer() {
    // 1. Check by Search code input
    const searchInput = document.querySelector('input[placeholder*="Search"], input[placeholder*="검색"]');
    if (searchInput) {
      let parent = searchInput.parentElement;
      while (parent && parent !== document.body) {
        if (parent.querySelectorAll("div, button").length > 15) {
          return parent;
        }
        parent = parent.parentElement;
      }
    }

    // 2. Check by common known files (.gitignore, package.json, etc.)
    const fileEl = Array.from(document.querySelectorAll("*")).find(
      (el) => el.childNodes.length === 1 && (el.textContent.trim() === ".gitignore" || el.textContent.trim() === "package.json")
    );
    if (fileEl) {
      let parent = fileEl.parentElement;
      for (let i = 0; i < 6; i++) {
        if (parent && parent.querySelectorAll("*").length > 20) {
          return parent;
        }
        if (parent) parent = parent.parentElement;
      }
    }

    return document.body;
  }

  // Completely expand all folders in tree until no more collapsed folders exist
  async function expandAllFoldersCompletely() {
    let loop = 0;
    const maxLoops = 15;

    while (loop < maxLoops) {
      if (shouldAbort) break;
      loop++;

      const container = getTreeContainer();
      // Find all clickable row elements in tree
      const allRows = Array.from(container.querySelectorAll("div, button, [role='treeitem']"));
      let openedAny = false;

      for (const row of allRows) {
        if (shouldAbort) break;
        // Ignore container itself or massive containers
        if (row.clientHeight === 0 || row.childNodes.length > 10) continue;

        const text = row.textContent.trim();
        if (!text || text.includes("\n") || text.length > 50) continue;

        // Determine if this row is a folder
        const isFile = isLikelyFileName(text);
        if (isFile) continue;

        // Check if folder is collapsed (contains right-arrow / chevron-right / '>' or aria-expanded=false)
        const hasChevronRight =
          row.querySelector("svg.lucide-chevron-right, svg[data-lucide='chevron-right'], svg") ||
          row.innerHTML.includes("chevron-right") ||
          row.textContent.startsWith(">");

        const isCollapsed =
          row.getAttribute("aria-expanded") === "false" ||
          row.getAttribute("data-state") === "closed" ||
          hasChevronRight;

        const isExpanded =
          row.getAttribute("aria-expanded") === "true" ||
          row.getAttribute("data-state") === "open" ||
          row.innerHTML.includes("chevron-down");

        if (!isExpanded && isCollapsed) {
          // Trigger click to expand folder
          row.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
          openedAny = true;
          await sleep(100);
        }
      }

      if (!openedAny) {
        break; // All folders are fully open!
      }
      await sleep(150);
    }
  }

  // Check if a name is a file
  function isLikelyFileName(name) {
    const trimmed = name.replace(/^>\s*/, "").trim();
    if (/\.(tsx|ts|js|jsx|json|css|html|md|ico|txt|lock|toml|ya?ml|svg|png|jpg|webp|env|gitignore|prettierignore|prettierrc|eslintrc.*)$/i.test(trimmed)) {
      return true;
    }
    const specialFiles = ["Dockerfile", "Makefile", "LICENSE", "AGENTS.md", "README.md", "bun.lock", "bunfig.toml", "components.json"];
    return specialFiles.includes(trimmed);
  }

  // Helper to extract clean name without icon prefixes
  function cleanItemName(rawText) {
    return rawText
      .replace(/^[>›▼▶{}]+\s*/, "")
      .replace(/[{}\s]+$/, "")
      .trim();
  }

  // Collect all files by traversing the open tree and reading each file
  async function collectAllFilesFromTree() {
    const container = getTreeContainer();
    const treeItems = parseTreeHierarchy(container);

    addLog(`총 ${treeItems.length}개 파일 항목 식별됨. 파일 내용 수집 시작...`, "info");

    const files = {};
    const total = treeItems.length;

    for (let i = 0; i < total; i++) {
      if (shouldAbort) break;

      const item = treeItems[i];
      updateProgress(((i + 1) / total) * 85, item.fullPath, `파일 수집 중 (${i + 1}/${total})`);

      try {
        // Scroll and click the file item in the tree
        item.element.scrollIntoView({ block: "nearest" });
        item.element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

        // Wait for Code Editor to load this file
        await sleep(280);

        const content = await waitForEditorContent(item.name);
        files[item.fullPath] = content;
        addLog(`✔ ${item.fullPath} (${content.length} chars)`, "info");
      } catch (err) {
        addLog(`⚠ ${item.fullPath} 수집 실패: ${err.message}`, "warning");
        files[item.fullPath] = `// Error loading file: ${err.message}`;
      }
    }

    return files;
  }

  // Parse indentation and hierarchy from file tree rows
  function parseTreeHierarchy(container) {
    const rows = Array.from(container.querySelectorAll("div, button, [role='treeitem']"))
      .filter((el) => {
        if (el.clientHeight === 0) return false;
        const text = el.textContent.trim();
        if (!text || text.includes("\n") || text.length > 60) return false;
        if (text === "Search code" || text === "Code") return false;
        return el.childNodes.length <= 6;
      });

    // Deduplicate distinct visual rows
    const uniqueRows = [];
    const seenElements = new Set();

    for (const row of rows) {
      if (seenElements.has(row)) continue;
      // Filter out parents if child represents the row text
      const text = cleanItemName(row.textContent);
      if (!text) continue;

      uniqueRows.push({
        element: row,
        text: text,
        rawText: row.textContent.trim(),
        indent: getElementIndentation(row),
      });
      seenElements.add(row);
    }

    // Build hierarchy stack based on indent levels
    const fileItems = [];
    const folderStack = []; // [{ indent, name }]

    for (const row of uniqueRows) {
      const isFile = isLikelyFileName(row.text);

      // Pop folders from stack that have >= current indent
      while (folderStack.length > 0 && folderStack[folderStack.length - 1].indent >= row.indent) {
        folderStack.pop();
      }

      if (!isFile) {
        // This is a directory
        folderStack.push({ indent: row.indent, name: row.text });
      } else {
        // This is a file
        const dirPath = folderStack.map((f) => f.name).join("/");
        const fullPath = dirPath ? `${dirPath}/${row.text}` : row.text;

        // Check if we already registered this fullPath
        if (!fileItems.some((f) => f.fullPath === fullPath)) {
          fileItems.push({
            name: row.text,
            fullPath: fullPath,
            element: row.element,
          });
        }
      }
    }

    return fileItems;
  }

  // Calculate indentation pixel or depth of tree row
  function getElementIndentation(el) {
    let paddingLeft = 0;
    let current = el;
    while (current && current !== document.body) {
      const style = window.getComputedStyle(current);
      const pl = parseFloat(style.paddingLeft) || 0;
      const ml = parseFloat(style.marginLeft) || 0;
      paddingLeft += pl + ml;
      current = current.parentElement;
    }
    return Math.round(paddingLeft);
  }

  // Wait and extract code content from Editor
  async function waitForEditorContent(fileName) {
    let maxTries = 8;
    while (maxTries > 0) {
      const content = readEditorDOM();
      if (content && content.trim().length > 0) {
        return content;
      }
      await sleep(100);
      maxTries--;
    }
    return readEditorDOM() || "";
  }

  // Read editor content from Monaco, CodeMirror, pre, or textarea
  function readEditorDOM() {
    // 1. Monaco Editor Model API
    if (window.monaco && window.monaco.editor) {
      const models = window.monaco.editor.getModels();
      if (models && models.length > 0) {
        const activeModel = models[models.length - 1];
        return activeModel.getValue();
      }
    }

    // 2. Monaco Editor View Lines DOM
    const monacoLines = document.querySelectorAll(".monaco-editor .view-line");
    if (monacoLines && monacoLines.length > 0) {
      return Array.from(monacoLines)
        .map((line) => line.textContent || "")
        .join("\n");
    }

    // 3. CodeMirror Lines
    const cmLines = document.querySelectorAll(".cm-line");
    if (cmLines && cmLines.length > 0) {
      return Array.from(cmLines)
        .map((line) => line.textContent || "")
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
