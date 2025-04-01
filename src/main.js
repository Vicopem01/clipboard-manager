// main.js
const { app, Menu, clipboard, nativeImage, Tray, globalShortcut, BrowserWindow, screen, ipcMain } = require("electron");
const path = require("path");

let tray = null;
let store;
let trayControls;
let modalWindow = null; // Variable for the modal window

// Initialize the store using dynamic import
(async () => {
  try {
    const Store = await import("electron-store");
    store = new Store.default({
      name: "clipboard-history",
      defaults: {
        history: [],
      },
    });

    // Get initial history from store once it's initialized
    clipboardHistory = store.get("history") || [];
    console.log("Store initialized and history loaded.");

    // We no longer call initializeApp here. It will be called by app.whenReady
    // If the app is already ready, update the tray menu if it exists
    if (app.isReady()) {
        if(trayControls) {
            console.log("App was already ready, updating tray menu.");
            trayControls.updateTrayMenu();
        }
        // Ensure modal is also created if app was ready fast
        if (!modalWindow) {
            createModalWindow();
        }
    }
  } catch (error) {
    console.error("Failed to initialize electron-store:", error);
    // Handle error appropriately, maybe show a dialog or quit
  }
})();

// Keep a maximum number of clipboard items
const MAX_CLIPBOARD_ITEMS = 10;

// Initialize with empty array, will be populated once store is ready
let clipboardHistory = [];

