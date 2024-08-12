self.importScripts("ExtPay.js");

const extpay = ExtPay("stop-trading");

extpay.startBackground();

const blockedSites = [
  "https://www.tradingview.com/chart/",
  "https://trader.tradovate.com/",
  "https://topstepx.com",
  "https://ninjatrader.com/",
  "https://www.quantower.com",
  "https://www.sierrachart.com",
  "https://www.rithmic.com/rtraderpro",
  "trading",
  "extensions",
];

let isBlocking = false;
let blockUntil = null;
let blockTimer = null;
let customBlockDuration = 15 * 60; // Default duration in seconds (15 minutes)

function getBlockEndTime(duration) {
  const now = new Date();
  return new Date(now.getTime() + duration * 1000);
}

function unblockSites() {
  isBlocking = false;
  blockUntil = null;
  saveBlockingState();
  clearTimeout(blockTimer);
  refreshAllTabs();
}

// Load blocking state from storage when the extension starts
chrome.storage.local.get(
  ["isBlocking", "blockUntil", "customBlockDuration"],
  (result) => {
    isBlocking = result.isBlocking || false;
    blockUntil = result.blockUntil ? new Date(result.blockUntil) : null;
    customBlockDuration = result.customBlockDuration || 15 * 60;

    // Check if the block period has expired
    if (isBlocking && blockUntil) {
      const now = new Date();
      if (now >= blockUntil) {
        unblockSites();
      } else {
        const remainingTime = blockUntil.getTime() - now.getTime();
        blockTimer = setTimeout(unblockSites, remainingTime);
      }
    }
  }
);

function saveBlockingState() {
  chrome.storage.local.set({
    isBlocking: isBlocking,
    blockUntil: blockUntil ? blockUntil.toISOString() : null,
    customBlockDuration: customBlockDuration,
  });
}

chrome.tabs.onCreated.addListener((tab) => {
  if (isBlocking) {
    checkAndBlockTab(tab);
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && isBlocking) {
    checkAndBlockTab(tab);
  }
});

function checkAndBlockTab(tab) {
  if (tab.url) {
    blockedSites.forEach((site) => {
      if (tab.url.includes(site)) {
        chrome.tabs.remove(tab.id, () => {
          if (chrome.runtime.lastError) {
            console.log(
              `Failed to remove tab ${tab.id}: ${chrome.runtime.lastError.message}`
            );
          }
        });
        return;
      }
    });
  }
}

function refreshCurrentTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.reload(tabs[0].id);
    }
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "block_sites") {
    console.log(request);
    isBlocking = true;
    blockUntil = getBlockEndTime(customBlockDuration);
    saveBlockingState();

    // Set a timer to unblock sites when the block period ends
    clearTimeout(blockTimer);
    blockTimer = setTimeout(unblockSites, customBlockDuration * 1000);

    // Refresh all tabs to ensure blocked sites are closed
    refreshCurrentTab();

    const hours = Math.floor(customBlockDuration / 3600);
    const minutes = Math.floor((customBlockDuration % 3600) / 60);
    const timeString =
      hours > 0
        ? `${hours} hours and ${minutes} minutes`
        : `${minutes} minutes`;

    sendResponse({
      blocked: true,
      message: `Sites blocked for the next ${timeString}`,
      blockUntil: blockUntil.toISOString(),
    });
  } else if (request.action === "unblock_sites") {
    const now = new Date();
    if (!blockUntil || now >= blockUntil) {
      unblockSites();
      sendResponse({ blocked: false, message: "Sites unblocked" });
    } else {
      sendResponse({
        blocked: true,
        message: "Cannot unblock until the block period has ended",
        blockUntil: blockUntil.toISOString(),
      });
    }
  } else if (request.action === "get_status") {
    sendResponse({
      isBlocking: isBlocking,
      blockUntil: blockUntil ? blockUntil.toISOString() : null,
    });
  } else if (request.action === "update_duration") {
    customBlockDuration = request.duration;
    saveBlockingState();
    sendResponse({
      message: "Block duration updated successfully",
    });
  }
  return true; // Indicates that the response is sent asynchronously
});
