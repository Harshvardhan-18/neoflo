// Background Service Worker stub for Visual AI Agent Extension
console.log('[Visual AI Agent] Background service worker initialized.');

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Visual AI Agent] Extension installed/updated:', details.reason);
});
