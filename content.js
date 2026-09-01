/**
 * Lovable Code Downloader - Content Script (v1.2.0)
 * Precision Virtualized Tree Crawler & Lossless Multi-Tier Code Extractor.
 */

(function () {
  if (window.__LOVABLE_CODE_DOWNLOADER_INJECTED__) return;
  window.__LOVABLE_CODE_DOWNLOADER_INJECTED__ = true;

  console.log("⚡ Lovable Code Downloader (v1.2.0) active.");

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
      const clean = titleEl.textContent
        .trim()
        .replace(/[^\w\s-가-힣]/g, "")
        .trim()
        .replace(/\s+/g, "_");
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

      // 1. React State Bulk Extraction 시도 (엄격한 전체 프로젝트 검증)
      addLog("🧠 React 내부 메모리 저장소(TanStack Query/Fiber) 검증 스캔 중...", "info");
      const bulkFiles = await requestBulkStateExtraction();

      if (bulkFiles && Object.keys(bulkFiles).length >= 6) {
        addLog(`✨ 성공! 메모리 저장소에서 ${Object.keys(bulkFiles).length}개의 원본 코드를 즉시 추출했습니다. (무손실)`, "success");
        collectedFiles = bulkFiles;
      } else {
        addLog("ℹ 파일 트리 직접 순회 및 CodeMirror 6 정밀 버퍼 추출 엔진으로 진행합니다.", "info");

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
      updateProgress(95, "", "ZIP 파일 패키징 중...");

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
        await sleep(600);
      }
    }
  }

  // Find the virtual scroll container for the tree
  function getTreeScrollContainer() {
    const treeItems = document.querySelectorAll("[role='treeitem'], [role='tree'] button, div[role='tree'] [tabindex]");
    if (treeItems.length > 0) {
      let el = treeItems[0].parentElement;
      while (el && el !== document.body) {
        const style = window.getComputedStyle(el);
        const overflowY = style.overflowY;
        const isScrollable =
          (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
          el.scrollHeight > el.clientHeight;

        if (
          isScrollable ||
          el.hasAttribute("data-radix-scroll-area-viewport") ||
          el.classList.contains("overflow-y-auto")
        ) {
          return el;
        }
        el = el.parentElement;
      }
    }

    const radixViewport = document.querySelector("[data-radix-scroll-area-viewport], .overflow-y-auto");
    if (radixViewport) return radixViewport;

    return null;
  }

  // Find all visible tree items across document and Shadow DOMs
  function getAllTreeElements() {
    const items = [];

    // Check standard tree items and buttons
    const queried = document.querySelectorAll(
      "[role='treeitem'], [role='tree'] button, div[role='tree'] [role='button'], [data-item-type]"
    );
    queried.forEach((el) => {
      if (el.offsetParent !== null || el.getBoundingClientRect().height > 0) {
        items.push(el);
      }
    });

    // Check custom element shadowRoot if present
    const customTree = document.querySelector("file-tree-container");
    if (customTree && customTree.shadowRoot) {
      customTree.shadowRoot
        .querySelectorAll("[role='treeitem'], button[data-item-type]")
        .forEach((el) => {
          if (el.getBoundingClientRect().height > 0) items.push(el);
        });
    }

    return items;
  }

  // Accurate Tree Item Classifier (distinguish folders vs files without extension bias)
  function classifyTreeItem(el, label) {
    if (!label) return { isFolder: false, isOpen: false };

    // 1. Explicit aria-expanded
    const ariaExpanded = el.getAttribute("aria-expanded");
    if (ariaExpanded === "true") return { isFolder: true, isOpen: true };
    if (ariaExpanded === "false") return { isFolder: true, isOpen: false };

    // 2. Explicit data-state
    const dataState = el.getAttribute("data-state");
    if (dataState === "open") return { isFolder: true, isOpen: true };
    if (dataState === "closed") return { isFolder: true, isOpen: false };

    // 3. Explicit data-item-type
    const itemType = el.getAttribute("data-item-type");
    if (itemType === "folder") return { isFolder: true, isOpen: false };
    if (itemType === "file") return { isFolder: false, isOpen: false };

    // 4. SVG icon inspection (Chevron, Folder icons)
    const svgs = el.querySelectorAll("svg");
    let hasChevron = false;
    let isChevronOpen = false;
    let hasFolderIcon = false;

    for (const svg of svgs) {
      const cls = (svg.getAttribute("class") || "") + " " + (svg.className || "");
      const html = svg.innerHTML || "";

      // Check chevron SVGs
      if (
        cls.includes("chevron") ||
        cls.includes("lucide-chevron") ||
        html.includes("6 9 12 15 18 9") ||
        html.includes("9 18 15 12 9 6") ||
        html.includes("m9 18 6-6-6-6") ||
        html.includes("m6 9 6 6 6-6")
      ) {
        hasChevron = true;
        // Expanded chevron is typically rotated or points down (m6 9 6 6 6-6 / 6 9 12 15 18 9)
        if (
          cls.includes("rotate-90") ||
          cls.includes("rotate-180") ||
          html.includes("6 9 12 15 18 9") ||
          html.includes("m6 9 6 6 6-6")
        ) {
          isChevronOpen = true;
        }
      }

      // Check folder SVGs
      if (
        cls.includes("folder") ||
        html.includes("M4 20h16") ||
        html.includes("M22 19a2 2 0 0 1-2 2H4") ||
        html.includes("M20 20a2 2 0 0 0 2-2V8")
      ) {
        hasFolderIcon = true;
      }
    }

    if (hasChevron || hasFolderIcon) {
      return { isFolder: true, isOpen: isChevronOpen };
    }

    // 5. Special extensionless files
    const knownExactFiles = [
      "Dockerfile", "LICENSE", "Makefile", "CNAME", "Procfile",
      ".gitignore", ".prettierrc", ".eslintrc", ".env", ".env.local",
      ".env.example", ".env.production", ".npmrc", "robots.txt"
    ];
    if (knownExactFiles.includes(label)) {
      return { isFolder: false, isOpen: false };
    }

    // 6. Has extension check
    const hasExtension = /\.[a-zA-Z0-9_-]+$/.test(label);
    if (hasExtension) {
      return { isFolder: false, isOpen: false };
    }

    // 7. Fallback: names without extension are considered folders
    return { isFolder: true, isOpen: false };
  }

  function getLabel(btn) {
    let label = btn.getAttribute("aria-label") || "";
    if (!label) {
      label = btn.innerText || btn.textContent || "";
      label = label.split("\n")[0].trim();
    }
    // Clean up count badges or option buttons
    label = label.replace(/\s*\(\d+\)$/, "").trim();
    return label;
  }

  function getItemLevel(btn) {
    const ariaLevel = btn.getAttribute("aria-level");
    if (ariaLevel) return parseInt(ariaLevel, 10);

    const dataDepth = btn.getAttribute("data-depth") || btn.getAttribute("data-level");
    if (dataDepth) return parseInt(dataDepth, 10);

    const style = window.getComputedStyle(btn);
    const pl = parseFloat(style.paddingLeft) || 0;
    const ml = parseFloat(style.marginLeft) || 0;

    const rect = btn.getBoundingClientRect();
    const walker = document.createTreeWalker(btn, NodeFilter.SHOW_TEXT, null, false);
    let firstTextLeft = rect.left;
    let node;
    while ((node = walker.nextNode())) {
      if (node.textContent.trim().length > 0 && node.parentElement) {
        firstTextLeft = node.parentElement.getBoundingClientRect().left;
        break;
      }
    }

    const totalOffset = pl + ml + Math.max(0, firstTextLeft - rect.left);
    return Math.max(0, Math.round(totalOffset / 12));
  }

  // Deterministically expand ALL closed folders across the virtual tree
  async function expandAllTreeFolders() {
    const container = getTreeScrollContainer();
    const clickedFolderKeys = new Set();

    let maxPasses = 30;
    let pass = 0;
    let hasOpenedInPass = true;

    while (hasOpenedInPass && pass < maxPasses) {
      if (shouldAbort) break;
      pass++;
      hasOpenedInPass = false;

      if (container) {
        container.scrollTop = 0;
        await sleep(100);
      }

      let currentScroll = 0;
      const maxScroll = container ? Math.max(container.scrollHeight, 1000) : 1000;
      const scrollStep = container ? Math.max(120, Math.floor(container.clientHeight * 0.6)) : 200;

      while (currentScroll <= maxScroll) {
        if (shouldAbort) break;

        if (container) {
          container.scrollTop = currentScroll;
          await sleep(60);
        }

        const visibleItems = getAllTreeElements();
        for (let i = 0; i < visibleItems.length; i++) {
          if (shouldAbort) break;

          const btn = visibleItems[i];
          const label = getLabel(btn);
          if (!label || label === "Options" || label === "horizontal") continue;

          const { isFolder, isOpen } = classifyTreeItem(btn, label);

          if (isFolder && !isOpen) {
            const level = getItemLevel(btn);
            const folderKey = `${level}_${label}`;

            if (!clickedFolderKeys.has(folderKey)) {
              clickedFolderKeys.add(folderKey);
              addLog(`📂 폴더 확장: ${label}`, "info");

              btn.scrollIntoView({ block: "nearest" });
              const chevronOrSvg = btn.querySelector("svg");
              if (chevronOrSvg) {
                chevronOrSvg.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
              }
              btn.click();

              await sleep(200);
              hasOpenedInPass = true;
            }
          }
        }

        currentScroll += scrollStep;
        if (container && currentScroll > container.scrollHeight) break;
      }
    }

    if (container) {
      container.scrollTop = 0;
      await sleep(150);
    }
  }

  // Deterministically collect all files with monotonic top-to-bottom virtual scroll
  async function collectAllTreeFiles() {
    const files = {};
    const processedPaths = new Set();
    const container = getTreeScrollContainer();

    if (container) {
      container.scrollTop = 0;
      await sleep(150);
    }

    addLog("가상화 트리 파일 수집 및 무손실 버퍼 추출 진행 중...", "info");

    let currentScroll = 0;
    const maxScroll = container ? Math.max(container.scrollHeight, 2000) : 2000;
    const scrollStep = container ? Math.max(80, Math.floor(container.clientHeight * 0.45)) : 150;
    let pathStack = [];

    // Continuous monotonic scroll pass
    while (currentScroll <= maxScroll + 500) {
      if (shouldAbort) break;

      if (container) {
        container.scrollTop = currentScroll;
        await sleep(90);
      }

      const visibleItems = getAllTreeElements();

      for (let i = 0; i < visibleItems.length; i++) {
        if (shouldAbort) break;

        const btn = visibleItems[i];
        const label = getLabel(btn);
        if (!label || label === "Options" || label === "horizontal") continue;

        const level = getItemLevel(btn);
        const { isFolder } = classifyTreeItem(btn, label);

        // Adjust path stack based on indentation level
        while (pathStack.length > 0 && pathStack[pathStack.length - 1].level >= level) {
          pathStack.pop();
        }

        if (isFolder) {
          pathStack.push({ level: level, name: label });
          continue;
        }

        // Construct full path
        const folderPath = pathStack.map((p) => p.name).join("/");
        const fullPath = folderPath ? `${folderPath}/${label}` : label;

        if (processedPaths.has(fullPath)) continue;
        processedPaths.add(fullPath);

        updateProgress(
          Math.min(90, processedPaths.size * 2),
          fullPath,
          `파일 수집 중 (${processedPaths.size}개 완료)`
        );

        // Open file in editor
        btn.scrollIntoView({ block: "nearest" });
        btn.click();

        // Synchronize and wait for editor to load this specific file
        await waitForEditorToLoadFile(fullPath, label);

        try {
          const isImage = /\.(jpg|jpeg|png|webp|gif|ico|svg)$/i.test(fullPath);
          if (isImage) {
            const imgContent = await tryGetImageContent();
            files[fullPath] = imgContent || "// Image asset";
            addLog(`✔ [이미지] ${fullPath}`, "info");
          } else {
            const content = await getEditorContentRobust(fullPath, label);
            if (content !== null && content !== undefined) {
              files[fullPath] = content;
              const previewSnippet = content.replace(/\s+/g, " ").slice(0, 35);
              addLog(`✔ ${fullPath} (${content.length} B) [${previewSnippet}...]`, "info");
            } else {
              addLog(`⚠ ${fullPath} 빈 내용 또는 접근 불가`, "warning");
              files[fullPath] = "";
            }
          }
        } catch (err) {
          addLog(`⚠ ${fullPath} 수집 실패: ${err.message}`, "warning");
          files[fullPath] = `// Error reading file: ${err.message}`;
        }
      }

      currentScroll += scrollStep;
      if (container && currentScroll > container.scrollHeight) {
        break;
      }
    }

    return files;
  }

  // Wait for the editor to reflect the clicked file before extracting code (eliminates race condition)
  async function waitForEditorToLoadFile(targetPath, fileName, maxWaitMs = 1200) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      // 1. Query injected active editor info
      const activeInfo = await requestActiveFileInfoFromInjected();
      if (activeInfo) {
        const { breadcrumb, activeTab } = activeInfo;
        if (
          (activeTab && (activeTab === fileName || activeTab.endsWith(fileName))) ||
          (breadcrumb && (breadcrumb.includes(fileName) || breadcrumb.includes(targetPath)))
        ) {
          await sleep(60); // Allow CodeMirror doc to finalize
          return true;
        }
      }

      // 2. Direct DOM check for active tab
      const tab = document.querySelector(
        "[role='tab'][aria-selected='true'], [role='tab'][data-state='active'], [role='tab'].active"
      );
      if (tab) {
        const tabText = tab.textContent?.trim() || "";
        if (tabText.includes(fileName)) {
          await sleep(60);
          return true;
        }
      }

      await sleep(50);
    }
    return false;
  }

  // Handle image assets
  async function tryGetImageContent() {
    const imgEl = document.querySelector(
      "main img, .code-viewer img, img[src*='blob:'], img[src*='http']"
    );
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

  async function getEditorContentRobust(filePath, fileName) {
    // 1. 최우선: CodeMirror 6 EditorView / Monaco API / React Fiber 인스턴스에서 원본 텍스트 직접 추출 (100% 무손실)
    try {
      const activeCode = await requestActiveCodeFromInjected(filePath);
      if (activeCode !== null && activeCode !== undefined && typeof activeCode === "string") {
        return cleanCodeText(activeCode);
      }
    } catch (_) {}

    // 2. 2차: 에디터 전용 "Copy file content" 버튼 인터셉트 (에디터 내장 기능, 무손실)
    try {
      const copiedCode = await requestCopyInterceptFromInjected();
      if (copiedCode && typeof copiedCode === "string" && copiedCode.length > 0) {
        return cleanCodeText(copiedCode);
      }
    } catch (err) {
      console.warn("Copy button intercept failed:", err);
    }

    // 3. 3차: CodeMirror 6 DOM 라인별 파싱
    const cmContainer = document.querySelector(".cm-editor, .cm-content");
    if (cmContainer) {
      const cmLines = cmContainer.querySelectorAll(".cm-line");
      if (cmLines.length > 0) {
        const lines = Array.from(cmLines)
          .map((l) => l.textContent || "")
          .join("\n");
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
        if (
          event.data &&
          event.data.type === "LCD_RESPONSE_COPY_INTERCEPT" &&
          event.data.reqId === reqId
        ) {
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
      }, 450);

      function handler(event) {
        if (
          event.data &&
          event.data.type === "LCD_RESPONSE_ACTIVE_CODE" &&
          event.data.reqId === reqId
        ) {
          clearTimeout(timeout);
          window.removeEventListener("message", handler);
          resolve(event.data.code);
        }
      }

      window.addEventListener("message", handler);
      window.postMessage({ type: "LCD_REQUEST_ACTIVE_CODE", filePath, reqId }, "*");
    });
  }

  function requestActiveFileInfoFromInjected() {
    return new Promise((resolve) => {
      const reqId = "req_" + Math.random().toString(36).substr(2, 9);
      const timeout = setTimeout(() => {
        window.removeEventListener("message", handler);
        resolve(null);
      }, 200);

      function handler(event) {
        if (
          event.data &&
          event.data.type === "LCD_RESPONSE_ACTIVE_FILE_INFO" &&
          event.data.reqId === reqId
        ) {
          clearTimeout(timeout);
          window.removeEventListener("message", handler);
          resolve(event.data.info);
        }
      }

      window.addEventListener("message", handler);
      window.postMessage({ type: "LCD_REQUEST_ACTIVE_FILE_INFO", reqId }, "*");
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
