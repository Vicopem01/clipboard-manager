const historyList = document.getElementById("history-list");
const clearButton = document.getElementById("clear-history");
let isDragging = false; // Track clipboard item dragging state

// Add event listener for the clear button
clearButton.addEventListener("click", () => {
  // Call the main process to clear the history
  window.electronAPI.clearHistory();
});

// Handler for external links
document.addEventListener("click", (event) => {
  // Check if the clicked element is a link with target="_blank"
  const link = event.target.closest('a[target="_blank"]');
  if (link) {
    event.preventDefault(); // Prevent default link behavior
    const url = link.getAttribute("href");
    if (url) {
      // console.log('Opening external link:', url);
      window.electronAPI.openExternalLink(url);
    }
  }
});

window.electronAPI.onShowHistory((history) => {
  // console.log("Received history in modal:", history);
  historyList.innerHTML = ""; // Clear previous items

  if (!history || history.length === 0) {
    const noItems = document.createElement("div");
    noItems.className = "empty-message";
    noItems.textContent = "No clipboard history";
    historyList.appendChild(noItems);
    return;
  }

  history.forEach((item, _) => {
    const div = document.createElement("div");
    div.className = "history-item";

    if (item.type === "text") {
      const textSpan = document.createElement("span");
      // Truncate text visually if needed (CSS handles overflow)
      textSpan.textContent = item.text;
      div.appendChild(textSpan);

      // Make text items draggable
      div.draggable = true;
      div.classList.add("draggable");

      // Add drag event handlers
      div.addEventListener("dragstart", (e) => {
        // Set dragging state to prevent modal close
        isDragging = true;
        // Notify main process that dragging has started
        window.electronAPI.notifyDragStart();

        // Set the data being dragged (both plain text and HTML for compatibility)
        e.dataTransfer.setData("text/plain", item.text);
        e.dataTransfer.setData("text/html", item.text);

        // Ensure the operation is a copy
        e.dataTransfer.effectAllowed = "copy";

        // Add a visual indicator that the item is being dragged
        div.classList.add("dragging");

        // console.log(`Started dragging item ${index}:`, item.text);
      });

      div.addEventListener("dragend", (e) => {
        // Check if drop was successful
        const dropSuccessful = e.dataTransfer.dropEffect !== "none";

        // Notify main process that dragging has ended with success status
        window.electronAPI.notifyDragEnd(dropSuccessful);

        // The dropEffect property indicates if a drop occurred
        // 'none' means no drop, 'copy' means successful drop
        if (dropSuccessful) {
          // console.log('Drop completed successfully, closing modal');
          // Close the modal
          window.electronAPI.closeModal();
        } else {
          // console.log('Drag canceled or unsuccessful');
        }

        // Reset dragging state after small delay to allow drop to complete
        setTimeout(() => {
          isDragging = false;
        }, 300);

        // Remove the visual indicator
        div.classList.remove("dragging");
      });
    } else if (item.type === "image" && item.thumbnailDataUrl) {
      const img = document.createElement("img");
      img.src = item.thumbnailDataUrl;
      img.alt = "Image Thumbnail";
      const textSpan = document.createElement("span");
      textSpan.textContent = "[Image]"; // Placeholder text
      div.appendChild(img);
      div.appendChild(textSpan);
    } else {
      const textSpan = document.createElement("span");
      textSpan.textContent = "[Unknown Item]";
      div.appendChild(textSpan);
      div.style.opacity = "0.5"; // Dim unknown items
    }

    div.addEventListener("click", () => {
      // console.log(`Item ${index} clicked:`, item);
      // Send the original item object back, not just text/URL
      window.electronAPI.sendItemSelected(item);
    });

    historyList.appendChild(div);
  });
});

// Optional: Close modal if Escape key is pressed
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    window.electronAPI.closeModal();
  }
});

// Modified blur event to prevent closing during drag operations
window.addEventListener("blur", () => {
  // Only close the modal if we're not dragging clipboard items
  if (!isDragging) {
    // A short delay helps prevent accidental closing when clicking items
    setTimeout(() => {
      window.electronAPI.closeModal();
    }, 100);
  }
});
