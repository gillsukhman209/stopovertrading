let isBlocked = false;
let blockEndTime = null;

function updateStatus() {
  const statusElement = document.getElementById("current-status");
  chrome.runtime.sendMessage({ action: "get_status" }, function (response) {
    const actuallyBlocked = response.isBlocking;
    statusElement.textContent = actuallyBlocked ? "Blocked" : "Unblocked";
    statusElement.style.color = actuallyBlocked ? "#e74c3c" : "#2ecc71";
    isBlocked = actuallyBlocked;
    blockEndTime = response.blockUntil;
  });
}

function updateButtonStates() {
  const blockButton = document.getElementById("block-websites");
  const countdownElement = document.getElementById("countdown");

  if (isBlocked && blockEndTime) {
    const remainingTime = Math.max(0, new Date(blockEndTime) - Date.now());
    const hours = Math.floor(remainingTime / (60 * 60 * 1000));
    const minutes = Math.floor(
      (remainingTime % (60 * 60 * 1000)) / (60 * 1000)
    );
    const seconds = Math.floor((remainingTime % (60 * 1000)) / 1000);

    countdownElement.textContent = `${hours
      .toString()
      .padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
    blockButton.disabled = true;
    blockButton.style.opacity = "0.5";
  } else {
    countdownElement.textContent = "";
    blockButton.disabled = false;
    blockButton.style.opacity = "1";
  }
}

function showResponse(response) {
  const responseElement = document.getElementById("response-message");
  responseElement.textContent = response.message;
  responseElement.className = response.blocked ? "success" : "error";
}

function saveToLocalStorage(isBlocking, blockUntil) {
  localStorage.setItem("isBlocked", JSON.stringify(isBlocking));
  localStorage.setItem("blockEndTime", JSON.stringify(blockUntil));
  isBlocked = isBlocking;
  blockEndTime = blockUntil;
}

function loadFromLocalStorage() {
  const storedIsBlocked = localStorage.getItem("isBlocked");
  const storedBlockEndTime = localStorage.getItem("blockEndTime");

  if (storedIsBlocked !== null) {
    isBlocked = JSON.parse(storedIsBlocked);
  }

  if (storedBlockEndTime !== null) {
    blockEndTime = JSON.parse(storedBlockEndTime);
  }
}

document
  .getElementById("block-websites")
  .addEventListener("click", function () {
    if (!isBlocked) {
      chrome.runtime.sendMessage(
        { action: "block_sites" },
        function (response) {
          if (response.blocked) {
            saveToLocalStorage(true, response.blockUntil);
            updateStatus();
            updateButtonStates();
            showResponse(response);
          }
        }
      );
    }
  });

// Initial status update
loadFromLocalStorage();
updateStatus();
updateButtonStates();

// Update countdown and status every second
setInterval(() => {
  updateStatus();
  updateButtonStates();
}, 1000);
