/**
 * Lovable Code Downloader - Popup Script
 */

document.addEventListener("DOMContentLoaded", async () => {
  const downloadBtn = document.getElementById("download-btn");
  const projectNameEl = document.getElementById("project-name");
  const statusBadge = document.getElementById("status-badge");
  const alertBox = document.getElementById("lovable-alert");

  // Helper to safely send message to content script
  async function sendMessageToTab(tabId, message) {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        // Read lastError to prevent "Unchecked runtime.lastError"
        if (chrome.runtime.lastError) {
          const err = chrome.runtime.lastError.message;
          resolve({ error: err });
        } else {
          resolve({ response });
        }
      });
    });
  }

  // Ensure content script and CSS are injected if the tab was loaded before extension install
  async function ensureInjected(tabId) {
    try {
      await chrome.scripting.insertCSS({
        target: { tabId },
        files: ["content.css"],
      }).catch(() => {});

      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["lib/jszip.min.js", "content.js"],
      }).catch(() => {});
    } catch (e) {
      console.warn("Dynamic injection fallback:", e);
    }
  }

  // Query current active tab
  let tab;
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    tab = tabs[0];
  } catch (e) {
    console.error("Tab query failed:", e);
  }

  if (!tab || !tab.url || (!tab.url.includes("lovable.dev") && !tab.url.includes("lovable.app"))) {
    projectNameEl.textContent = "Lovable 페이지 아님";
    alertBox.style.display = "block";
    downloadBtn.disabled = true;
    statusBadge.textContent = "비활성";
    return;
  }

  statusBadge.textContent = "연결됨";
  statusBadge.classList.add("active");

  // Attempt to contact content script, inject if not yet present
  let result = await sendMessageToTab(tab.id, { action: "GET_STATUS" });
  if (result.error) {
    // Content script not loaded yet (e.g. page was open before extension install)
    await ensureInjected(tab.id);
    result = await sendMessageToTab(tab.id, { action: "GET_STATUS" });
  }

  if (result && result.response) {
    projectNameEl.textContent = result.response.projectName || "Lovable 프로젝트";
    if (result.response.isExtracting) {
      downloadBtn.disabled = true;
      downloadBtn.textContent = "다운로드 진행 중...";
      statusBadge.textContent = "진행 중";
    }
  } else {
    projectNameEl.textContent = "Lovable 프로젝트 감지됨";
  }

  // Trigger download flow
  downloadBtn.addEventListener("click", async () => {
    downloadBtn.disabled = true;
    downloadBtn.textContent = "다운로드 시작 중...";

    let sendRes = await sendMessageToTab(tab.id, { action: "START_DOWNLOAD" });
    if (sendRes.error) {
      await ensureInjected(tab.id);
      await sendMessageToTab(tab.id, { action: "START_DOWNLOAD" });
    }

    setTimeout(() => {
      window.close(); // Close popup so user sees progress overlay on page
    }, 200);
  });
});
