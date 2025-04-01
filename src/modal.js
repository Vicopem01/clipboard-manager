const historyList = document.getElementById('history-list');

window.electronAPI.onShowHistory((history) => {
  console.log("Received history in modal:", history);
  historyList.innerHTML = ''; // Clear previous items

  if (!history || history.length === 0) {
      const noItems = document.createElement('div');
      noItems.textContent = 'No history items.';
      noItems.style.padding = '10px';
      historyList.appendChild(noItems);
      return;
  }

  history.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'history-item';

    if (item.type === 'text') {
      const textSpan = document.createElement('span');
      // Truncate text visually if needed (CSS handles overflow)
      textSpan.textContent = item.text;
      div.appendChild(textSpan);
    } else if (item.type === 'image' && item.thumbnailDataUrl) {
      const img = document.createElement('img');
      img.src = item.thumbnailDataUrl;
      img.alt = 'Image Thumbnail';
      const textSpan = document.createElement('span');
      textSpan.textContent = '[Image]'; // Placeholder text
      div.appendChild(img);
      div.appendChild(textSpan);
    } else {
       const textSpan = document.createElement('span');
       textSpan.textContent = '[Unknown Item]';
       div.appendChild(textSpan);
       div.style.opacity = '0.5'; // Dim unknown items
    }

    div.addEventListener('click', () => {
      console.log(`Item ${index} clicked:`, item);
      // Send the original item object back, not just text/URL
      window.electronAPI.sendItemSelected(item);
    });

    historyList.appendChild(div);
  });
});

// Optional: Close modal if Escape key is pressed
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        window.electronAPI.closeModal();
    }
});

// Optional: Close modal if it loses focus
window.addEventListener('blur', () => {
    // A short delay helps prevent accidental closing when clicking items
    setTimeout(() => {
        window.electronAPI.closeModal();
    }, 100);
}); 