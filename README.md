# Clipboard Manager for macOS

A lightweight clipboard history manager for macOS that lives in your menu bar. This application allows you to track and manage your clipboard history, providing quick access to previously copied items.

## Features

- 📋 **Clipboard History**: Track text and image clipboard items.
- 🔍 **Quick Access**: Access clipboard history from the menu bar.
- ⌨️ **Keyboard Shortcut**: Use `⌘⇧V` (Command+Shift+V) to toggle the clipboard history window.
- 🚀 **Lightweight**: Minimal resource usage and unobtrusive design.
- 💾 **Persistent History**: Clipboard history is saved between app restarts.
- 🔄 **Keyboard Navigation**: Use arrow keys to navigate and `Enter` to select an item.

## How It Works

- The app monitors clipboard changes and stores text and image items in a history list.
- The menu bar tray icon provides access to the clipboard history and additional options.
- A modal window displays the clipboard history, allowing you to select and copy items back to the clipboard.

## Installation

### Requirements

- **Node.js**: Version 14 or higher.
- **npm**: Installed with Node.js.

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/Vicopem01/clipboard-manager.git
   cd clipboard-manager
    ```
2. Install dependencies:
    ```javascript
    npm install
    ```

3. Start the application:
    ```javascript
    npm start
    ```
4. Build the application (optional):
    ```javascript
    npm run build
    ```

## Usage
1. Menu Bar Access: Click the clipboard icon in the menu bar to view your clipboard history.
2. Keyboard Shortcut: Press ⌘⇧V to toggle the clipboard history modal.
3. Copy Items: Click any item in the history to copy it back to the clipboard.
4. Keyboard Navigation: Use arrow keys to navigate the history and Enter to select an item.

## Development
File Structure
 - `src/main.js`: Main process logic, including tray creation, clipboard monitoring, and modal management.
 - `src/renderer.js`: Renderer process logic for the clipboard history modal.
- `src/preload.js`: Preload script for secure communication between the main and renderer processes.
- `src/modal.html`: HTML structure for the clipboard history modal.
- `src/modal.css`: Styles for the clipboard history modal.
resources/iconTemplate.js: Generates the tray icon.

## Scripts
- Start the app: `npm start`
- Build the app: `npm run build`

## Contributing
Contributions are welcome! Feel free to open issues or submit pull requests to improve the project.


## Credits
Created by [Vicopem01](https://github.com/Vicopem01).