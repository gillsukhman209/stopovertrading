document.addEventListener("DOMContentLoaded", function () {
  try {
    var extpay = ExtPay("stop-trading");
    let isBlocked = false;
    let blockEndTime = null;
    let customBlockDuration = 60 * 60; // Default duration in seconds (1 hour)
    let userIsPaid = false;

    // Check user's payment status once when popup is opened
    extpay
      .getUser()
      .then((user) => {
        try {
          userIsPaid = user.paid;
          console.log("user in popup.js is ", userIsPaid);
          // Store user's paid status in local storage
          chrome.storage.local.set({ userIsPaid: user.paid }, function () {
            if (chrome.runtime.lastError) {
              console.error(
                "Error saving to local storage:",
                chrome.runtime.lastError
              );
            } else {
              console.log("User paid status saved to local storage");
            }
          });
          // Initialize the rest of your popup functionality here
          if (userIsPaid) {
            initializePopup();
          } else {
            extpay.openPaymentPage();
          }
        } catch (error) {
          console.error("Error in extpay.getUser() callback:", error);
        }
      })
      .catch((error) => {
        console.error("Error getting user payment status:", error);
      });

    chrome.storage.local.get(["userIsPaid"], function (result) {
      if (chrome.runtime.lastError) {
        console.error(
          "Error retrieving from local storage:",
          chrome.runtime.lastError
        );
      } else {
        const userStatus = result.userIsPaid ? "Premium" : "Free";
      }
    });

    function initializePopup() {
      function updateStatus() {
        try {
          const statusElement = document.getElementById("current-status");
          const paidStatusElement = document.getElementById("paid-status");

          if (!statusElement || !paidStatusElement) {
            throw new Error("Status elements not found");
          }

          // Update paid status display without checking again
          paidStatusElement.textContent = userIsPaid ? "Premium" : "Free";
          paidStatusElement.style.color = userIsPaid ? "#2ecc71" : "#e74c3c";
          updateButtonStates();

          chrome.runtime.sendMessage(
            { action: "get_status" },
            function (response) {
              if (chrome.runtime.lastError) {
                console.error("Runtime error:", chrome.runtime.lastError);
                return;
              }
              if (response) {
                const actuallyBlocked = response.isBlocking;
                statusElement.textContent = actuallyBlocked
                  ? "Blocked"
                  : "Unblocked";
                statusElement.style.color = actuallyBlocked
                  ? "#e74c3c"
                  : "#2ecc71";
                isBlocked = actuallyBlocked;
                blockEndTime = response.blockUntil;
                updateButtonStates(); // Update button states after getting blocking status
              } else {
                console.error("No response received from background script");
              }
            }
          );
        } catch (error) {
          console.error("Error in updateStatus:", error);
        }
      }

      function updateButtonStates() {
        try {
          const blockButton = document.getElementById("block-websites");
          const countdownElement = document.getElementById("countdown");

          if (!blockButton || !countdownElement) {
            throw new Error("Button elements not found");
          }

          if (isBlocked && blockEndTime) {
            const remainingTime = Math.max(
              0,
              new Date(blockEndTime) - Date.now()
            );
            const hours = Math.floor(remainingTime / (60 * 60 * 1000));
            const minutes = Math.floor(
              (remainingTime % (60 * 60 * 1000)) / (60 * 1000)
            );
            const seconds = Math.floor((remainingTime % (60 * 1000)) / 1000);

            countdownElement.textContent = `${hours
              .toString()
              .padStart(2, "0")}:${minutes
              .toString()
              .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
            blockButton.disabled = true;
            blockButton.style.opacity = "0.5";
          } else {
            countdownElement.textContent = "";
            blockButton.disabled = false; // Enable button for all users
            blockButton.style.opacity = "1";
          }
        } catch (error) {
          console.error("Error in updateButtonStates:", error);
        }
      }

      function showResponse(response) {
        try {
          const responseElement = document.getElementById("response-message");
          if (responseElement) {
            responseElement.textContent = response.message;
            responseElement.className = response.blocked ? "success" : "error";
          } else {
            throw new Error("Response element not found");
          }
        } catch (error) {
          console.error("Error in showResponse:", error);
        }
      }

      function saveToLocalStorage(isBlocking, blockUntil) {
        try {
          localStorage.setItem("isBlocked", JSON.stringify(isBlocking));
          localStorage.setItem("blockEndTime", JSON.stringify(blockUntil));
          isBlocked = isBlocking;
          blockEndTime = blockUntil;
        } catch (error) {
          console.error("Error saving to localStorage:", error);
        }
      }

      function loadFromLocalStorage() {
        try {
          const storedIsBlocked = localStorage.getItem("isBlocked");
          const storedBlockEndTime = localStorage.getItem("blockEndTime");
          const storedCustomBlockDuration = localStorage.getItem(
            "customBlockDuration"
          );
          const storedUserIsPaid = localStorage.getItem("userIsPaid");

          if (storedIsBlocked !== null) {
            isBlocked = JSON.parse(storedIsBlocked);
          }

          if (storedBlockEndTime !== null) {
            blockEndTime = JSON.parse(storedBlockEndTime);
          }

          if (storedCustomBlockDuration !== null) {
            customBlockDuration = JSON.parse(storedCustomBlockDuration);
          }

          if (storedUserIsPaid !== null) {
            userIsPaid = JSON.parse(storedUserIsPaid);
          }
        } catch (error) {
          console.error("Error loading from localStorage:", error);
        }
      }

      const blockWebsitesButton = document.getElementById("block-websites");
      if (blockWebsitesButton) {
        blockWebsitesButton.addEventListener("click", function () {
          try {
            console.log("Block websites button clicked"); // Debug log
            if (!isBlocked) {
              console.log("Sending block_sites message"); // Debug log
              chrome.runtime.sendMessage(
                {
                  action: "block_sites",
                  duration: customBlockDuration,
                  paid: localStorage.getItem("userIsPaid"),
                },
                function (response) {
                  if (chrome.runtime.lastError) {
                    console.error("Runtime error:", chrome.runtime.lastError);
                    return;
                  }
                  console.log("Received response:", response); // Debug log
                  if (response && response.blocked) {
                    saveToLocalStorage(true, response.blockUntil);
                    updateStatus();
                    updateButtonStates();
                    showResponse(response);
                  } else {
                    console.error("Invalid response or blocking failed");
                    console.log("Full response:", response); // Log the full response
                    showResponse({
                      message:
                        "Failed to block sites. Please try again. Error: " +
                        (response ? JSON.stringify(response) : "No response"),
                      blocked: false,
                    });
                  }
                }
              );
            } else {
              console.log("Sites are already blocked"); // Debug log
            }
          } catch (error) {
            console.error(
              "Error in block websites button click handler:",
              error
            );
          }
        });
      } else {
        console.error("Block websites button not found");
      }

      const settingsButton = document.getElementById("settings-button");
      if (settingsButton) {
        settingsButton.addEventListener("click", function () {
          try {
            const modal = document.getElementById("settings-modal");
            if (modal) {
              modal.style.display = "block";
            } else {
              throw new Error("Settings modal not found");
            }
          } catch (error) {
            console.error("Error in settings button click handler:", error);
          }
        });
      } else {
        console.error("Settings button not found");
      }

      const saveSettingsButton = document.getElementById("save-settings");
      if (saveSettingsButton) {
        saveSettingsButton.addEventListener("click", function () {
          try {
            const hoursInput = document.getElementById("block-duration-hours");
            const minutesInput = document.getElementById(
              "block-duration-minutes"
            );
            const customWebsiteInput =
              document.getElementById("custom-website");
            const hours = parseInt(hoursInput.value, 10) || 0;
            const minutes = parseInt(minutesInput.value, 10) || 0;
            const newDuration = (hours * 60 + minutes) * 60; // Convert to seconds
            const customWebsite = customWebsiteInput.value.trim();

            if (newDuration > 0) {
              customBlockDuration = newDuration;
              localStorage.setItem(
                "customBlockDuration",
                JSON.stringify(newDuration)
              );
              // Update the background script with the new duration
              chrome.runtime.sendMessage(
                {
                  action: "update_duration",
                  duration: newDuration,
                },
                function (response) {
                  if (chrome.runtime.lastError) {
                    console.error("Runtime error:", chrome.runtime.lastError);
                    return;
                  }
                  // Force an update of the blocking status after changing duration
                  updateStatus();
                }
              );
            }

            if (customWebsite) {
              // Send message to background.js to add the custom website
              chrome.runtime.sendMessage(
                {
                  action: "add_custom_website",
                  website: customWebsite,
                },
                function (response) {
                  if (chrome.runtime.lastError) {
                    console.error("Runtime error:", chrome.runtime.lastError);
                    return;
                  }
                  console.log("Custom website added:", response);
                }
              );
            }

            const modal = document.getElementById("settings-modal");
            if (modal) {
              modal.style.display = "none";
            }
            // Add a confirmation message
            showResponse({
              message: "Settings saved successfully!",
              blocked: true,
            });
          } catch (error) {
            console.error(
              "Error in save settings button click handler:",
              error
            );
          }
        });
      } else {
        console.error("Save settings button not found");
      }

      const closeSettingsButton = document.getElementById("close-settings");
      if (closeSettingsButton) {
        closeSettingsButton.addEventListener("click", function () {
          try {
            const modal = document.getElementById("settings-modal");
            if (modal) {
              modal.style.display = "none";
            } else {
              throw new Error("Settings modal not found");
            }
          } catch (error) {
            console.error(
              "Error in close settings button click handler:",
              error
            );
          }
        });
      } else {
        console.error("Close settings button not found");
      }

      // Initial status update
      try {
        loadFromLocalStorage();
        updateStatus();
        updateButtonStates();
      } catch (error) {
        console.error("Error in initial status update:", error);
      }
    }
  } catch (error) {
    console.error("Global error in DOMContentLoaded event listener:", error);
  }
});
