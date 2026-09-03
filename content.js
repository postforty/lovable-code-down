/**
 * Lovable Code Downloader - Content Script (v1.4.0)
 * Zero-Loss Manifest-First Virtualized Tree Crawler & Precision Multi-Tier Code Extractor.
 * [v1.4.0] Multi-Pass Bidirectional Full Sweep & Iterative Scroll Pump for 100% Manifest Discovery.
 */

(function () {
  if (window.__LOVABLE_CODE_DOWNLOADER_INJECTED__) return;
  window.__LOVABLE_CODE_DOWNLOADER_INJECTED__ = true;

  console.log("⚡ Lovable Code Downloader (v1.4.0) active.");

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

      // 5. Merge any remaining state files not traversed in DOM (Safe deduplication)
      for (const [path, content] of Object.entries(stateCache)) {
        const cleanPath = normalizePath(path);
        if (!cleanPath || content === null || content === undefined) continue;

        // If cleanPath has no folder (e.g. "alert.tsx", "project.json"), skip if already in a subdirectory
        if (!cleanPath.includes("/")) {
          const alreadyInSubdir = Object.keys(collectedFiles).some(
            (p) => p.endsWith("/" + cleanPath)
          );
          if (alreadyInSubdir) continue;
        }

        if (!collectedFiles[cleanPath]) {
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
    const allButtons = Array.from(
      document.querySelectorAll("button, [role='tab'], div[role='button'], a, [data-state]")
    );

    const codeTab = allButtons.find((el) => {
      const label = (el.getAttribute("aria-label") || el.getAttribute("title") || "").toLowerCase();
      const text = (el.textContent || "").trim();
      const html = el.innerHTML || "";
      return (
        label === "code" ||
        label.includes("코드") ||
        label.includes("show code") ||
        text === "코드" ||
        text === "Code" ||
        text === "</>" ||
        html.includes("</>") ||
        html.includes("16 18 22 12 16 6") ||
        html.includes("m16 18 6-6-6-6") ||
        html.includes("M16 18L22 12L16 6")
      );
    });

    const previewTab = allButtons.find((el) => {
      const label = (el.getAttribute("aria-label") || el.getAttribute("title") || "").toLowerCase();
      const text = (el.textContent || "").trim();
      return text.includes("미리보기") || label.includes("preview") || text.includes("Preview");
    });

    const isPreviewActive =
      previewTab &&
      (previewTab.getAttribute("aria-selected") === "true" ||
        previewTab.getAttribute("data-state") === "active" ||
        previewTab.classList.contains("active"));

    if (codeTab) {
      const isCodeSelected =
        codeTab.getAttribute("aria-selected") === "true" ||
        codeTab.classList.contains("active") ||
        codeTab.getAttribute("data-state") === "active";

      if (!isCodeSelected || isPreviewActive) {
        addLog("코드(</>) 탭을 활성화합니다.", "info");
        codeTab.click();
        await sleep(500);
      }
    }
  }

  // Find the virtual scroll container for the tree
  function getTreeScrollContainer() {
    // 0. Check known Lovable virtual tree root and scroll candidates that are ACTUALLY scrollable
    const candidateSelectors = [
      "[data-file-tree-virtualized-scroll='true']",
      "[data-file-tree-virtualized-scroll]",
      "[data-file-tree-virtualized-root='true']",
      "#pst_ft_5__tree",
      "[role='tree']",
      "aside [data-radix-scroll-area-viewport]",
      "[data-panel] [data-radix-scroll-area-viewport]",
      "[data-radix-scroll-area-viewport]",
      "aside .overflow-y-auto"
    ];

    for (const sel of candidateSelectors) {
      const el = document.querySelector(sel);
      if (el && el.scrollHeight > el.clientHeight + 10) {
        return el;
      }
    }

    // Traverse upwards from visible treeitems to find actual scroll container
    const treeItems = document.querySelectorAll(
      "[role='treeitem'], [role='tree'] button, div[role='tree'] [tabindex], [data-testid*='file-tree']"
    );
    if (treeItems.length > 0) {
      let el = treeItems[0].parentElement;
      while (el && el !== document.body && el !== document.documentElement) {
        const style = window.getComputedStyle(el);
        const overflowY = style.overflowY;
        const isScrollable =
          (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay" || el.hasAttribute("data-radix-scroll-area-viewport")) &&
          el.scrollHeight > el.clientHeight + 5;

        if (isScrollable) {
          return el;
        }
        el = el.parentElement;
      }
    }

    // Fallback: any matching candidate element
    for (const sel of candidateSelectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }

    return null;
  }

  // Universal Virtual Tree Scroller: directly adjusts scrollTop and fires native scroll events
  function scrollTreeVertically(delta) {
    const candidateSelectors = [
      "[data-file-tree-virtualized-scroll='true']",
      "[data-file-tree-virtualized-scroll]",
      "[data-file-tree-virtualized-root='true']",
      "#pst_ft_5__tree",
      "[data-file-tree-virtualized-wrapper='true']",
      "[role='tree']",
      "aside [data-radix-scroll-area-viewport]",
      "[data-panel] [data-radix-scroll-area-viewport]",
      "[data-radix-scroll-area-viewport]",
      "aside .overflow-y-auto"
    ];

    let scrolled = false;
    for (const sel of candidateSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const prev = el.scrollTop;
        el.scrollTop = Math.max(0, el.scrollTop + delta);
        if (el.scrollTop !== prev) {
          scrolled = true;
        }
        el.dispatchEvent(new Event("scroll", { bubbles: true }));
      }
    }
    return scrolled;
  }

  // Reset tree scroll to absolute top with iterative scroll pumping to force virtualization re-render
  async function resetTreeToTop() {
    const candidateSelectors = [
      "[data-file-tree-virtualized-scroll='true']",
      "[data-file-tree-virtualized-scroll]",
      "[data-file-tree-virtualized-root='true']",
      "#pst_ft_5__tree",
      "[data-file-tree-virtualized-wrapper='true']",
      "[role='tree']",
      "aside [data-radix-scroll-area-viewport]",
      "[data-panel] [data-radix-scroll-area-viewport]",
      "[data-radix-scroll-area-viewport]",
      "aside .overflow-y-auto"
    ];

    // Phase 1: Set scrollTop = 0 on all containers and dispatch scroll events
    for (const sel of candidateSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        el.scrollTop = 0;
        el.dispatchEvent(new Event("scroll", { bubbles: true }));
      }
    }
    await sleep(100);

    // Phase 2: Pump scroll events repeatedly to force virtualized re-render at top
    for (let pump = 0; pump < 3; pump++) {
      for (const sel of candidateSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          el.scrollTop = 0;
          el.dispatchEvent(new Event("scroll", { bubbles: true }));
        }
      }
      // Also try scrollIntoView on the first visible tree item
      const firstItems = getAllTreeElements();
      if (firstItems.length > 0) {
        firstItems[0].scrollIntoView({ block: "start", behavior: "instant" });
      }
      await sleep(80);
    }
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
  // Item explicit path extractor (reads data-item-path and data-item-parent-path)
  function getItemExplicitPath(btn, optLabel) {
    if (!btn) return null;
    const treeItem = typeof btn.closest === "function"
      ? (btn.closest("[role='treeitem'], [data-item-path], [data-item-parent-path], [data-path], [data-filepath], [data-treepath], [data-file-path], [data-full-path]") || btn)
      : btn;

    // 1. Direct explicit path on item
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

    // 2. Parent path combined with label (crucial for items like __root.tsx with data-item-parent-path="src/routes/")
    const parentPath =
      (treeItem.getAttribute && treeItem.getAttribute("data-item-parent-path")) ||
      (btn.getAttribute && btn.getAttribute("data-item-parent-path")) ||
      (treeItem.getAttribute && treeItem.getAttribute("data-parent-path")) ||
      (btn.getAttribute && btn.getAttribute("data-parent-path"));

    if (parentPath) {
      const label = optLabel || getLabel(btn);
      if (label) {
        const cleanParent = normalizePath(parentPath).replace(/\/+$/, "");
        return cleanParent ? `${cleanParent}/${label}` : label;
      }
    }

    return null;
  }

  // Item label extractor
  function getLabel(btn) {
    const treeItem = btn.closest("[role='treeitem'], [data-item-path], [data-item-parent-path], [data-path], [data-filename], [data-name]") || btn;

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
    // Normalize spaced path separators (e.g. "components / ui" -> "components/ui")
    label = label.replace(/\s*\/\s*/g, "/").trim();
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
    const maxPasses = 10;
    let pass = 0;
    let totalOpened = 0;
    const expandedSet = new Set();

    while (pass < maxPasses) {
      if (shouldAbort) break;
      pass++;
      let openedInThisPass = 0;

      // Reset to top
      await resetTreeToTop();
      await sleep(200);

      let noNewElementsStreak = 0;
      let pathStack = [];

      while (noNewElementsStreak < 5) {
        if (shouldAbort) break;

        const visibleItems = getAllTreeElements();
        let actionTaken = false;

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
          const explicitPath = getItemExplicitPath(btn, label);
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
              await sleep(250); // DOM 마운트 대기

              expandedSet.add(folderFullPath);
              openedInThisPass++;
              totalOpened++;
              actionTaken = true;
            }
          }
        }

        // Scroll down
        const didScroll = scrollTreeVertically(100);
        if (visibleItems.length > 0) {
          visibleItems[visibleItems.length - 1].scrollIntoView({ block: "end", behavior: "instant" });
        }

        if (!didScroll && !actionTaken) {
          noNewElementsStreak++;
        } else {
          noNewElementsStreak = 0;
        }

        await sleep(120);
      }

      addLog(`📁 [${pass}회차 스캔 완료] 새로 열린 폴더: ${openedInThisPass}개`, "info");
      if (openedInThisPass === 0) {
        break;
      }
    }

    await resetTreeToTop();
    await sleep(200);
    addLog(`✨ 총 ${totalOpened}개 폴더 확장 완료. 파일 명단 전수 스캔을 준비합니다.`, "success");
  }

  // Find a visible tree element by exact targetPath or label (Multi-tier Precision Matching)
  function findTreeElementByPath(targetPath, targetLabel) {
    const visibleItems = getAllTreeElements();

    // Tier 1: Exact explicitPath match
    for (const btn of visibleItems) {
      const label = getLabel(btn);
      const explicit = getItemExplicitPath(btn, label);
      if (explicit && explicit === targetPath) {
        return btn;
      }
    }

    // Tier 2: data-item-parent-path + label match
    for (const btn of visibleItems) {
      const label = getLabel(btn);
      if (label !== targetLabel) continue;

      const { isFolder } = classifyTreeItem(btn, label);
      if (isFolder) continue;

      const parentAttr =
        btn.getAttribute("data-item-parent-path") ||
        (btn.closest("[data-item-parent-path]") && btn.closest("[data-item-parent-path]").getAttribute("data-item-parent-path"));
      if (parentAttr) {
        const cleanParent = normalizePath(parentAttr).replace(/\/+$/, "");
        const combined = cleanParent ? `${cleanParent}/${label}` : label;
        if (combined === targetPath) {
          return btn;
        }
      }
    }

    // Tier 3: Strict hierarchical depth matching (prevents colliding root vs subfolder files like README.md)
    const targetParts = targetPath.split("/");
    const isRootTarget = targetParts.length === 1;

    for (const btn of visibleItems) {
      const label = getLabel(btn);
      if (label === targetLabel) {
        const { isFolder } = classifyTreeItem(btn, label);
        if (!isFolder) {
          const itemLevel = getItemLevel(btn);
          if (isRootTarget && itemLevel <= 1) {
            return btn;
          }
          if (!isRootTarget && itemLevel > 1) {
            return btn;
          }
        }
      }
    }

    return null;
  }

  // Backup search: scrolls through entire virtual tree from top to bottom if progressive search missed an item
  async function fallbackSearchItem(targetPath, targetLabel) {
    await resetTreeToTop();
    await sleep(200);

    // 스크롤 컨테이너의 실제 높이 기반으로 필요한 탐색 횟수를 동적 계산
    const scrollContainer = getTreeScrollContainer();
    const scrollStep = 90;
    const totalHeight = scrollContainer ? scrollContainer.scrollHeight : 5000;
    const maxAttempts = Math.max(60, Math.ceil(totalHeight / scrollStep) + 10);

    let attempts = 0;
    while (attempts < maxAttempts) {
      if (shouldAbort) break;
      attempts++;

      const found = findTreeElementByPath(targetPath, targetLabel);
      if (found) return found;

      const didScroll = scrollTreeVertically(scrollStep);
      const visible = getAllTreeElements();
      if (visible.length > 0) {
        visible[visible.length - 1].scrollIntoView({ block: "end", behavior: "instant" });
      }

      // 더 이상 스크롤할 수 없으면 트리 끝에 도달한 것이므로 조기 종료
      if (!didScroll) break;

      await sleep(120);
    }
    return findTreeElementByPath(targetPath, targetLabel);
  }

  // 특정 폴더 경로를 찾아 접혀 있으면 확장하는 헬퍼
  async function expandSingleFolder(folderPath) {
    await resetTreeToTop();
    await sleep(200);

    const scrollStep = 90;
    const scrollContainer = getTreeScrollContainer();
    const totalHeight = scrollContainer ? scrollContainer.scrollHeight : 5000;
    const maxAttempts = Math.max(60, Math.ceil(totalHeight / scrollStep) + 10);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (shouldAbort) break;

      const visibleItems = getAllTreeElements();
      for (const btn of visibleItems) {
        const label = getLabel(btn);
        if (!label) continue;
        const explicitPath = getItemExplicitPath(btn, label);
        const { isFolder, isOpen } = classifyTreeItem(btn, label);

        if (isFolder && (explicitPath === folderPath || label === folderPath.split("/").pop())) {
          if (!isOpen) {
            const trigger =
              btn.querySelector("[aria-expanded], [data-state], button:not([aria-label*='more' i]):not([aria-label*='action' i]):not([aria-label*='option' i])") ||
              btn;
            trigger.click();
            await sleep(300);
          }
          return true;
        }
      }

      const didScroll = scrollTreeVertically(scrollStep);
      if (!didScroll) break;
      await sleep(120);
    }
    return false;
  }

  // Phase 2: Complete Manifest Scan (Multi-Pass Bidirectional Full Sweep)
  async function scanAllTreeFilesManifest() {
    const manifestSet = new Set();
    const orderedFiles = [];

    addLog("📋 전체 파일 명단(Manifest) 100% 무누락 전수 스캔 시작...", "info");

    // Inner helper: scan all currently visible items and record new files
    function scanVisibleItems() {
      const visibleItems = getAllTreeElements();
      let pathStack = [];
      let newCount = 0;

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

        const explicitPath = getItemExplicitPath(btn, label);
        const folderPath = pathStack.map((p) => p.name).join("/");
        const fullPath = normalizePath(explicitPath || (folderPath ? `${folderPath}/${label}` : label));

        if (fullPath && !manifestSet.has(fullPath)) {
          manifestSet.add(fullPath);
          orderedFiles.push({ path: fullPath, label: label });
          newCount++;
        }
      }
      return newCount;
    }

    // === Pass 1: Reset to absolute top, then sweep downward ===
    await resetTreeToTop();
    await sleep(300);

    let noNewStreak = 0;
    const maxStreak = 8;

    while (noNewStreak < maxStreak) {
      if (shouldAbort) break;
      const found = scanVisibleItems();

      if (found > 0) {
        noNewStreak = 0;
      } else {
        noNewStreak++;
      }

      scrollTreeVertically(70);
      const visibleItems = getAllTreeElements();
      if (visibleItems.length > 0) {
        visibleItems[visibleItems.length - 1].scrollIntoView({ block: "end", behavior: "instant" });
      }
      await sleep(150);
    }

    const afterPass1 = orderedFiles.length;
    addLog(`📋 [1차 하향 스캔 완료] ${afterPass1}개 파일 발견`, "info");

    // === Pass 2: Reset to top again and sweep downward once more (catches items that were not rendered in Pass 1) ===
    await resetTreeToTop();
    await sleep(300);

    noNewStreak = 0;
    while (noNewStreak < maxStreak) {
      if (shouldAbort) break;
      const found = scanVisibleItems();

      if (found > 0) {
        noNewStreak = 0;
      } else {
        noNewStreak++;
      }

      scrollTreeVertically(70);
      const visibleItems = getAllTreeElements();
      if (visibleItems.length > 0) {
        visibleItems[visibleItems.length - 1].scrollIntoView({ block: "end", behavior: "instant" });
      }
      await sleep(150);
    }

    const afterPass2 = orderedFiles.length;
    if (afterPass2 > afterPass1) {
      addLog(`📋 [2차 보완 스캔 완료] 추가 ${afterPass2 - afterPass1}개 파일 발견 (총 ${afterPass2}개)`, "info");
    }

    await resetTreeToTop();
    await sleep(150);

    addLog(`📋 총 ${orderedFiles.length}개 파일 명단(Manifest) 확정 완료!`, "success");
    return orderedFiles;
  }

  // Phase 3: Targeted File Collection (Progressive Monotonic Streaming Traversal)
  async function collectFilesFromManifest(manifestFiles, stateCache = {}) {
    const files = {};
    const totalFiles = manifestFiles.length;

    // Reset to top of virtual tree once before streaming downwards
    await resetTreeToTop();
    await sleep(300);

    for (let index = 0; index < totalFiles; index++) {
      if (shouldAbort) break;

      // Ensure Code tab is active (prevents preview tab takeover)
      await ensureCodeViewActive();

      const { path: fullPath, label } = manifestFiles[index];
      const progressPercent = Math.round(((index + 1) / totalFiles) * 90);

      updateProgress(
        progressPercent,
        fullPath,
        `파일 수집 중 (${index + 1}/${totalFiles}개)`
      );

      // 1. 메모리 캐시 확인 (있으면 즉시 사용)
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

      // 2. DOM에서 target button 찾기 (현재 위치에서 탐색 시작)
      let targetBtn = findTreeElementByPath(fullPath, label);

      // 현재 화면에 없다면, 아래로 점진 스크롤(Progressive Downward Scroll)하며 탐색!
      let scrollAttempts = 0;
      while (!targetBtn && scrollAttempts < 45) {
        if (shouldAbort) break;
        scrollAttempts++;

        scrollTreeVertically(80);
        const visibleItems = getAllTreeElements();
        if (visibleItems.length > 0) {
          visibleItems[visibleItems.length - 1].scrollIntoView({ block: "end", behavior: "instant" });
        }

        await sleep(120); // 가상화 DOM 마운트 대기
        targetBtn = findTreeElementByPath(fullPath, label);
      }

      // 만약 아래로만 가서 못 찾았다면 백업 전체 탐색 1회 수행
      if (!targetBtn) {
        targetBtn = await fallbackSearchItem(fullPath, label);
      }

      // 여전히 못 찾았고, 하위 폴더 파일이면 부모 폴더가 접혔을 가능성 → 재확장 후 재탐색
      if (!targetBtn && fullPath.includes("/")) {
        const parentDir = fullPath.substring(0, fullPath.lastIndexOf("/"));
        addLog(`🔄 [${index + 1}/${totalFiles}] ${parentDir} 폴더 재확장 시도...`, "info");
        await expandSingleFolder(parentDir);
        targetBtn = await fallbackSearchItem(fullPath, label);
      }

      if (!targetBtn) {
        addLog(`⚠ [${index + 1}/${totalFiles}] ${fullPath} 요소를 트리에서 찾지 못함`, "warning");
        files[fullPath] = `// Error: Item not found in tree: ${fullPath}`;
        continue;
      }

      // 3. 클릭 및 로드 대기 (텍스트 영역 정밀 타겟팅, Escape 키 절대 디스패치 금지)
      targetBtn.scrollIntoView({ block: "center", behavior: "instant" });
      await sleep(60);

      const textTarget =
        targetBtn.querySelector("span:not([aria-hidden]), [data-item-label], .tree-item-label") || targetBtn;
      textTarget.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      textTarget.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
      textTarget.click();
      await sleep(150);

      await waitForEditorToLoadFile(fullPath, label, 1500);

      // 4. 소스코드 추출 및 유효성 검증
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
            let content = await getEditorContentRobust(fullPath, label);

            // 유효하지 않은 가짜 팝업 메뉴 텍스트 방어 ("horizontal", "Options" 등)
            const isInvalidGarbage =
              content === "horizontal" ||
              content === "Options" ||
              content === "more options" ||
              (typeof content === "string" && content.length < 20 && !fullPath.endsWith(".txt") && !fullPath.endsWith(".env") && (content.includes("horizontal") || content.includes("options")));

            if (isInvalidGarbage) {
              await sleep(350);
              const cmContent = document.querySelector(".cm-content");
              if (cmContent && cmContent.textContent) {
                content = cleanCodeText(cmContent.textContent);
              }
            }

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
