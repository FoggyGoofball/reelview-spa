// This script is the service worker for the browser extension.

const VIDLINK_HOST = 'vidlink.pro';
const JAIL_URL = 'about:blank';
const JAIL_WINDOW_NAME = 'jail';

// Listen for when a tab is updated
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Check if the updated tab is one of the video streaming sources
  if (
    changeInfo.status === 'loading' &&
    tab.url &&
    (tab.openerTabId || tab.url.includes(VIDLINK_HOST))
  ) {
    const url = new URL(tab.url);

    // If the tab is a new tab opened from our player and is not our intended destination,
    // we can assume it's a pop-up ad.
    if (
      tab.openerTabId &&
      url.hostname !== new URL(chrome.runtime.getURL('index.html')).hostname &&
      !tab.url.startsWith('https://vidlink.pro/ad') && // Allow known ad-related pages if necessary
      !tab.url.startsWith('https://mostream.us/') &&
      !tab.url.startsWith('https://vidsrc.net/') &&
      !tab.url.startsWith('https://godriveplayer.com/')
    ) {
      // It's likely a pop-up. Close it.
      chrome.tabs.remove(tabId);
    }
  }
});

// A more aggressive approach: Intercept and block window.open calls
// This requires more permissions but can be more effective.
chrome.runtime.onInstalled.addListener(() => {
  // This is where you could set up initial configuration if needed.
});
