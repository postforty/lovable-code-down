/**
 * Lovable Code Downloader - Service Worker (Background Script)
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log("Lovable Code Downloader extension installed.");
});

// Handle download requests if needed
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "DOWNLOAD_BLOB_URL") {
    chrome.downloads.download(
      {
        url: message.url,
        filename: message.filename,
        saveAs: true,
      },
      (downloadId) => {
        sendResponse({ downloadId });
      }
    );
    return true;
  }
});
