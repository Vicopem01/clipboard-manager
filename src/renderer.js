// renderer.js
const { clipboard, ipcRenderer } = require("electron");

// Initialize variables
let store;
let clipHistory = [];
const maxHistory = 20;
const clipsContainer = document.getElementById("clips");

// Add a check for clipsContainer
if (!clipsContainer) {
  console.error("[Renderer] Error: Could not find element with ID 'clips'.");
}

// Initialize store with dynamic import
(async () => {
  const Store = await import('electron-store');
  store = new Store.default({
    name: 'clipboard-history'
  });
  
  // Get stored history
  clipHistory = store.get('history') || [];
  
  // Initial render once store is ready
  renderClips();
})();

// Function to render clipboard items in the popup window
function renderClips() {
  // console.log('[Renderer] renderClips called. History length:', clipHistory.length);

  // Add another check for clipsContainer just before using it
  if (!clipsContainer) {
    console.error("[Renderer] Error inside renderClips: Could not find element with ID 'clips'.");
    return;
  }

  clipsContainer.innerHTML = "";
  
  if (clipHistory.length === 0) {
    // console.log('[Renderer] History is empty, showing empty message.');
    const emptyMessage = document.createElement("div");
    emptyMessage.style.cssText = `
      padding: 12px;
      text-align: center;
      color: #888;
      font-size: 12px;
    `;
    emptyMessage.textContent = "No clipboard history yet";
    clipsContainer.appendChild(emptyMessage);
    return;
  }
  
  // console.log('[Renderer] Rendering history items:', clipHistory);
  clipHistory.forEach((clip, index) => {
    // console.log(`[Renderer] Processing item ${index}: "${String(clip).substring(0, 30)}..."`);
    const clipElement = document.createElement("div");
    clipElement.className = "clip-item";
    
    // Create a container for text
    const textContainer = document.createElement("div");
    textContainer.style.cssText = `
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    `;
    textContainer.textContent = clip;
    
    clipElement.appendChild(textContainer);
    
    // Make the entire element clickable to copy the text
    clipElement.onclick = () => {
      clipboard.writeText(clip);
      
      // Add active class to show feedback
      clipElement.classList.add('active');
      
      // Remove active class after a short delay
      setTimeout(() => {
        clipElement.classList.remove('active');
      }, 500);
      
      // Move this item to the top if it's not already
      if (index > 0) {
        clipHistory.splice(index, 1);
        clipHistory.unshift(clip);
        renderClips();
        if (store) {
          store.set('history', clipHistory);
        }
      }
    };
    
    clipsContainer.appendChild(clipElement);
    // console.log(`[Renderer] Appended item ${index} to clipsContainer.`);
  });
}

// Listen for clipboard updates from the main process
ipcRenderer.on('update-clipboard', (event, newHistory) => {
  // console.log('[Renderer] Received update-clipboard event with history:', newHistory);
  clipHistory = newHistory;
  renderClips();
});

// Add keyboard navigation
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    // Tell main process to hide the window
    ipcRenderer.send('hide-window');
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    const items = document.querySelectorAll('.clip-item');
    if (items.length === 0) return;
    
    // Find currently focused item
    const focusedIndex = Array.from(items).findIndex(item => 
      item === document.activeElement || item.classList.contains('active'));
    
    let nextIndex;
    if (focusedIndex === -1) {
      // No item is focused yet
      nextIndex = event.key === 'ArrowDown' ? 0 : items.length - 1;
    } else {
      // Move focus based on arrow key
      nextIndex = event.key === 'ArrowDown' 
        ? Math.min(focusedIndex + 1, items.length - 1)
        : Math.max(focusedIndex - 1, 0);
    }
    
    // Focus the next item
    items[nextIndex].focus();
    items[nextIndex].classList.add('active');
    
    // Remove active class from previous item
    if (focusedIndex !== -1 && focusedIndex !== nextIndex) {
      items[focusedIndex].classList.remove('active');
    }
    
    event.preventDefault();
  } else if (event.key === 'Enter') {
    // Copy the focused/active item
    const activeItem = document.querySelector('.clip-item.active') || document.activeElement;
    if (activeItem && activeItem.classList.contains('clip-item')) {
      activeItem.click();
    }
  }
});
