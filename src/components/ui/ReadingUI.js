import css from './ReadingUI.css';
import { getCurrentAudio, stopAudio } from '../../utils/index.js';

let readingUI = null;

/**
 * Shows the reading UI overlay
 * @param {string} text - The text being read
 * @param {boolean} isLoading - Whether to show loading state
 * @param {number} savedVolume - Saved volume setting (0-1)
 * @param {number} savedSpeed - Saved speed setting (0.5-2)
 */
export function showReadingUI(text, isLoading = false, savedVolume = 1, savedSpeed = 1) {
  hideReadingUI();

  // Inject CSS
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  readingUI = document.createElement('div');
  readingUI.id = 'elevenvoicereader-ui';

  // Draggable
  let isDragging = false;
  let startX, startY, startLeft, startTop;
  readingUI.addEventListener('mousedown', (e) => {
    if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = parseInt(readingUI.style.left);
      startTop = parseInt(readingUI.style.top);
      e.preventDefault();
    }
  });
  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      readingUI.style.left = (startLeft + dx) + 'px';
      readingUI.style.top = (startTop + dy) + 'px';
      readingUI.style.transform = 'none';
    }
  });
  document.addEventListener('mouseup', () => {
    isDragging = false;
  });

  // Content
  if (isLoading) {
    readingUI.innerHTML = `
      <div class="loading">
        <div class="icon">🔊</div>
        <div class="text">Generating Audio...</div>
        <div class="spinner"></div>
      </div>
    `;
  } else {
    readingUI.innerHTML = `
      <div class="header">
        <span class="title">ElevenVoiceReader</span>
        <button class="close-btn" id="closeBtn">×</button>
      </div>
      <div class="text-preview">${text.substring(0, 200)}${text.length > 200 ? '...' : ''}</div>
      <div class="controls">
        <button id="playPauseBtn">▶️ Play</button>
        <button id="stopBtn">⏹️ Stop</button>
        <div class="sliders">
          <input type="range" id="volumeSlider" min="0" max="1" step="0.1" value="1">
          <input type="range" id="speedSlider" min="0.5" max="2" step="0.1" value="1">
        </div>
      </div>
      <div class="footer">
        <button id="cancelBtn">❌ Close</button>
      </div>
    `;

    // Event listeners
    const currentAudio = getCurrentAudio();
    readingUI.querySelector('#closeBtn').onclick = hideReadingUI;
    readingUI.querySelector('#playPauseBtn').onclick = () => {
      if (currentAudio.paused) {
        currentAudio.play();
        readingUI.querySelector('#playPauseBtn').textContent = '⏸️ Pause';
      } else {
        currentAudio.pause();
        readingUI.querySelector('#playPauseBtn').textContent = '▶️ Play';
      }
    };
    readingUI.querySelector('#stopBtn').onclick = () => stopAudio(hideReadingUI);
    readingUI.querySelector('#volumeSlider').oninput = (e) => {
      currentAudio.volume = e.target.value;
    };
    readingUI.querySelector('#speedSlider').oninput = (e) => {
      currentAudio.playbackRate = e.target.value;
    };
    readingUI.querySelector('#cancelBtn').onclick = hideReadingUI;
  }

  document.body.appendChild(readingUI);
}

/**
 * Hides the reading UI overlay
 */
export function hideReadingUI() {
  if (readingUI) {
    readingUI.remove();
    readingUI = null;
  }
}