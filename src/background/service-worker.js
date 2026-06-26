// Background service worker — handles extension lifecycle and message routing.

importScripts("../storage/storage.js");

chrome.runtime.onInstalled.addListener(async () => {
  await PromptStorage.initializeDefaults();
  console.log("[Prompt Toolkit] Storage initialized");
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "PING") {
    sendResponse({ ok: true });
    return;
  }

  if (message.type === "STORAGE_REQUEST") {
    handleStorageRequest(message.method, message.args)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});

async function handleStorageRequest(method, args = []) {
  const fn = PromptStorage[method];
  if (typeof fn !== "function") {
    throw new Error(`Unknown storage method: ${method}`);
  }
  return fn(...args);
}