// Function to create the modal window
function createModalWindow() {
    if (modalWindow) return; // Avoid creating multiple windows

    modalWindow = new BrowserWindow({
        width: 300, // Adjust width as needed
        height: 400, // Adjust height as needed
        show: false,
        frame: false,
        resizable: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    modalWindow.loadFile(path.join(__dirname, 'modal.html'));

    // Hide the window when it loses focus (optional, handled in renderer too)
    // modalWindow.on('blur', () => {
    //     if (modalWindow && modalWindow.isVisible()) {
    //         modalWindow.hide();
    //     }
    // });

    modalWindow.on('closed', () => {
        modalWindow = null; // Dereference the window object
    });
}

function createTray() {
  try {
    // Use the PNG icon from the src folder
    const iconPath = path.join(__dirname, "icon.png");

    // For macOS, we'll create a template image
    if (process.platform === "darwin") {
      // Load the icon
      const icon = nativeImage.createFromPath(iconPath);

      if (icon.isEmpty()) {
        console.error("Failed to load icon");
      } else {
        // Make a properly sized 16px template icon (standard menu bar size on macOS)
        const resizedIcon = icon.resize({ width: 16, height: 16 });
        resizedIcon.setTemplateImage(true);

        // Create the tray with template icon
        tray = new Tray(resizedIcon);
      }
    } else {
      // For other platforms
      tray = new Tray(iconPath);
    }

    // If tray wasn't created, use fallback
    if (!tray) {
      console.error("Failed to create tray icon, using fallback method");
      tray = new Tray(iconPath);
    }

    tray.setToolTip("Clipboard Manager");

    // Update the tray context menu with clipboard history
    function updateTrayMenu() {
      console.log(
        "Updating Tray Menu. History items:",
        clipboardHistory.length
      );
      const historyItems = clipboardHistory.map((item, index) => {
        let menuItem = {};

        if (item.type === "text") {
          // Truncate text if too long
          const displayText =
            item.text.length > 25
              ? item.text.substring(0, 25) + "..."
              : item.text;

          menuItem = {
            label: displayText,
            click: () => {
              // Copy text back to clipboard when clicked
              clipboard.writeText(item.text);
              // Move this item to the top of the history
              if (index > 0) {
                const movedItem = clipboardHistory.splice(index, 1)[0];
                clipboardHistory.unshift(movedItem);
                updateTrayMenu();
                if (store) {
                  store.set("history", clipboardHistory);
                }
              }
            },
          };
        } else if (item.type === "image" && item.thumbnailDataUrl) {
          try {
            console.log(
              `[Menu Item ${index}] Creating image menu item. Thumbnail URL length: ${item.thumbnailDataUrl.length}`
            );
            const thumbnailIcon = nativeImage.createFromDataURL(
              item.thumbnailDataUrl
            );
            if (thumbnailIcon.isEmpty()) {
              console.error(
                `[Menu Item ${index}] Failed to create nativeImage from thumbnailDataUrl`
              );
              menuItem = { label: "[Image Load Error]", enabled: false };
            } else {
              console.log(
                `[Menu Item ${index}] Image thumbnail loaded successfully. Size:`,
                thumbnailIcon.getSize()
              );
              menuItem = {
                label: "[Image]", // Or show dimensions, timestamp, etc.
                icon: thumbnailIcon,
                click: () => {
                  console.log(
                    `[Menu Item ${index}] Image clicked. Restoring full image.`
                  );
                  // Copy the full image back to clipboard
                  try {
                    const fullImage = nativeImage.createFromDataURL(
                      item.dataUrl
                    );
                    if (fullImage.isEmpty()) {
                      console.error(
                        `[Menu Item ${index}] Failed to create nativeImage from full dataUrl for restore.`
                      );
                    } else {
                      clipboard.writeImage(fullImage);
                      console.log(
                        `[Menu Item ${index}] Full image written to clipboard.`
                      );
                    }
                  } catch (restoreError) {
                    console.error(
                      `[Menu Item ${index}] Error restoring full image:`,
                      restoreError
                    );
                  }
                  // Move this item to the top
                  if (index > 0) {
                    const movedItem = clipboardHistory.splice(index, 1)[0];
                    clipboardHistory.unshift(movedItem);
                    updateTrayMenu();
                    if (store) {
                      store.set("history", clipboardHistory);
                    }
                  }
                },
              };
            }
          } catch (e) {
            console.error(
              `[Menu Item ${index}] Error processing image menu item:`,
              e
            );
            // Fallback for invalid image data
            menuItem = { label: "[Image Process Error]", enabled: false };
          }
        } else {
          // Fallback for unknown item type or missing data
          menuItem = { label: "[Unknown Item]", enabled: false };
        }

        return menuItem;
      });

      const contextMenu = Menu.buildFromTemplate([
        {
          label: "History",
          enabled: false,
        },
        ...historyItems,
        { type: "separator" },
        {
          label: "Clear History",
          click: () => {
            clipboardHistory = [];
            if (store) {
              store.set("history", []);
            }
            updateTrayMenu();
          },
        },
        {
          label: "Quit",
          accelerator: "CommandOrControl+Q",
          click: () => app.quit(),
        },
      ]);

      tray.setContextMenu(contextMenu);
    }

    // Initial update of the menu
    updateTrayMenu();

    return {
      updateTrayMenu,
    };
  } catch (error) {
    console.error("Error creating tray:", error);
    return {
      updateTrayMenu: () => {}, // Empty function as fallback
    };
  }
}

// Monitor clipboard for changes
function monitorClipboard() {
  let lastContent = {
    text: clipboard.readText(),
    imageTimestamp: null, // Use timestamp to detect image changes
  };

  try {
    const initialImage = clipboard.readImage();
    if (!initialImage.isEmpty()) {
      // Rough way to get a timestamp/change marker for the initial image
      lastContent.imageTimestamp = Date.now();
    }
  } catch (e) {
    console.error("Error reading initial image", e);
  }

  // Check clipboard every second
  setInterval(() => {
    try {
      const availableFormats = clipboard.availableFormats();
      let currentContent = { text: null, imageTimestamp: null };
      let newItem = null;
      let contentChanged = false;

      // Prioritize Image check
      if (availableFormats.some((f) => f.startsWith("image/"))) {
        console.log("Image format detected on clipboard.");
        const currentImage = clipboard.readImage();
        if (!currentImage.isEmpty()) {
          console.log(
            "Read non-empty image from clipboard. Size:",
            currentImage.getSize()
          );
          // Compare images is tricky. Let's use a timestamp hack for now.
          // A more robust method might involve hashing image data.
          const currentTimestamp = Date.now(); // Simple change detection
          if (currentTimestamp !== lastContent.imageTimestamp) {
            console.log("Clipboard Change: New Image Detected");
            const fullImageDataUrl = currentImage.toDataURL();
            const thumbnail = currentImage.resize({ width: 18, height: 18 });
            const thumbnailDataUrl = thumbnail.toDataURL();

            console.log(
              `Generated image data. Full URL length: ${fullImageDataUrl.length}, Thumbnail URL length: ${thumbnailDataUrl.length}`
            );
            newItem = {
              type: "image",
              dataUrl: fullImageDataUrl,
              thumbnailDataUrl: thumbnailDataUrl,
            };
            lastContent.imageTimestamp = currentTimestamp;
            lastContent.text = null; // Reset text if image changed
            contentChanged = true;
          } else {
            console.log(
              "Image timestamp matches last known image. No change detected."
            );
            currentContent.imageTimestamp = lastContent.imageTimestamp;
          }
        } else {
          console.log("Image format detected, but readImage() returned empty.");
        }
      } else {
        // If no image, check text
        const currentText = clipboard.readText();
        currentContent.text = currentText;
        if (currentText && currentText !== lastContent.text) {
          console.log("Clipboard Change: New Text Detected");
          newItem = { type: "text", text: currentText };
          lastContent.text = currentText;
          lastContent.imageTimestamp = null; // Reset image if text changed
          contentChanged = true;
        } else {
          lastContent.imageTimestamp = null; // Ensure image timestamp is null if no image
        }
      }

      // If content has changed and newItem is defined
      if (contentChanged && newItem) {
        // Handle duplicates (basic check)
        let existingIndex = -1;
        if (newItem.type === "text") {
          existingIndex = clipboardHistory.findIndex(
            (item) => item.type === "text" && item.text === newItem.text
          );
        } else if (newItem.type === "image") {
          // Simple duplicate check for images based on thumbnail URL (not perfect)
          existingIndex = clipboardHistory.findIndex(
            (item) =>
              item.type === "image" &&
              item.thumbnailDataUrl === newItem.thumbnailDataUrl
          );
        }

        if (existingIndex !== -1) {
          console.log("Clipboard Change: Removing existing duplicate.");
          clipboardHistory.splice(existingIndex, 1);
        }

        // Add to beginning of array
        clipboardHistory.unshift(newItem);
        console.log(
          `Clipboard Change: Added new ${newItem.type} item to history.`
        );

        // Limit history size
        if (clipboardHistory.length > MAX_CLIPBOARD_ITEMS) {
          clipboardHistory = clipboardHistory.slice(0, MAX_CLIPBOARD_ITEMS);
          console.log(
            `Clipboard Change: History trimmed to ${MAX_CLIPBOARD_ITEMS} items.`
          );
        }

        // Save to store
        console.log("Saving history to store:", clipboardHistory);
        if (store) {
          store.set("history", clipboardHistory);
          console.log("Clipboard Change: History saved to store.");
        }

        // Update the tray menu to show the new clipboard content
        if (trayControls) {
          trayControls.updateTrayMenu();
        }
        // Send updated history to modal if it's visible
        // Note: We only send when the shortcut is pressed now
        // if (modalWindow && modalWindow.isVisible()) {
        //     modalWindow.webContents.send('show-history', clipboardHistory);
        // }
      }
    } catch (error) {
      // Log errors related to reading clipboard frequently
      if (error.message.includes("Could not read clipboard data")) {
        // console.warn("Clipboard read error (common, often ignorable):", error.message);
      } else {
        console.error("Error monitoring clipboard:", error);
      }
    }
  }, 1000);
}

function initializeApp() {
  trayControls = createTray();
  monitorClipboard();

  // Create modal window (moved here, happens after tray)
  // createModalWindow(); // Moved to app.whenReady

  // Register the global shortcut AFTER tray and modal are potentially created
  try {
    const ret = globalShortcut.register('Command+Shift+V', () => {
      console.log('Command+Shift+V is pressed');

      if (!modalWindow) {
          console.error("Modal window not initialized!");
          return;
      }

      if (modalWindow.isVisible()) {
          modalWindow.hide(); // Toggle visibility
          return;
      }

      // Get cursor position
      const { x, y } = screen.getCursorScreenPoint();
      const modalBounds = modalWindow.getBounds();

      // Basic positioning: Place top-left of modal near cursor
      // Add small offsets so cursor isn't exactly over the corner
      let modalX = x + 10;
      let modalY = y + 10;

      // Ensure the modal appears fully on the screen
      const currentDisplay = screen.getDisplayNearestPoint({ x, y });
      const displayBounds = currentDisplay.workArea;

      if (modalX + modalBounds.width > displayBounds.x + displayBounds.width) {
        modalX = displayBounds.x + displayBounds.width - modalBounds.width;
      }
      if (modalY + modalBounds.height > displayBounds.y + displayBounds.height) {
        modalY = displayBounds.y + displayBounds.height - modalBounds.height;
      }
      if (modalX < displayBounds.x) {
        modalX = displayBounds.x;
      }
      if (modalY < displayBounds.y) {
        modalY = displayBounds.y;
      }

      // Send the current history to the modal BEFORE showing
      modalWindow.webContents.send('show-history', clipboardHistory);

      // Set position and show
      modalWindow.setBounds({ x: Math.round(modalX), y: Math.round(modalY), width: modalBounds.width, height: modalBounds.height });
      modalWindow.show();
      modalWindow.focus(); // Focus the window

    });

    if (!ret) {
      console.error('Failed to register global shortcut Command+Shift+V');
    } else {
      console.log('Global shortcut Command+Shift+V registered successfully.');
    }

  } catch (error) {
      console.error('Error registering global shortcut:', error);
  }
}

// Hide dock icon for a proper menu bar app
app.dock?.hide();

// App event handlers
app.whenReady().then(() => {
  console.log("App is ready, creating modal and initializing app.");
  createModalWindow(); // Create the modal window first
  initializeApp();     // Then initialize tray, monitoring, shortcuts
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  // Unregister all shortcuts.
  globalShortcut.unregisterAll();
  console.log('Global shortcuts unregistered.');

  // Destroy modal window if it exists
    if (modalWindow) {
        modalWindow.close();
        modalWindow = null;
    }

  // Clean up
});

// IPC Handlers
ipcMain.on('item-selected', (event, item) => {
    console.log("Main process received item selection:", item);
    if (!item) return;

    if (item.type === 'text') {
        clipboard.writeText(item.text);
        console.log("Text written to clipboard.");
    } else if (item.type === 'image' && item.dataUrl) {
        try {
            const image = nativeImage.createFromDataURL(item.dataUrl);
            if (!image.isEmpty()) {
                clipboard.writeImage(image);
                console.log("Image written to clipboard.");
            } else {
                console.error("Failed to create nativeImage from dataUrl for writing to clipboard.");
            }
        } catch (e) {
            console.error("Error writing image to clipboard:", e);
        }
    }

    // Move selected item to top (optional but good UX)
    const selectedIndex = clipboardHistory.findIndex(h => 
        h.type === item.type && 
        (h.type === 'text' ? h.text === item.text : h.thumbnailDataUrl === item.thumbnailDataUrl)
    );
    if (selectedIndex > 0) {
        const [movedItem] = clipboardHistory.splice(selectedIndex, 1);
        clipboardHistory.unshift(movedItem);
        if (store) {
          store.set("history", clipboardHistory);
        }
        if (trayControls) { // Update tray menu as well
            trayControls.updateTrayMenu();
        }
    }

    if (modalWindow) {
        modalWindow.hide();
    }
});

ipcMain.on('close-modal', () => {
    console.log("Main process received close request.");
    if (modalWindow) {
        modalWindow.hide();
    }
});
