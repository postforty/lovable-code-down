/**
 * Lovable Code Downloader - Content Script (v1.3.0)
 * Zero-Loss Manifest-First Virtualized Tree Crawler & Precision Multi-Tier Code Extractor.
 */

(function () {
  if (window.__LOVABLE_CODE_DOWNLOADER_INJECTED__) return;
  window.__LOVABLE_CODE_DOWNLOADER_INJECTED__ = true;

  console.log("⚡ Lovable Code Downloader (v1.3.0) active.");

  let isExtracting = false;
  let shouldAbort = false;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function normalizePath(p) {
    if (!p || typeof p !== "string") return "";
    return p.replace(/\\/g, "/").replace(/^(\.\/|\/)+/, "").trim();
  }

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
      // 1. React State 사전 스캔 (메모리에 캐시된 파일 내용 확보)
      addLog("🧠 React 내부 메모리 저장소(TanStack Query/Fiber) 사전 스캔 중...", "info");
      const stateCache = (await requestBulkStateExtraction()) || {};
      const cacheCount = Object.keys(stateCache).length;
      if (cacheCount > 0) {
        addLog(`⚡ 메모리 캐시에서 ${cacheCount}개 파일 데이터 확보 (고속 추출 활용)`, "info");
      }

      // 2. Ensure Code Tab is active
      await ensureCodeViewActive();

      // 3. Step 1: Expand ALL folders in the tree (Full Convergence)
      addLog("📁 파일 트리의 모든 폴더를 전수 순회 및 확장하는 중...", "info");
      await expandAllTreeFolders();

      if (shouldAbort) {
        addLog("수집 작업이 중단되었습니다.", "warning");
        return;
      }

      // 4. Step 2: Scan complete file manifest (100% loss-free discovery)
      addLog("🔍 전체 파일 명단(Manifest) 100% 무누락 전수 스캔 중...", "info");
      const manifestFiles = await scanAllTreeFilesManifest();

      if (shouldAbort) {
        addLog("수집 작업이 중단되었습니다.", "warning");
        return;
      }

      // 5. Step 3: Collect code from confirmed manifest
      addLog("⚡ 확정된 파일 명단 기반 정밀 소스코드 수집 시작...", "info");
      const collectedFiles = await collectFilesFromManifest(manifestFiles, stateCache);

      if (shouldAbort) {
        addLog("수집 작업이 중단되었습니다.", "warning");
        return;
      }

      // 5. Merge any remaining state files not traversed in DOM
      for (const [path, content] of Object.entries(stateCache)) {
        const cleanPath = normalizePath(path);
        if (cleanPath && !collectedFiles[cleanPath] && content !== null && content !== undefined) {
          collectedFiles[cleanPath] = content;
        }
      }

      const fileCount = Object.keys(collectedFiles).length;
      if (fileCount === 0) {
        throw new Error("수집된 파일이 없습니다. 파일 트리가 화면에 보이는지 확인해 주세요.");
      }

      addLog(`✨ 총 ${fileCount}개 파일 수집 완료! ZIP 압축 생성 중...`, "success");
      updateProgress(95, "", "ZIP 파일 패키징 중...");

      // Generate ZIP with normalized relative paths
      const zip = new JSZip();
      for (const [path, content] of Object.entries(collectedFiles)) {
        const cleanPath = normalizePath(path);
        if (!cleanPath) continue;

        if (content instanceof Blob || content instanceof ArrayBuffer || content instanceof Uint8Array) {
          zip.file(cleanPath, content);
        } else if (typeof content === "string" && content.startsWith("data:") && content.includes(";base64,")) {
          const base64Data = content.split(";base64,")[1];
          zip.file(cleanPath, base64Data, { base64: true });
        } else {
          zip.file(cleanPath, String(content));
        }
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
      addLog(`🎉 성공: '${fileName}' (${Math.round(zipBlob.size / 1024)} KB, ${fileCount}개 파일) 다운로드가 완료되었습니다!`, "success");
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
      }, 1200);

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
    // 0. Explicit Lovable virtualized scroll container (Highest priority)
    const lovableVirtualScroll = document.querySelector(
      "[data-file-tree-virtualized-scroll='true'], [data-file-tree-virtualized-scroll]"
    );
    if (lovableVirtualScroll) return lovableVirtualScroll;

    const treeItems = document.querySelectorAll(
      "[role='treeitem'], [role='tree'] button, div[role='tree'] [tabindex], [data-testid*='file-tree']"
    );
    if (treeItems.length > 0) {
      let el = treeItems[0].parentElement;
      while (el && el !== document.body && el !== document.documentElement) {
        const style = window.getComputedStyle(el);
        const overflowY = style.overflowY;
        const isScrollable =
          overflowY === "auto" ||
          overflowY === "scroll" ||
          overflowY === "overlay" ||
          el.hasAttribute("data-radix-scroll-area-viewport") ||
          el.classList.contains("overflow-y-auto");

        if (isScrollable) {
          return el;
        }
        el = el.parentElement;
      }
    }

    const radixViewport = document.querySelector(
      "aside [data-radix-scroll-area-viewport], [data-panel] [data-radix-scroll-area-viewport], [data-radix-scroll-area-viewport], aside .overflow-y-auto, [role='tree']"
    );
    if (radixViewport) return radixViewport;

    return null;
  }

  // Find all visible tree items across document and Shadow DOMs with robust deduplication
  function getAllTreeElements() {
    const queried = document.querySelectorAll(
      "[role='treeitem'], [role='tree'] button, div[role='tree'] [role='button'], [data-item-type], [data-testid*='file-item'], [data-testid*='file-tree'] button, [data-path]"
    );

    const rawElements = [];
    queried.forEach((el) => {
      if (el.offsetParent !== null || el.getBoundingClientRect().height > 0) {
        // Discard action / options / menu popup buttons that are inside a treeitem row
        const ariaLabel = (el.getAttribute("aria-label") || el.getAttribute("title") || "").toLowerCase();
        if (
          ariaLabel.includes("more action") ||
          ariaLabel.includes("more option") ||
          ariaLabel === "options" ||
          ariaLabel === "horizontal"
        ) {
          return;
        }
        rawElements.push(el);
      }
    });

    // Check potential shadow DOM hosts (custom elements, sidebars, tree containers)
    const potentialShadowHosts = document.querySelectorAll(
      "file-tree-container, [data-testid*='tree'], [class*='tree'], aside, [data-panel]"
    );
    potentialShadowHosts.forEach((host) => {
      if (host && host.shadowRoot) {
        host.shadowRoot
          .querySelectorAll("[role='treeitem'], button, [data-item-type], [role='button'], [data-path]")
          .forEach((el) => {
            if (el.getBoundingClientRect().height > 0) {
              const ariaLabel = (el.getAttribute("aria-label") || el.getAttribute("title") || "").toLowerCase();
              if (
                ariaLabel.includes("more action") ||
                ariaLabel.includes("more option") ||
                ariaLabel === "options" ||
                ariaLabel === "horizontal"
              ) {
                return;
              }
              rawElements.push(el);
            }
          });
      }
    });

    // Group items by vertical Y coordinate (same visual row in virtual tree)
    const rowMap = new Map();

    for (const el of rawElements) {
      const rect = el.getBoundingClientRect();
      const y = Math.round(rect.top);
      if (rect.height <= 0 || rect.width <= 0) continue;

      let matchedY = null;
      for (const existingY of rowMap.keys()) {
        if (Math.abs(existingY - y) < 4) {
          matchedY = existingY;
          break;
        }
      }

      if (matchedY !== null) {
        // Replace current candidate if el is more specific (e.g. has role='treeitem' or data-path)
        const current = rowMap.get(matchedY);
        const elIsTreeItem = el.hasAttribute("role") && el.getAttribute("role") === "treeitem";
        const elHasPath = el.hasAttribute("data-path") || el.hasAttribute("data-filename") || el.hasAttribute("aria-expanded");
        const currIsTreeItem = current.hasAttribute("role") && current.getAttribute("role") === "treeitem";
        const currHasPath = current.hasAttribute("data-path") || current.hasAttribute("data-filename") || current.hasAttribute("aria-expanded");

        if ((elIsTreeItem || elHasPath) && (!currIsTreeItem && !currHasPath)) {
          rowMap.set(matchedY, el);
        }
      } else {
        rowMap.set(y, el);
      }
    }

    const uniqueItems = Array.from(rowMap.values());

    // Sort strictly in document top-to-bottom order
    uniqueItems.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);

    return uniqueItems;
  }

  // Item explicit path extractor (reads data-item-path directly from Lovable virtual treeitem)
  function getItemExplicitPath(btn) {
    if (!btn) return null;
    const treeItem = typeof btn.closest === "function"
      ? (btn.closest("[role='treeitem'], [data-item-path], [data-path], [data-filepath], [data-treepath], [data-file-path], [data-full-path]") || btn)
      : btn;

    const explicitPath =
      (treeItem.getAttribute && treeItem.getAttribute("data-item-path")) ||
      (btn.getAttribute && btn.getAttribute("data-item-path")) ||
      (treeItem.getAttribute && treeItem.getAttribute("data-path")) ||
      (btn.getAttribute && btn.getAttribute("data-path")) ||
      (treeItem.getAttribute && treeItem.getAttribute("data-filepath")) ||
      (btn.getAttribute && btn.getAttribute("data-filepath")) ||
      (treeItem.getAttribute && treeItem.getAttribute("data-treepath")) ||
      (btn.getAttribute && btn.getAttribute("data-treepath")) ||
      (treeItem.getAttribute && treeItem.getAttribute("data-file-path")) ||
      (btn.getAttribute && btn.getAttribute("data-file-path")) ||
      (treeItem.getAttribute && treeItem.getAttribute("data-full-path")) ||
      (btn.getAttribute && btn.getAttribute("data-full-path"));

    if (explicitPath) {
      return normalizePath(explicitPath).replace(/\/+$/, "");
    }
    return null;
  }

  // Item label extractor
  function getLabel(btn) {
    const treeItem = btn.closest("[role='treeitem'], [data-item-path], [data-path], [data-filename], [data-name]") || btn;

    const directName =
      treeItem.getAttribute("data-filename") ||
      treeItem.getAttribute("data-name") ||
      btn.getAttribute("data-filename") ||
      btn.getAttribute("data-name");
    if (directName) return directName.trim();

    const dataPath =
      treeItem.getAttribute("data-item-path") ||
      btn.getAttribute("data-item-path") ||
      treeItem.getAttribute("data-path") ||
      btn.getAttribute("data-path");
    if (dataPath) {
      const cleanPath = dataPath.replace(/\\/g, "/").replace(/\/+$/, "");
      const parts = cleanPath.split("/");
      if (parts.length > 0 && parts[parts.length - 1].trim().length > 0) {
        return parts[parts.length - 1].trim();
      }
    }

    let label = btn.getAttribute("aria-label") || treeItem.getAttribute("aria-label") || "";
    if (!label || label === "Options" || label === "More actions" || label === "horizontal") {
      const textEls = btn.querySelectorAll("span, p, div");
      for (const t of textEls) {
        if (t.children.length === 0 && t.textContent && t.textContent.trim().length > 0) {
          const txt = t.textContent.trim();
          if (txt !== "Options" && txt !== "horizontal" && !/^\d+$/.test(txt)) {
            label = txt;
            break;
          }
        }
      }
    }

    if (!label) {
      label = btn.innerText || btn.textContent || "";
      label = label.split("\n")[0].trim();
    }

    // Clean up count badges (e.g. "src (12)" -> "src")
    label = label.replace(/\s*\(\d+\)$/, "").trim();
    return label;
  }

  // Item depth level calculation
  function getItemLevel(btn) {
    const treeItem = btn.closest("[role='treeitem'], [data-depth], [data-level], [aria-level]") || btn;

    // 1. WAI-ARIA standard aria-level
    const ariaLevel = treeItem.getAttribute("aria-level") || btn.getAttribute("aria-level");
    if (ariaLevel) {
      return parseInt(ariaLevel, 10);
    }

    // 2. data-depth or data-level
    const dataDepth =
      treeItem.getAttribute("data-depth") ||
      treeItem.getAttribute("data-level") ||
      btn.getAttribute("data-depth") ||
      btn.getAttribute("data-level");
    if (dataDepth !== null && dataDepth !== undefined) {
      return parseInt(dataDepth, 10);
    }

    // 3. CSS variables --depth, --level, --indent, --tree-depth
    const styleAttr = (treeItem.getAttribute("style") || "") + " " + (btn.getAttribute("style") || "");
    const depthMatch = styleAttr.match(/--(?:depth|level|indent|tree-depth|item-depth):\s*(\d+)/i);
    if (depthMatch) {
      return parseInt(depthMatch[1], 10);
    }

    // 4. Inline style padding-left or margin-left (e.g. padding-left: 24px or 1.5rem)
    const plInlineMatch = styleAttr.match(/padding-left:\s*([\d.]+)px/i);
    if (plInlineMatch) {
      return Math.max(0, Math.round(parseFloat(plInlineMatch[1]) / 12));
    }
    const plRemMatch = styleAttr.match(/padding-left:\s*([\d.]+)rem/i);
    if (plRemMatch) {
      return Math.max(0, Math.round((parseFloat(plRemMatch[1]) * 16) / 12));
    }

    // 5. Tailwind class inspection (e.g. pl-2, pl-4, pl-6, pl-8, ml-2...)
    const classNames = (treeItem.className || "") + " " + (btn.className || "");
    const plMatch = classNames.match(/(?:pl|ml|indent)-(\d+)/);
    if (plMatch) {
      const units = parseInt(plMatch[1], 10);
      return Math.max(0, Math.round(units / 2));
    }

    // 6. Computed paddingLeft/marginLeft and visual offset
    const computedItemStyle = window.getComputedStyle(treeItem);
    const computedBtnStyle = window.getComputedStyle(btn);
    const pl = (parseFloat(computedItemStyle.paddingLeft) || 0) + (parseFloat(computedBtnStyle.paddingLeft) || 0);
    const ml = (parseFloat(computedItemStyle.marginLeft) || 0) + (parseFloat(computedBtnStyle.marginLeft) || 0);

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

  // Accurate Tree Item Classifier (distinguishes folders vs extensionless files vs dot-folders)
  function classifyTreeItem(el, label) {
    const treeItem = (el && typeof el.closest === "function")
      ? (el.closest("[role='treeitem'], [data-state], [aria-expanded], [data-item-type]") || el)
      : (el || null);

    // 0. Explicit data-item-type / data-type (Lovable virtual tree standard)
    const itemType =
      (el && el.getAttribute ? el.getAttribute("data-item-type") || el.getAttribute("data-type") : null) ||
      (treeItem && treeItem.getAttribute ? treeItem.getAttribute("data-item-type") || treeItem.getAttribute("data-type") : null);

    const ariaExpanded = (el && el.getAttribute ? el.getAttribute("aria-expanded") : null) ||
                         (treeItem && treeItem.getAttribute ? treeItem.getAttribute("aria-expanded") : null);

    if (itemType === "folder" || itemType === "directory") {
      if (ariaExpanded === "true") return { isFolder: true, isOpen: true };
      if (ariaExpanded === "false") return { isFolder: true, isOpen: false };
      return { isFolder: true, isOpen: isElementVisuallyExpanded(el, treeItem) };
    }
    if (itemType === "file") return { isFolder: false, isOpen: false };

    if (!label) return { isFolder: false, isOpen: false };

    // 1. Explicit aria-expanded (W3C standard for tree folders)
    if (ariaExpanded === "true") return { isFolder: true, isOpen: true };
    if (ariaExpanded === "false") return { isFolder: true, isOpen: false };

    // 2. Explicit data-state (Radix Collapsible / Tree standard)
    const dataState = (el && el.getAttribute ? el.getAttribute("data-state") : null) ||
                      (treeItem && treeItem.getAttribute ? treeItem.getAttribute("data-state") : null);
    if (dataState === "open") return { isFolder: true, isOpen: true };
    if (dataState === "closed") return { isFolder: true, isOpen: false };

    // 4. SVG icon inspection (Chevron, Folder vs File icons)
    const svgs = (treeItem && treeItem.querySelectorAll ? treeItem.querySelectorAll("svg") : []) ||
                 (el && el.querySelectorAll ? el.querySelectorAll("svg") : []);
    let hasChevron = false;
    let isChevronOpen = false;
    let hasFolderIcon = false;

    for (const svg of svgs) {
      const cls = (svg.getAttribute && svg.getAttribute("class") || "") + " " + (svg.className?.baseVal || svg.className || "");
      const html = svg.innerHTML || "";

      // Chevron detection
      if (
        cls.includes("chevron") ||
        cls.includes("lucide-chevron") ||
        html.includes("6 9 12 15 18 9") ||
        html.includes("9 18 15 12 9 6") ||
        html.includes("m9 18 6-6-6-6") ||
        html.includes("m6 9 6 6 6-6") ||
        html.includes("M9 18L15 12L9 6") ||
        html.includes("M6 9L12 15L18 9")
      ) {
        hasChevron = true;
        if (
          cls.includes("rotate-90") ||
          cls.includes("rotate-180") ||
          cls.includes("open") ||
          html.includes("6 9 12 15 18 9") ||
          html.includes("m6 9 6 6 6-6") ||
          html.includes("M6 9L12 15L18 9")
        ) {
          isChevronOpen = true;
        }
      }

      // Folder icon detection
      if (
        cls.includes("folder") ||
        cls.includes("lucide-folder") ||
        html.includes("M4 20h16") ||
        html.includes("M22 19a2 2 0 0 1-2 2H4") ||
        html.includes("M20 20a2 2 0 0 0 2-2V8")
      ) {
        hasFolderIcon = true;
        if (cls.includes("folder-open") || cls.includes("lucide-folder-open")) {
          isChevronOpen = true;
        }
      }
    }

    if (hasChevron || hasFolderIcon) {
      return { isFolder: true, isOpen: isChevronOpen };
    }

    // 5. Special exact files (extensionless or multi-part dotfiles or cloud configs)
    const knownExactFiles = new Set([
      "Dockerfile", "Dockerfile.dev", "Dockerfile.prod", "Dockerfile.local", "Containerfile",
      "LICENSE", "LICENCE", "LICENSE-MIT", "LICENSE-APACHE", "LICENSE-2.0", "LICENSE.md", "LICENSE.txt",
      "UNLICENSE", "COPYING", "AUTHORS", "CONTRIBUTING", "CONTRIBUTING.md", "CHANGELOG", "CHANGELOG.md",
      "CODE_OF_CONDUCT", "CODE_OF_CONDUCT.md", "SECURITY", "SECURITY.md", "Makefile", "CNAME",
      "Procfile", "Gemfile", "Rakefile", "Brewfile", "README", "README.md", "_headers", "_redirects",
      ".gitignore", ".npmignore", ".prettierignore", ".eslintignore", ".editorconfig",
      ".env", ".env.local", ".env.development", ".env.production", ".env.test",
      ".env.example", ".env.sample", ".env.staging", ".env.preview", ".env.test.local",
      ".env.development.local", ".env.production.local", ".npmrc", ".nvmrc",
      ".node-version", ".tool-versions", ".yarnrc", ".yarnrc.yml", ".yarnrc.yaml",
      "robots.txt", "humans.txt", "browserslist", ".babelrc", ".gitattributes", ".gitmodules",
      ".dockerignore", ".gitkeep", ".stylelintrc", ".stylelintignore", ".postcssrc",
      ".browserslistrc", ".lintstagedrc", ".eslintrc", ".prettierrc", ".commitlintrc",
      "bun.lock", "bun.lockb", "pnpm-lock.yaml", "package-lock.json", "yarn.lock",
      "Cargo.lock", "Cargo.toml", "go.mod", "go.sum", "composer.lock", "composer.json",
      "Pipfile", "Pipfile.lock", "pyproject.toml", "requirements.txt",
      ".cursorrules", ".watchmanconfig", ".solhintignore", ".vercelignore", ".swcrc", ".releaserc"
    ]);
    if (knownExactFiles.has(label)) {
      return { isFolder: false, isOpen: false };
    }

    // 6. Dot-folders (strictly directories)
    const knownDotFolders = new Set([
      ".lovable", ".github", ".vscode", ".husky", ".git", ".next", ".circleci",
      ".devcontainer", ".cursor", ".idea", ".agents", ".agent", ".claude",
      ".changeset", ".storybook", ".turbo", ".wrangler", ".expo", ".output",
      ".contentlayer", ".docusaurus", ".yarn", ".nuxt", ".svelte-kit", ".vercel", ".netlify"
    ]);
    if (knownDotFolders.has(label)) {
      return { isFolder: true, isOpen: isChevronOpen };
    }

    // 7. Standard file extension check (e.g. accordion.tsx, vite.config.ts, project.json, vite-env.d.ts)
    const lastDot = label.lastIndexOf(".");
    if (lastDot > 0) {
      const ext = label.slice(lastDot + 1).toLowerCase();
      const knownExtensions = new Set([
        "ts", "tsx", "js", "jsx", "mjs", "cjs", "mts", "cts", "json", "json5", "jsonc",
        "css", "scss", "sass", "less", "html", "htm", "md", "mdx", "txt", "yaml", "yml",
        "toml", "xml", "svg", "png", "jpg", "jpeg", "gif", "ico", "webp", "bmp", "tiff",
        "woff", "woff2", "ttf", "eot", "otf", "map", "lock", "lockb", "env", "config",
        "wasm", "sh", "bash", "sql", "prisma", "graphql", "gql", "astro", "svelte", "vue"
      ]);
      if (knownExtensions.has(ext) || /^[a-z0-9]{1,12}$/i.test(ext)) {
        return { isFolder: false, isOpen: false };
      }
    }

    // 8. Other dot-prefixed names not in knownDotFolders default to files
    if (label.startsWith(".")) {
      return { isFolder: false, isOpen: false };
    }

    // 9. Fallback: names without extension are treated as folders
    return { isFolder: true, isOpen: isChevronOpen };
  }

  function isElementVisuallyExpanded(el, treeItem) {
    const container = treeItem || el;
    if (!container || !container.querySelectorAll) return false;
    const svgs = container.querySelectorAll("svg");
    for (const svg of svgs) {
      const cls = (svg.getAttribute("class") || "") + " " + (svg.className?.baseVal || svg.className || "");
      const html = svg.innerHTML || "";
      if (
        cls.includes("rotate-90") ||
        cls.includes("rotate-180") ||
        cls.includes("open") ||
        cls.includes("folder-open") ||
        html.includes("6 9 12 15 18 9") ||
        html.includes("m6 9 6 6 6-6") ||
        html.includes("M6 9L12 15L18 9")
      ) {
        return true;
      }
    }
    return false;
  }

  // Deterministically expand ALL closed folders across the virtual tree (Full Convergence)
  async function expandAllTreeFolders() {
    const container = getTreeScrollContainer();
    const maxPasses = 10;
    let pass = 0;
    let totalOpened = 0;
    const expandedSet = new Set();

    while (pass < maxPasses) {
      if (shouldAbort) break;
      pass++;
      let openedInThisPass = 0;

      if (container) {
        container.scrollTop = 0;
        await sleep(150);
      }

      let currentScroll = 0;
      const scrollStep = container ? Math.max(80, Math.floor(container.clientHeight * 0.35)) : 100;
      let pathStack = [];

      while (true) {
        if (shouldAbort) break;

        if (container) {
          container.scrollTop = currentScroll;
          await sleep(100);
        }

        const visibleItems = getAllTreeElements();
        for (let i = 0; i < visibleItems.length; i++) {
          if (shouldAbort) break;

          const btn = visibleItems[i];
          const label = getLabel(btn);
          if (!label || label === "Options" || label === "horizontal" || label === "More actions") continue;

          const level = getItemLevel(btn);
          const { isFolder, isOpen } = classifyTreeItem(btn, label);

          while (pathStack.length > 0 && pathStack[pathStack.length - 1].level >= level) {
            pathStack.pop();
          }

          const parentFolder = pathStack.map((p) => p.name).join("/");
          const explicitPath = getItemExplicitPath(btn);
          const folderFullPath = normalizePath(explicitPath || (parentFolder ? `${parentFolder}/${label}` : label));

          if (isFolder) {
            pathStack.push({ level: level, name: label });

            if (!isOpen) {
              if (expandedSet.has(folderFullPath)) {
                continue;
              }

              addLog(`📂 [${pass}회차] 폴더 확장: ${folderFullPath}`, "info");

              const trigger =
                btn.querySelector("[aria-expanded], [data-state], button:not([aria-label*='more' i]):not([aria-label*='action' i]):not([aria-label*='option' i])") ||
                btn;
              trigger.click();
              await sleep(250); // 충분한 가상화 DOM 마운트 대기

              expandedSet.add(folderFullPath);
              openedInThisPass++;
              totalOpened++;
            }
          }
        }

        const maxScroll = container ? Math.max(0, container.scrollHeight - container.clientHeight) : 0;
        if (!container || currentScroll >= maxScroll) {
          break;
        }
        currentScroll = Math.min(currentScroll + scrollStep, maxScroll);
      }

      addLog(`📁 [${pass}회차 스캔 완료] 새로 열린 폴더: ${openedInThisPass}개`, "info");
      if (openedInThisPass === 0) {
        break;
      }
    }

    if (container) {
      container.scrollTop = 0;
      await sleep(200);
    }
    addLog(`✨ 총 ${totalOpened}개 폴더 확장 완료. 파일 명단 전수 스캔을 준비합니다.`, "success");
  }

  // Find a visible tree element by exact targetPath or label
  function findTreeElementByPath(targetPath, targetLabel) {
    const visibleItems = getAllTreeElements();
    for (const btn of visibleItems) {
      const explicit = getItemExplicitPath(btn);
      if (explicit && explicit === targetPath) {
        return btn;
      }
      const label = getLabel(btn);
      if (label === targetLabel) {
        const { isFolder } = classifyTreeItem(btn, label);
        if (!isFolder) {
          if (!targetPath.includes("/") || targetPath.endsWith("/" + label)) {
            return btn;
          }
        }
      }
    }
    return null;
  }

  // Scroll through virtual container to locate and mount a specific tree item
  async function searchAndScrollToItem(container, targetPath, targetLabel) {
    if (!container) return null;
    const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
    const scrollStep = Math.max(80, Math.floor(container.clientHeight * 0.4));
    let cur = 0;

    // Search from top to bottom
    while (cur <= maxScroll) {
      if (shouldAbort) break;
      container.scrollTop = cur;
      await sleep(90);

      const found = findTreeElementByPath(targetPath, targetLabel);
      if (found) return found;

      if (cur >= maxScroll) break;
      cur = Math.min(cur + scrollStep, maxScroll);
    }

    return null;
  }

  // Phase 2: Complete Manifest Scan (100% loss-free discovery of all file paths)
  async function scanAllTreeFilesManifest() {
    const container = getTreeScrollContainer();
    const manifestSet = new Set();
    const orderedFiles = [];

    if (container) {
      container.scrollTop = 0;
      await sleep(200);
    }

    addLog("📋 전체 파일 명단(Manifest) 100% 무누락 전수 스캔 시작...", "info");

    let currentScroll = 0;
    const scrollStep = container ? Math.max(48, Math.floor(container.clientHeight * 0.25)) : 64;
    let pathStack = [];

    while (true) {
      if (shouldAbort) break;

      if (container) {
        container.scrollTop = currentScroll;
        await sleep(100); // 가상화 렌더링 안정화 대기
      }

      const visibleItems = getAllTreeElements();
      for (let i = 0; i < visibleItems.length; i++) {
        const btn = visibleItems[i];
        const label = getLabel(btn);
        if (!label || label === "Options" || label === "horizontal" || label === "More actions") continue;

        const level = getItemLevel(btn);
        const { isFolder } = classifyTreeItem(btn, label);

        while (pathStack.length > 0 && pathStack[pathStack.length - 1].level >= level) {
          pathStack.pop();
        }

        if (isFolder) {
          pathStack.push({ level: level, name: label });
          continue;
        }

        // File: resolve full path
        const explicitPath = getItemExplicitPath(btn);
        const folderPath = pathStack.map((p) => p.name).join("/");
        const fullPath = normalizePath(explicitPath || (folderPath ? `${folderPath}/${label}` : label));

        if (fullPath && !manifestSet.has(fullPath)) {
          manifestSet.add(fullPath);
          orderedFiles.push({ path: fullPath, label: label });
        }
      }

      const maxScroll = container ? Math.max(0, container.scrollHeight - container.clientHeight) : 0;
      if (!container || currentScroll >= maxScroll) {
        break;
      }
      currentScroll = Math.min(currentScroll + scrollStep, maxScroll);
    }

    if (container) {
      container.scrollTop = 0;
      await sleep(150);
    }

    addLog(`📋 총 ${orderedFiles.length}개 파일 명단(Manifest) 확정 완료!`, "success");
    return orderedFiles;
  }

  // Phase 3: Targeted File Collection (Reliably scrolls to and opens each file from Manifest)
  async function collectFilesFromManifest(manifestFiles, stateCache = {}) {
    const files = {};
    const container = getTreeScrollContainer();
    const totalFiles = manifestFiles.length;

    if (container) {
      container.scrollTop = 0;
      await sleep(150);
    }

    for (let index = 0; index < totalFiles; index++) {
      if (shouldAbort) break;

      const { path: fullPath, label } = manifestFiles[index];
      const progressPercent = Math.round(((index + 1) / totalFiles) * 90);

      updateProgress(
        progressPercent,
        fullPath,
        `파일 수집 중 (${index + 1}/${totalFiles}개)`
      );

      // 1. 메모리 캐시 확인 (있으면 클릭 없이 즉시 저장)
      const cachedCode =
        stateCache[fullPath] !== undefined
          ? stateCache[fullPath]
          : stateCache[`/${fullPath}`] !== undefined
          ? stateCache[`/${fullPath}`]
          : !fullPath.includes("/") && stateCache[label] !== undefined
          ? stateCache[label]
          : undefined;

      if (cachedCode !== undefined && cachedCode !== null) {
        files[fullPath] = cachedCode;
        const previewSnippet = typeof cachedCode === "string" ? cachedCode.replace(/\s+/g, " ").slice(0, 35) : "asset";
        addLog(`✔ [${index + 1}/${totalFiles}][캐시] ${fullPath} [${previewSnippet}...]`, "info");
        continue;
      }

      // 2. DOM에서 target button 찾기
      let targetBtn = findTreeElementByPath(fullPath, label);

      // 현재 화면에 없다면 가상 스크롤로 탐색 (Search scroll)
      if (!targetBtn && container) {
        targetBtn = await searchAndScrollToItem(container, fullPath, label);
      }

      if (!targetBtn) {
        addLog(`⚠ [${index + 1}/${totalFiles}] ${fullPath} 요소를 트리에서 찾지 못함`, "warning");
        files[fullPath] = `// Error: Item not found in tree: ${fullPath}`;
        continue;
      }

      // 3. 클릭 및 로드 대기
      targetBtn.scrollIntoView({ block: "center" });
      await sleep(50);
      targetBtn.click();

      await waitForEditorToLoadFile(fullPath, label);

      // 4. 소스코드 추출 (실패 시 1회 재시도)
      let extracted = false;
      for (let attempt = 1; attempt <= 2 && !extracted; attempt++) {
        try {
          const isBinaryAsset = /\.(jpg|jpeg|png|webp|gif|ico|bmp|woff|woff2|ttf|eot)$/i.test(fullPath);
          if (isBinaryAsset) {
            const imgContent = await tryGetImageContent(fullPath);
            files[fullPath] = imgContent || "// Asset: " + fullPath;
            addLog(`✔ [${index + 1}/${totalFiles}][에셋] ${fullPath}`, "info");
            extracted = true;
          } else {
            const content = await getEditorContentRobust(fullPath, label);
            if (content !== null && content !== undefined && (content.length > 0 || !fullPath.endsWith(".svg"))) {
              files[fullPath] = content;
              const previewSnippet = content.replace(/\s+/g, " ").slice(0, 35);
              addLog(`✔ [${index + 1}/${totalFiles}] ${fullPath} (${content.length} B) [${previewSnippet}...]`, "info");
              extracted = true;
            } else if (fullPath.endsWith(".svg")) {
              const svgContent = await tryGetImageContent(fullPath);
              files[fullPath] = svgContent || content || "";
              addLog(`✔ [${index + 1}/${totalFiles}][에셋-SVG] ${fullPath}`, "info");
              extracted = true;
            } else {
              if (attempt === 1) {
                targetBtn.click();
                await sleep(400);
              } else {
                addLog(`⚠ [${index + 1}/${totalFiles}] ${fullPath} 빈 내용 또는 접근 불가`, "warning");
                files[fullPath] = "";
                extracted = true;
              }
            }
          }
        } catch (err) {
          if (attempt === 1) {
            await sleep(300);
          } else {
            addLog(`⚠ [${index + 1}/${totalFiles}] ${fullPath} 수집 실패: ${err.message}`, "warning");
            files[fullPath] = `// Error reading file: ${err.message}`;
            extracted = true;
          }
        }
      }
    }

    return files;
  }

  // Deterministically collect all files with monotonic top-to-bottom virtual scroll (Manifest-first)
  async function collectAllTreeFiles(stateCache = {}) {
    const manifestFiles = await scanAllTreeFilesManifest();
    return await collectFilesFromManifest(manifestFiles, stateCache);
  }

  // Wait for the editor to reflect the clicked file before extracting code (eliminates race condition)
  async function waitForEditorToLoadFile(targetPath, fileName, maxWaitMs = 1200) {
    const start = Date.now();
    const pathParts = targetPath.split("/").filter(Boolean);
    const parentName = pathParts.length > 1 ? pathParts[pathParts.length - 2] : null;

    while (Date.now() - start < maxWaitMs) {
      // 1. Query injected active editor info
      const activeInfo = await requestActiveFileInfoFromInjected();
      if (activeInfo) {
        const { breadcrumb, activeTab } = activeInfo;
        const matchesTab = activeTab && (activeTab === fileName || activeTab.endsWith(fileName));
        const matchesBreadcrumb = breadcrumb && (breadcrumb.includes(fileName) || breadcrumb.includes(targetPath));

        if (matchesBreadcrumb) {
          await sleep(60); // Allow CodeMirror doc to finalize
          return true;
        }

        if (matchesTab) {
          // If the file is in a subfolder and we have a breadcrumb, ensure breadcrumb matches parent folder
          if (parentName && breadcrumb && !breadcrumb.includes(parentName)) {
            // Still displaying old tab with same fileName from another folder
          } else {
            await sleep(60);
            return true;
          }
        }
      }

      // 2. Direct DOM check for active tab
      const tab = document.querySelector(
        "[role='tab'][aria-selected='true'], [role='tab'][data-state='active'], [role='tab'].active, .tab-active"
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

  // Handle image and binary assets
  async function tryGetImageContent(fullPath) {
    // Check main image viewers
    const imgEl = document.querySelector(
      "main img, .code-viewer img, img[src*='blob:'], img[src*='http'], [data-panel] img"
    );
    if (imgEl && imgEl.src) {
      try {
        const res = await fetch(imgEl.src);
        return await res.blob();
      } catch (_) {}
    }

    // Check SVG element
    const svgEl = document.querySelector("main .code-viewer svg, [data-panel] svg");
    if (svgEl && fullPath.endsWith(".svg")) {
      return svgEl.outerHTML;
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
