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

function getBlockEndTime() {
  const now = new Date();
  return new Date(now.getTime() + 7.5 * 60 * 60 * 1000); // 7 hours and 30 minutes from now
}

function unblockSites() {
  isBlocking = false;
  blockUntil = null;
  saveBlockingState();
  clearTimeout(blockTimer);
  refreshAllTabs();
}

// Load blocking state from storage when the extension starts
chrome.storage.local.get(["isBlocking", "blockUntil"], (result) => {
  isBlocking = result.isBlocking || false;
  blockUntil = result.blockUntil ? new Date(result.blockUntil) : null;

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
});

function saveBlockingState() {
  chrome.storage.local.set({
    isBlocking: isBlocking,
    blockUntil: blockUntil ? blockUntil.toISOString() : null,
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

function refreshAllTabs() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      chrome.tabs.reload(tab.id);
    });
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "block_sites") {
    isBlocking = true;
    blockUntil = getBlockEndTime();
    saveBlockingState();

    // Set a timer to unblock sites when the block period ends
    clearTimeout(blockTimer);
    blockTimer = setTimeout(unblockSites, 15 * 1000); // 15 seconds

    // Refresh all tabs to ensure blocked sites are closed
    refreshAllTabs();

    sendResponse({
      blocked: true,
      message: "Sites blocked for the next 15 seconds",
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
  }
  return true; // Indicates that the response is sent asynchronously
});
