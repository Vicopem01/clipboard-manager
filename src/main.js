// main.js
const {
  app,
  Menu,
  clipboard,
  nativeImage,
  Tray,
  globalShortcut,
  BrowserWindow,
  screen,
  ipcMain,
  shell,
} = require("electron");
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
      if (trayControls) {
        // console.log("App was already ready, updating tray menu.");
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
    width: 280, // Slightly smaller width
    height: 365, // Adjusted height to accommodate footer
    show: false,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    // Set transparent background to allow custom rounded corners
    transparent: true,
    // Disable window shadow to prevent visual artifacts
    hasShadow: false,
    // Disable auto-hiding scrollbars to prevent layout shifts
    autoHideMenuBar: true,
    // Use content size for accurate sizing
    useContentSize: true,
    // Ensure the full window is used
    fullscreenable: false,
    maximizable: false,
    // Make the window movable (draggable)
    movable: true,
  });
  
  // Enable BrowserWindow dragging for frameless window
  modalWindow.setMovable(true);

  // Set window to be movable but stay on top
  modalWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  
  // Enable drag events from modal to other applications
  modalWindow.setContentProtection(false);
  
  // Add custom shadow using CSS in the renderer
  
  modalWindow.loadFile(path.join(__dirname, "modal.html"));

  // Handle blur event in the main process too, respecting drag state
  modalWindow.on('blur', () => {
    if (!dragInProgress && modalWindow && modalWindow.isVisible()) {
      // Add a short delay to allow for drag operations to register
      setTimeout(() => {
        if (!dragInProgress) {
          modalWindow.hide();
        }
      }, 150);
    }
  });

  modalWindow.on("closed", () => {
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
    
    // Instead of setting a context menu, handle click events
    tray.on('click', (event, bounds) => {
      showModalAtPosition(bounds.x, bounds.y);
    });
    
    // Create right-click menu for additional options
    const contextMenu = Menu.buildFromTemplate([
      {
        label: "Clear History",
        click: () => {
          clipboardHistory = [];
          if (store) {
            store.set("history", []);
          }
        },
      },
      { type: "separator" },
      {
        label: "Quit",
        accelerator: "CommandOrControl+Q",
        click: () => app.quit(),
      },
    ]);
    
    // Set the right-click menu
    tray.on('right-click', () => {
      tray.popUpContextMenu(contextMenu);
    });

    return {
      updateTrayMenu: () => {
        // No longer needed but kept for API compatibility
      },
    };
  } catch (error) {
    console.error("Error creating tray:", error);
    return {
      updateTrayMenu: () => {}, // Empty function as fallback
    };
  }
}

// Function to show modal at a specific position (reused for shortcut and tray click)
function showModalAtPosition(x, y) {
  if (!modalWindow) {
    console.error("Modal window not initialized!");
    return;
  }

  if (modalWindow.isVisible()) {
    modalWindow.hide();
    return;
  }

  const modalBounds = modalWindow.getBounds();

  // Position the modal below the tray icon for tray clicks
  let modalX = x - (modalBounds.width / 2);
  let modalY = y;

  // Ensure the modal appears fully on the screen
  const currentDisplay = screen.getDisplayNearestPoint({ x, y });
  const displayBounds = currentDisplay.workArea;

  if (modalX + modalBounds.width > displayBounds.x + displayBounds.width) {
    modalX = displayBounds.x + displayBounds.width - modalBounds.width;
  }
  if (
    modalY + modalBounds.height >
    displayBounds.y + displayBounds.height
  ) {
    modalY = displayBounds.y + displayBounds.height - modalBounds.height;
  }
  if (modalX < displayBounds.x) {
    modalX = displayBounds.x;
  }
  if (modalY < displayBounds.y) {
    modalY = displayBounds.y;
  }

  // Send the current history to the modal BEFORE showing
  modalWindow.webContents.send("show-history", clipboardHistory);

  // Set position and show
  modalWindow.setBounds({
    x: Math.round(modalX),
    y: Math.round(modalY),
    width: modalBounds.width,
    height: modalBounds.height,
  });
  modalWindow.show();
  modalWindow.focus(); // Focus the window
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
        // console.log("Image format detected on clipboard.");
        const currentImage = clipboard.readImage();
        if (!currentImage.isEmpty()) {
          // console.log(
          //   "Read non-empty image from clipboard. Size:",
          //   currentImage.getSize()
          // );
          // Compare images is tricky. Let's use a timestamp hack for now.
          // A more robust method might involve hashing image data.
          const currentTimestamp = Date.now(); // Simple change detection
          if (currentTimestamp !== lastContent.imageTimestamp) {
            const fullImageDataUrl = currentImage.toDataURL();
            const thumbnail = currentImage.resize({ width: 18, height: 18 });
            const thumbnailDataUrl = thumbnail.toDataURL();

            newItem = {
              type: "image",
              dataUrl: fullImageDataUrl,
              thumbnailDataUrl: thumbnailDataUrl,
            };
            lastContent.imageTimestamp = currentTimestamp;
            lastContent.text = null; // Reset text if image changed
            contentChanged = true;
          } else {
            // console.log(
            //   "Image timestamp matches last known image. No change detected."
            // );
            currentContent.imageTimestamp = lastContent.imageTimestamp;
          }
        } else {
          // console.log("Image format detected, but readImage() returned empty.");
        }
      } else {
        // If no image, check text
        const currentText = clipboard.readText();
        currentContent.text = currentText;
        if (currentText && currentText !== lastContent.text) {
          // console.log("Clipboard Change: New Text Detected");
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
          // console.log("Clipboard Change: Removing existing duplicate.");
          clipboardHistory.splice(existingIndex, 1);
        }

        // Add to beginning of array
        clipboardHistory.unshift(newItem);
        // console.log(
        //   `Clipboard Change: Added new ${newItem.type} item to history.`
        // );

        // Limit history size
        if (clipboardHistory.length > MAX_CLIPBOARD_ITEMS) {
          clipboardHistory = clipboardHistory.slice(0, MAX_CLIPBOARD_ITEMS);
          // console.log(
          //   `Clipboard Change: History trimmed to ${MAX_CLIPBOARD_ITEMS} items.`
          // );
        }

        // Save to store
        // console.log("Saving history to store:", clipboardHistory);
        if (store) {
          store.set("history", clipboardHistory);
          // console.log("Clipboard Change: History saved to store.");
        }

        // Send updated history to modal if it's visible
        if (modalWindow && modalWindow.isVisible()) {
            modalWindow.webContents.send('show-history', clipboardHistory);
        }
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

  // Register the global shortcut AFTER tray and modal are potentially created
  try {
    const ret = globalShortcut.register("Control+V", () => {
      // console.log("Control+V is pressed");

      // Get cursor position and show modal at that position
      const { x, y } = screen.getCursorScreenPoint();
      showModalAtPosition(x, y);
    });

    if (!ret) {
      console.error("Failed to register global shortcut Control+V");
    } else {
      console.log("Global shortcut Control+V registered successfully.");
    }
  } catch (error) {
    console.error("Error registering global shortcut:", error);
  }
}

