document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('optionsBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });
});

async function updateStatus() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab.id) return;
  
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getAudioStatus' });
    
    const statusText = document.getElementById('statusText');
    const statusIcon = document.getElementById('statusIcon');
    const statusSection = document.querySelector('.status-section');
    
    if (response.isPlaying) {
      statusText.textContent = 'Playing';
      statusIcon.textContent = '⏸️';
      statusSection.classList.add('playing');
    } else {
      statusText.textContent = 'Ready';
      statusIcon.textContent = '▶️';
      statusSection.classList.remove('playing', 'paused');
    }
  } catch (error) {
    // No content script or no audio
    document.getElementById('statusText').textContent = 'Ready';
    document.getElementById('statusIcon').textContent = '▶️';
  }
}

function controlAudio(action) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { action });
    }
  });
  
  // Update status after short delay
  setTimeout(updateStatus, 500);
}

// Poll status every 2 seconds while popup open
setInterval(updateStatus, 2000);