// Hide dock icon for a proper menu bar app
app.dock?.hide();

// App event handlers
app.whenReady().then(() => {
  console.log("App is ready, creating modal and initializing app.");
  createModalWindow(); // Create the modal window first
  initializeApp(); // Then initialize tray, monitoring, shortcuts
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  // Unregister all shortcuts.
  globalShortcut.unregisterAll();
  console.log("Global shortcuts unregistered.");

  // Destroy modal window if it exists
  if (modalWindow) {
    modalWindow.close();
    modalWindow = null;
  }

  // Clean up
});

// IPC Handlers
ipcMain.on("item-selected", (event, item) => {
  // console.log("Main process received item selection:", item);
  if (!item) return;

  if (item.type === "text") {
    clipboard.writeText(item.text);
    // console.log("Text written to clipboard.");
  } else if (item.type === "image" && item.dataUrl) {
    try {
      const image = nativeImage.createFromDataURL(item.dataUrl);
      if (!image.isEmpty()) {
        clipboard.writeImage(image);
        // console.log("Image written to clipboard.");
      } else {
        console.error(
          "Failed to create nativeImage from dataUrl for writing to clipboard."
        );
      }
    } catch (e) {
      console.error("Error writing image to clipboard:", e);
    }
  }

  // Move selected item to top (optional but good UX)
  const selectedIndex = clipboardHistory.findIndex(
    (h) =>
      h.type === item.type &&
      (h.type === "text"
        ? h.text === item.text
        : h.thumbnailDataUrl === item.thumbnailDataUrl)
  );
  if (selectedIndex > 0) {
    const [movedItem] = clipboardHistory.splice(selectedIndex, 1);
    clipboardHistory.unshift(movedItem);
    if (store) {
      store.set("history", clipboardHistory);
    }
  }

  if (modalWindow) {
    modalWindow.hide();
  }
});

ipcMain.on("close-modal", () => {
  // console.log("Main process received close request.");
  if (modalWindow) {
    modalWindow.hide();
  }
});

// Handle drag operation notifications from renderer
let dragInProgress = false;

ipcMain.on("drag-started", () => {
  // console.log("Main process received drag-started event");
  dragInProgress = true;
  
  // Keep the window visible during drag operations
  if (modalWindow) {
    // Ensure the window stays visible
    modalWindow.setAlwaysOnTop(true, "floating", 1);
  }
});

ipcMain.on("drag-ended", (event, dropSuccessful) => {
  // console.log("Main process received drag-ended event", dropSuccessful ? "with successful drop" : "");
  dragInProgress = false;
  
  // Reset window settings after drag
  if (modalWindow) {
    modalWindow.setAlwaysOnTop(true);
    
    // If drop was successful, hide the modal
    if (dropSuccessful) {
      modalWindow.hide();
    }
  }
});

// Handle opening external links
ipcMain.on("open-external-link", (event, url) => {
  // console.log("Opening external link:", url);
  shell.openExternal(url).catch(err => {
    console.error("Failed to open external link:", err);
  });
});

// Handle clearing clipboard history
ipcMain.on("clear-history", (event) => {
  // Clear the history array
  clipboardHistory = [];
  
  // Update the store
  if (store) {
    store.set("history", []);
  }
  
  // Update the modal if it's visible
  if (modalWindow && modalWindow.isVisible()) {
    modalWindow.webContents.send("show-history", clipboardHistory);
  }
});
