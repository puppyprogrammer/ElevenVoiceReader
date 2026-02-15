// Content script for ElevenVoiceReader

console.log('**Content script loaded**');

// Load content CSS
const contentCssLink = document.createElement('link');
contentCssLink.rel = 'stylesheet';
contentCssLink.href = chrome.runtime.getURL('src/content.css');
document.head.appendChild(contentCssLink);

// Audio globals
let currentAudio = null; // Keep for compatibility
let audioBlobUrl = null;
let currentBlob = null; // For restarting single audio

// Web Audio API globals for real-time volume and speed control
let audioContext = null;
let currentBufferSource = null;
let currentGain = null;
let currentAudioBuffer = null;

// Current slider values (used when audio is null)
let currentVolume = 1;
let currentSpeed = 1;
// Playback state
let isPlaying = false;
let isStopping = false; // Flag to prevent auto-advancing when manually stopped
// UI globals
let readingUI = null;

// Queue globals for chunked reading
let readingQueue = {
  chunks: [],
  currentIndex: 0,
  status: 'idle', // 'idle', 'processing', 'playing', 'paused', 'error'
  audioBuffers: [],
  processingIndex: 0
};

// Chrome storage utilities
async function getSettings(keys) {
  return await chrome.storage.sync.get(keys);
}

async function setSettings(settings) {
  await chrome.storage.sync.set(settings);
}

// Audio utilities
async function playAudio(blob, text, showReadingUI, hideReadingUI, savedVolume = 1, savedSpeed = 1, skipUI = false) {
  stopAudio(hideReadingUI);
  currentBlob = blob; // Store for restarting

  // Initialize Web Audio API
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  // Decode audio blob to AudioBuffer
  const arrayBuffer = await blob.arrayBuffer();
  currentAudioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // Create audio buffer source node
  currentBufferSource = audioContext.createBufferSource();
  currentBufferSource.buffer = currentAudioBuffer;

  // Create gain node for volume control
  currentGain = audioContext.createGain();

  // Initialize globals if not set
  if (typeof currentVolume === 'undefined') currentVolume = savedVolume;
  if (typeof currentSpeed === 'undefined') currentSpeed = savedSpeed;

  currentGain.gain.value = currentVolume;
  currentBufferSource.playbackRate.value = currentSpeed;

  // Connect audio graph: source -> gain -> destination
  currentBufferSource.connect(currentGain);
  currentGain.connect(audioContext.destination);

  // Add event listeners
  currentBufferSource.addEventListener('ended', () => {
    console.log('**Audio ended**');
    isPlaying = false;
    // Update button to show play icon when audio ends
    if (readingUI) {
      const playStopBtn = readingUI.querySelector('#playStopBtn');
      if (playStopBtn) {
        playStopBtn.textContent = '▶';
        playStopBtn.title = 'Play';
      }
    }
    // Clean up
    currentBufferSource = null;
    currentGain = null;
    currentAudioBuffer = null;
  });

  // Start playback
  currentBufferSource.start(0);
  isPlaying = true;
  isStopping = false; // Reset stopping flag when starting

  // Show UI only if not skipping
  if (!skipUI) {
    showReadingUI(text, false, savedVolume, savedSpeed);
  }

  // Update button to show stop icon after UI is shown
  if (readingUI) {
    const playStopBtn = readingUI.querySelector('#playStopBtn');
    if (playStopBtn) {
      console.log('**Setting button to stop icon**');
      playStopBtn.textContent = '⏹';
      playStopBtn.title = 'Stop';
    } else {
      console.log('**PlayStopBtn not found**');
    }
  } else {
    console.log('**readingUI not set**');
  }
}

function stopAudio(hideReadingUI, destroyAudio = true) {
  console.log('**stopAudio called** - currentBufferSource:', currentBufferSource, 'destroy:', destroyAudio);
  if (currentBufferSource) {
    console.log('**Stopping audio**');
    try {
      currentBufferSource.stop();
    } catch (e) {
      // Already stopped
    }
    isPlaying = false;
    if (destroyAudio) {
      currentBufferSource = null;
      currentGain = null;
      currentAudioBuffer = null;
      if (audioBlobUrl) {
        URL.revokeObjectURL(audioBlobUrl);
        audioBlobUrl = null;
      }
    }
  }
}

// Complete stop - clears queue and stops all audio
function stopAllAudio() {
  console.log('**stopAllAudio called**');
  isStopping = true; // Prevent auto-advancing to next chunk

  // Stop current audio playback
  if (currentBufferSource) {
    try {
      currentBufferSource.stop();
    } catch (e) {
      // Already stopped
    }
  }

  isPlaying = false;

  // Clean up
  currentBufferSource = null;
  currentGain = null;
  currentAudioBuffer = null;
  if (audioBlobUrl) {
    URL.revokeObjectURL(audioBlobUrl);
    audioBlobUrl = null;
  }

  // Reset playback state but preserve chunks and audioBuffers for replay
  readingQueue.currentIndex = 0;
  readingQueue.processingIndex = readingQueue.audioBuffers.filter(b => b !== null).length;
  readingQueue.status = 'idle';

  // Update button to show play when stopped
  if (readingUI) {
    const playStopBtn = readingUI.querySelector('#playStopBtn');
    if (playStopBtn) {
      playStopBtn.textContent = '▶';
      playStopBtn.title = 'Play';
    }
  }
}

function getCurrentAudio() {
  return currentAudio;
}

// ElevenLabs API utilities
async function generateTTS(text, voiceId, apiKey) {
  if (!/^[ -~]+$/.test(apiKey)) {
    throw new Error('API key contains invalid characters. Please ensure it contains only ASCII printable characters (no emojis, accented letters, or special Unicode).');
  }

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'xi-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_monolingual_v1',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API ${response.status}: ${errorText.slice(0, 200)}`);
  }

  return await response.blob();
}

async function fetchVoices(apiKey) {
  if (!/^[ -~]+$/.test(apiKey)) {
    throw new Error('API key contains invalid characters. Please ensure it contains only ASCII printable characters (no emojis, accented letters, or special Unicode).');
  }

  const response = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: {
      'xi-api-key': apiKey
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch voices: ${response.status}`);
  }

  const data = await response.json();
  return data.voices;
}

// API Key Prompt Modal
function showApiKeyPrompt(callback) {

  const modal = document.createElement('div');
  modal.className = 'api-key-modal';

  // Step 1: API Key Input
  modal.innerHTML = `
    <div class="modal-content">
      <h3>ElevenLabs API Key Required</h3>
      <p>Get your API key from <a href="https://elevenlabs.io/app/profile" target="_blank">ElevenLabs</a></p>
      <input type="password" id="apiKeyInput" placeholder="Enter your API key">
      <div class="buttons">
        <button id="submitKey">Test & Continue</button>
        <button id="cancelKey">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#submitKey').onclick = async () => {
    const apiKey = modal.querySelector('#apiKeyInput').value.trim();
    if (!apiKey) return;

    // Show loading
    modal.querySelector('.modal-content').innerHTML = `
      <h3>Validating API Key...</h3>
      <div class="loading">⏳</div>
    `;

    try {
      const voices = await fetchVoices(apiKey);
      // Step 2: Voice Selection
      modal.querySelector('.modal-content').innerHTML = `
        <h3>Select a Voice</h3>
        <p>Choose your preferred voice for text-to-speech.</p>
        <select id="voiceSelect">
          <option value="">Select a voice</option>
          ${voices.map(voice => `<option value="${voice.voice_id}">${voice.name}</option>`).join('')}
        </select>
        <div class="buttons">
          <button id="saveSettings">Save & Start</button>
          <button id="backKey">Back</button>
        </div>
      `;

      modal.querySelector('#saveSettings').onclick = () => {
        const voiceId = modal.querySelector('#voiceSelect').value;
        if (!voiceId) return;
        modal.remove();
        callback({ apiKey, voiceId });
      };

      modal.querySelector('#backKey').onclick = () => {
        // Back to API key input
        modal.querySelector('.modal-content').innerHTML = `
          <h3>ElevenLabs API Key Required</h3>
          <p>Get your API key from <a href="https://elevenlabs.io/app/profile" target="_blank">ElevenLabs</a></p>
          <input type="password" id="apiKeyInput" placeholder="Enter your API key" value="${apiKey}">
          <div class="buttons">
            <button id="submitKey">Test & Continue</button>
            <button id="cancelKey">Cancel</button>
          </div>
        `;
        // Reattach events
        modal.querySelector('#submitKey').onclick = modal.querySelector('#submitKey').onclick;
        modal.querySelector('#cancelKey').onclick = () => {
          modal.remove();
          callback(null);
        };
      };

    } catch (error) {
      modal.querySelector('.modal-content').innerHTML = `
        <h3>Invalid API Key</h3>
        <p>${error.message}</p>
        <div class="buttons">
          <button id="retryKey">Retry</button>
          <button id="cancelKey">Cancel</button>
        </div>
      `;
      modal.querySelector('#retryKey').onclick = () => {
        modal.querySelector('.modal-content').innerHTML = `
          <h3>ElevenLabs API Key Required</h3>
          <p>Get your API key from <a href="https://elevenlabs.io/app/profile" target="_blank">ElevenLabs</a></p>
          <input type="password" id="apiKeyInput" placeholder="Enter your API key">
          <div class="buttons">
            <button id="submitKey">Test & Continue</button>
            <button id="cancelKey">Cancel</button>
          </div>
        `;
        // Reattach
        modal.querySelector('#submitKey').onclick = modal.querySelector('#submitKey').onclick;
        modal.querySelector('#cancelKey').onclick = () => {
          modal.remove();
          callback(null);
        };
      };
      modal.querySelector('#cancelKey').onclick = () => {
        modal.remove();
        callback(null);
      };
    }
  };

  modal.querySelector('#cancelKey').onclick = () => {
    modal.remove();
    callback(null);
  };
}

// Settings Modal for editing API key and voice
async function showSettingsModal() {
  // Get current settings
  const settings = await getSettings(['apiKey', 'voiceId']);
  const currentApiKey = settings.apiKey || '';
  const currentVoiceId = settings.voiceId || '';

  // Inject CSS
  const css = `
    .settings-modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      z-index: 10001;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .settings-modal .modal-content {
      background: rgba(28, 28, 30, 0.95);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(142, 142, 147, 0.3);
      padding: 24px;
      border-radius: 12px;
      max-width: 400px;
      width: 90%;
      color: #f2f2f7;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    }

    .settings-modal h3 {
      margin: 0 0 16px 0;
      font-size: 18px;
      font-weight: 600;
      color: #f2f2f7;
    }

    .settings-modal .form-group {
      margin-bottom: 16px;
    }

    .settings-modal label {
      display: block;
      margin-bottom: 6px;
      font-size: 14px;
      font-weight: 500;
      color: #98989d;
    }

    .settings-modal input,
    .settings-modal select {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid rgba(142, 142, 147, 0.3);
      border-radius: 6px;
      background: rgba(44, 44, 46, 0.95);
      color: #f2f2f7;
      font-size: 14px;
      box-sizing: border-box;
    }

    .settings-modal input:focus,
    .settings-modal select:focus {
      outline: none;
      border-color: #4a9eff;
      box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.2);
    }

    .settings-modal .buttons {
      display: flex;
      gap: 8px;
      margin-top: 20px;
    }

    .settings-modal button {
      flex: 1;
      padding: 10px 16px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .settings-modal .test-btn {
      background: rgba(74, 158, 255, 0.1);
      color: #4a9eff;
      border: 1px solid rgba(74, 158, 255, 0.3);
    }

    .settings-modal .test-btn:hover {
      background: rgba(74, 158, 255, 0.2);
    }

    .settings-modal .save-btn {
      background: #34c759;
      color: white;
    }

    .settings-modal .save-btn:hover {
      background: #28a745;
    }

    .settings-modal .cancel-btn {
      background: rgba(142, 142, 147, 0.1);
      color: #98989d;
    }

    .settings-modal .cancel-btn:hover {
      background: rgba(142, 142, 147, 0.2);
      color: #f2f2f7;
    }

    .settings-modal .status-message {
      margin-top: 12px;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 13px;
      text-align: center;
    }

    .settings-modal .status-success {
      background: rgba(52, 199, 89, 0.1);
      color: #34c759;
      border: 1px solid rgba(52, 199, 89, 0.3);
    }

    .settings-modal .status-error {
      background: rgba(255, 59, 48, 0.1);
      color: #ff3b30;
      border: 1px solid rgba(255, 59, 48, 0.3);
    }
  `;

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const modal = document.createElement('div');
  modal.className = 'settings-modal';

  // Get voices for the dropdown
  let voices = [];
  try {
    if (currentApiKey) {
      voices = await fetchVoices(currentApiKey);
    }
  } catch (error) {
    console.log('Could not fetch voices:', error);
  }

  modal.innerHTML = `
    <div class="modal-content">
      <h3>Settings</h3>

      <div class="form-group">
        <label for="apiKeyInput">ElevenLabs API Key</label>
        <input type="password" id="apiKeyInput" value="${currentApiKey}" placeholder="Enter your API key">
      </div>

      <div class="form-group">
        <label for="voiceSelect">Voice</label>
        <select id="voiceSelect">
          <option value="">Select a voice</option>
          ${voices.map(voice => `<option value="${voice.voice_id}" ${voice.voice_id === currentVoiceId ? 'selected' : ''}>${voice.name}</option>`).join('')}
        </select>
      </div>

      <div id="statusMessage"></div>

      <div class="buttons">
        <button class="test-btn" id="testBtn">Test API</button>
        <button class="save-btn" id="saveBtn">Save</button>
        <button class="cancel-btn" id="cancelBtn">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const apiKeyInput = modal.querySelector('#apiKeyInput');
  const voiceSelect = modal.querySelector('#voiceSelect');
  const testBtn = modal.querySelector('#testBtn');
  const saveBtn = modal.querySelector('#saveBtn');
  const cancelBtn = modal.querySelector('#cancelBtn');
  const statusMessage = modal.querySelector('#statusMessage');

  // Test API functionality
  testBtn.onclick = async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      showStatus('Please enter an API key', 'error');
      return;
    }

    testBtn.disabled = true;
    testBtn.textContent = 'Testing...';

    try {
      const testVoices = await fetchVoices(apiKey);
      showStatus('API key is valid!', 'success');

      // Update voice dropdown with fetched voices
      voiceSelect.innerHTML = `
        <option value="">Select a voice</option>
        ${testVoices.map(voice => `<option value="${voice.voice_id}" ${voice.voice_id === voiceSelect.value ? 'selected' : ''}>${voice.name}</option>`).join('')}
      `;
    } catch (error) {
      showStatus(`API test failed: ${error.message}`, 'error');
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = 'Test API';
    }
  };

  // Save settings
  saveBtn.onclick = async () => {
    const apiKey = apiKeyInput.value.trim();
    const voiceId = voiceSelect.value;

    if (!apiKey) {
      showStatus('Please enter an API key', 'error');
      return;
    }

    if (!voiceId) {
      showStatus('Please select a voice', 'error');
      return;
    }

    try {
      await setSettings({ apiKey, voiceId });
      showStatus('Settings saved successfully!', 'success');

      // Close modal after a short delay
      setTimeout(() => {
        modal.remove();
        style.remove();
      }, 1500);
    } catch (error) {
      showStatus('Failed to save settings', 'error');
    }
  };

  // Cancel
  cancelBtn.onclick = () => {
    modal.remove();
    style.remove();
  };

  function showStatus(message, type) {
    statusMessage.innerHTML = `<div class="status-message status-${type}">${message}</div>`;
    setTimeout(() => {
      statusMessage.innerHTML = '';
    }, 3000);
  }
}

async function getApiKey() {
  return new Promise((resolve) => {
    showApiKeyPrompt((result) => resolve(result));
  });
}

// Reading UI Component
function showReadingUI(text, isLoading = false, savedVolume = 1, savedSpeed = 1, isChunked = false) {
  hideReadingUI(false); // Don't stop audio when refreshing UI

  // Inject CSS
  // Inject external CSS file
  const readingUiCssLink = document.createElement('link');
  readingUiCssLink.rel = 'stylesheet';
  readingUiCssLink.href = chrome.runtime.getURL('src/components/ui/ReadingUI.css');
  document.head.appendChild(readingUiCssLink);

  readingUI = document.createElement('div');
  readingUI.id = 'elevenvoicereader-ui';

  // Drag functionality will be set up after UI is rendered

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
        <div class="title-group">
          <img class="elf-hat-icon" src="${chrome.runtime.getURL('icons/icon-16.png')}" width="16" height="16" alt="Elf Hat">
          <span class="title">ElevenVoiceReader</span>
        </div>
        <div class="header-buttons">
          <button class="settings-btn" id="settingsBtn" title="Settings">⚙️</button>
          <button class="close-btn" id="closeBtn">×</button>
        </div>
      </div>
      <div class="content">
        ${isChunked ? '<div class="queue-progress"><div class="progress-bar" id="progressBar"></div><div class="progress-text" id="progressText">Starting playback...</div></div>' : ''}
        <div class="text-area">
          <textarea readonly id="textArea">${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
        </div>
        <div class="controls-section">
          <button id="playStopBtn" title="Play">▶</button>
          <div class="control-group">
            <label for="volumeSlider">Vol</label>
            <input type="range" id="volumeSlider" min="0" max="1" step="0.1" value="1">
          </div>
          <div class="control-group">
            <label for="speedSlider">Speed</label>
            <input type="range" id="speedSlider" min="0.5" max="2" step="0.1" value="1">
          </div>
        </div>
      </div>
      <div class="footer">
        <div class="github-link">
          Source Code Available on <a href="https://github.com/puppyprogrammer/ElevenVoiceReader" target="_blank">GitHub</a>
        </div>
      </div>
    `;

    // Setup drag functionality
    setupDragFunctionality();

    // Event listeners
    const currentAudio = getCurrentAudio();
    readingUI.querySelector('#closeBtn').onclick = () => {
      console.log('**Close button pressed**');
      stopAllAudio();
      hideReadingUI(false); // Audio already stopped
    };
    readingUI.querySelector('#settingsBtn').onclick = () => {
      console.log('**Settings button pressed**');
      showSettingsModal();
    };
    readingUI.querySelector('#playStopBtn').onclick = () => {
      const playStopBtn = readingUI.querySelector('#playStopBtn');
      if (!playStopBtn) return;

      if (readingQueue.chunks.length > 1) {
        // Chunked mode
        if (playStopBtn.textContent === '⏹') {
          // Stop button clicked - stop all and clear queue
          console.log('**Stop button pressed (chunked mode)**');
          stopAllAudio();
          playStopBtn.textContent = '▶';
          playStopBtn.title = 'Play';
          updateQueueProgress();
        } else if (playStopBtn.textContent === '▶') {
          // Play button clicked - start from current chunk
          console.log('**Play button pressed (chunked mode)**');
          playNextChunk(savedVolume, savedSpeed);
        }
      } else {
        // Single chunk mode
        if (playStopBtn.textContent === '▶') {
          // Button shows play, so restart audio
          console.log('**Play button pressed (single mode)**');
          if (currentBlob) {
            const text = readingUI.querySelector('textarea').value;
            playAudio(currentBlob, text, () => {}, () => {}, currentVolume, currentSpeed, true); // skipUI = true
          }
        } else if (playStopBtn.textContent === '⏹') {
          // Button shows stop, so stop audio completely
          console.log('**Stop button pressed (single mode)**');
          stopAllAudio();
          playStopBtn.textContent = '▶';
          playStopBtn.title = 'Play';
        }
      }
    };
    // Set initial values from saved settings
    const volumeSlider = readingUI.querySelector('#volumeSlider');
    const speedSlider = readingUI.querySelector('#speedSlider');

    if (volumeSlider) {
      volumeSlider.value = savedVolume;
      currentVolume = savedVolume; // Initialize global
    }

    if (speedSlider) {
      speedSlider.value = savedSpeed;
      currentSpeed = savedSpeed; // Initialize global
    }

    // Set audio properties if audio exists (for single chunk or resumed playback)
    if (currentGain) {
      currentGain.gain.value = currentVolume;
    }
    if (currentBufferSource) {
      currentBufferSource.playbackRate.value = currentSpeed;
    }

    if (volumeSlider) {
      volumeSlider.oninput = async (e) => {
        const volumeValue = parseFloat(e.target.value);
        currentVolume = volumeValue; // Store globally for future chunks
        if (currentGain) {
          currentGain.gain.value = volumeValue;
        }
        await setSettings({ volume: volumeValue });
      };
    }

    if (speedSlider) {
      speedSlider.oninput = async (e) => {
        const speedValue = parseFloat(e.target.value);
        currentSpeed = speedValue; // Store globally for future chunks
        if (currentBufferSource) {
          currentBufferSource.playbackRate.value = speedValue;
        }
        await setSettings({ speed: speedValue });
      };
    }
  }

  document.body.appendChild(readingUI);
}

function hideReadingUI(shouldStopAudio = true) {
  if (readingUI) {
    readingUI.remove();
    readingUI = null;
  }
  // Only stop audio if explicitly requested (e.g., when closing the UI)
  if (shouldStopAudio) {
    stopAllAudio();
  }
}

// Setup drag functionality for the reading UI
function setupDragFunctionality() {
  let isDragging = false;
  let startX, startY, startLeft, startTop;
  const header = readingUI.querySelector('.header');

  if (!header) return; // Header not found, skip drag setup

  header.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;

    // Get current position, accounting for transform
    const rect = readingUI.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;

    // Switch to absolute positioning for dragging
    readingUI.style.position = 'fixed';
    readingUI.style.left = startLeft + 'px';
    readingUI.style.top = startTop + 'px';
    readingUI.style.transform = 'none';

    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'move';

    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      readingUI.style.left = (startLeft + dx) + 'px';
      readingUI.style.top = (startTop + dy) + 'px';
    }
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      // Restore normal cursor and selection
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }
  });
}

// Main logic
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('**Content: Message received**', request.action);
  switch (request.action) {
    case 'ping':
      sendResponse({ pong: true });
      break;
    case 'initiateTTS':
      initiateTTS(request.text);
      sendResponse({ success: true });
      break;
    case 'getStatus':
      sendResponse({
        isPlaying: getCurrentAudio() ? !getCurrentAudio().paused && !getCurrentAudio().ended : false
      });
      break;
  }
});

// Text chunking utility - optimized for fast first chunk
function splitTextIntoChunks(text, maxChunkSize = 500) {
  const chunks = [];

  // Step 1: Extract first 2 sentences as ultra-fast first chunk
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length >= 2) {
    // First chunk: first 2 sentences
    const firstChunk = sentences[0].trim() + '. ' + sentences[1].trim() + '.';
    chunks.push(firstChunk);

    // Remaining text after first 2 sentences
    const remainingText = text.substring(text.indexOf(sentences[2] || ''));
    if (remainingText.trim()) {
      // Split remaining text into ~500 char chunks at sentence boundaries
      const remainingSentences = remainingText.split(/[.!?]+/).filter(s => s.trim().length > 0);
      let currentChunk = '';

      for (const sentence of remainingSentences) {
        const trimmedSentence = sentence.trim();
        if (!trimmedSentence) continue;

        if ((currentChunk + trimmedSentence).length <= maxChunkSize) {
          currentChunk += (currentChunk ? ' ' : '') + trimmedSentence;
        } else {
          if (currentChunk) chunks.push(currentChunk.trim() + '.');
          currentChunk = trimmedSentence;
        }
      }

      if (currentChunk) chunks.push(currentChunk.trim() + '.');
    }
  } else {
    // Fallback: if less than 2 sentences, use original logic
    let currentChunk = '';
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (!trimmedSentence) continue;

      if ((currentChunk + trimmedSentence).length <= maxChunkSize) {
        currentChunk += (currentChunk ? ' ' : '') + trimmedSentence;
      } else {
        if (currentChunk) chunks.push(currentChunk.trim() + '.');
        currentChunk = trimmedSentence;
      }
    }

    if (currentChunk) chunks.push(currentChunk.trim() + '.');
  }

  return chunks;
}

async function initiateTTS(text) {
  console.log('**TTS initiated** for text:', text.substring(0, 50) + '...');

  let settings = await getSettings(['apiKey', 'voiceId', 'volume', 'speed']);
  let apiKey = settings.apiKey;
  let voiceId = settings.voiceId || '21m00Tcm4TlvDq8ikWAM'; // default voice
  let savedVolume = settings.volume || 1;
  let savedSpeed = settings.speed || 1;

  if (!apiKey) {
    console.log('No API key found, prompting...');
    const result = await getApiKey();
    if (!result) {
      console.log('**API key prompt canceled**');
      return;
    }
    apiKey = result.apiKey;
    voiceId = result.voiceId;
    await setSettings({ apiKey, voiceId });
    console.log('API key and voice saved');
  }

  // Check if text needs chunking - lower threshold for faster first chunk
  const chunks = text.length > 500 ? splitTextIntoChunks(text) : [text];

  if (chunks.length > 1) {
    console.log(`**Long text detected: ${chunks.length} chunks**`);
    await initiateChunkedTTS(text, chunks, voiceId, apiKey, savedVolume, savedSpeed);
  } else {
    // Single chunk - use existing logic
    showReadingUI(text, true); // IMMEDIATE loading popup

    try {
      const blob = await generateTTS(text, voiceId, apiKey);
      console.log('**TTS blob ready**, size:', blob.size);

      // Play audio
      playAudio(blob, text, showReadingUI, hideReadingUI, savedVolume, savedSpeed);

    } catch (error) {
      console.error('**TTS failed**:', error);
      hideReadingUI();
    }
  }
}

// Chunked TTS processing
async function initiateChunkedTTS(fullText, chunks, voiceId, apiKey, savedVolume, savedSpeed) {
  // Initialize queue
  readingQueue = {
    chunks: chunks,
    currentIndex: 0,
    status: 'processing',
    audioBuffers: new Array(chunks.length).fill(null),
    processingIndex: 0
  };

  console.log(`**Starting chunked TTS: ${chunks.length} chunks**`);

  // Show full UI immediately with queue indicator (not loading state)
  showReadingUI(fullText, false, savedVolume, savedSpeed, true); // false = not loading, true = chunked mode

  // Initialize progress bar with segments
  updateQueueProgress();

  // Start processing chunks asynchronously
  processChunksAsync(chunks, voiceId, apiKey, savedVolume, savedSpeed);
}

// Process chunks asynchronously - start playing first chunk as soon as ready
async function processChunksAsync(chunks, voiceId, apiKey, savedVolume, savedSpeed) {
  try {
    for (let i = 0; i < chunks.length; i++) {
      console.log(`**Processing chunk ${i + 1}/${chunks.length}**`);

      const blob = await generateTTS(chunks[i], voiceId, apiKey);
      readingQueue.audioBuffers[i] = blob;
      readingQueue.processingIndex = i + 1;

      console.log(`**Chunk ${i + 1} ready, size: ${blob.size}**`);

      // If this is the first chunk, start playing immediately
      if (i === 0) {
        readingQueue.status = 'playing';
        await playChunkedAudio(savedVolume, savedSpeed);
      }

      // Update UI progress
      updateQueueProgress();
    }

    readingQueue.status = 'idle'; // All processed
    updateQueueProgress();

  } catch (error) {
    console.error('**Chunked TTS failed**:', error);
    readingQueue.status = 'error';
    updateQueueProgress();
  }
}

// Update queue progress in UI
function updateQueueProgress() {
  if (!readingUI) return;

  const progressBar = readingUI.querySelector('#progressBar');
  const progressText = readingUI.querySelector('#progressText');

  if (progressBar && progressText) {
    const totalChunks = readingQueue.chunks.length;
    const processedChunks = readingQueue.processingIndex;
    const currentChunk = readingQueue.currentIndex + 1;

    // Clear existing segments
    progressBar.innerHTML = '';

    // Create segments for each chunk
    for (let i = 0; i < totalChunks; i++) {
      const segment = document.createElement('div');
      segment.className = 'progress-segment';
      segment.dataset.chunkIndex = i;

      // Determine segment state
      if (i < processedChunks) {
        segment.classList.add('processed');
      }
      if (readingQueue.status === 'playing' && i === readingQueue.currentIndex) {
        segment.classList.add('playing');
      }

      // Add click handler
      segment.onclick = () => {
        playSpecificChunk(i);
        showChunkText(i);
      };

      progressBar.appendChild(segment);
    }

    if (readingQueue.status === 'playing') {
      if (currentChunk === 1) {
        progressText.textContent = `Playing... (${processedChunks}/${totalChunks} ready)`;
      } else {
        progressText.textContent = `Playing chunk ${currentChunk} of ${totalChunks}`;
      }
    } else if (readingQueue.status === 'processing') {
      progressText.textContent = `Loading... (${processedChunks}/${totalChunks} ready)`;
    } else {
      progressText.textContent = `Ready: ${totalChunks} chunks`;
    }
  }
}

// Play a specific chunk by index (doesn't auto-advance)
async function playSpecificChunk(chunkIndex) {
  if (chunkIndex < 0 || chunkIndex >= readingQueue.audioBuffers.length) {
    console.error(`**Invalid chunk index: ${chunkIndex}**`);
    return;
  }

  const blob = readingQueue.audioBuffers[chunkIndex];
  if (!blob) {
    console.error(`**Audio buffer for chunk ${chunkIndex} not ready**`);
    return;
  }

  console.log(`**Playing specific chunk ${chunkIndex + 1}/${readingQueue.audioBuffers.length}**`);

  // Stop any current audio
  stopAudio(hideReadingUI, true);

  // Update queue state
  readingQueue.currentIndex = chunkIndex;
  readingQueue.status = 'playing';

  // Update UI
  updateQueueProgress();

  // Get settings for volume/speed
  let settings = await getSettings(['volume', 'speed']);
  let savedVolume = settings.volume || 1;
  let savedSpeed = settings.speed || 1;

  // Play the chunk (single chunk, no auto-advance)
  await playChunkAudio(blob, savedVolume, savedSpeed);

  // Don't continue to next chunk - this is manual playback
}

// Show text for a specific chunk
function showChunkText(chunkIndex) {
  if (chunkIndex < 0 || chunkIndex >= readingQueue.chunks.length) {
    return;
  }

  const textArea = readingUI.querySelector('#textArea');
  if (textArea) {
    textArea.value = readingQueue.chunks[chunkIndex];
  }
}

// Play chunked audio sequentially
async function playChunkedAudio(savedVolume, savedSpeed) {
  if (readingQueue.audioBuffers.length === 0 || !readingQueue.audioBuffers[0]) {
    console.error('**No audio buffer available for chunked playback**');
    return;
  }

  readingQueue.status = 'playing';
  readingQueue.currentIndex = 0;

  // Start playing first chunk
  await playNextChunk(savedVolume, savedSpeed);
}

// Play a single chunk of audio
async function playChunkAudio(blob, savedVolume, savedSpeed) {
  // Stop any current audio
  stopAudio(hideReadingUI, true); // Destroy old audio before creating new one

  // Initialize Web Audio API
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  // Decode audio blob to AudioBuffer
  const arrayBuffer = await blob.arrayBuffer();
  currentAudioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // Create audio buffer source node
  currentBufferSource = audioContext.createBufferSource();
  currentBufferSource.buffer = currentAudioBuffer;

  // Create gain node for volume control
  currentGain = audioContext.createGain();

  // Use stored slider values
  currentGain.gain.value = currentVolume;
  currentBufferSource.playbackRate.value = currentSpeed;

  // Connect audio graph: source -> gain -> destination
  currentBufferSource.connect(currentGain);
  currentGain.connect(audioContext.destination);

  // Apply current slider values immediately after creating audio
  if (readingUI) {
    const volumeSlider = readingUI.querySelector('#volumeSlider');
    const speedSlider = readingUI.querySelector('#speedSlider');
    if (volumeSlider) {
      const sliderVolume = parseFloat(volumeSlider.value);
      currentGain.gain.value = sliderVolume;
      currentVolume = sliderVolume;
    }
    if (speedSlider) {
      const sliderSpeed = parseFloat(speedSlider.value);
      currentBufferSource.playbackRate.value = sliderSpeed;
      currentSpeed = sliderSpeed;
    }
  }

  // Set up event listeners
  currentBufferSource.addEventListener('ended', () => {
    console.log('**Chunk audio ended**');
    isPlaying = false;
    // Update button to show play icon when audio ends
    if (readingUI) {
      const playStopBtn = readingUI.querySelector('#playStopBtn');
      if (playStopBtn) {
        playStopBtn.textContent = '▶';
        playStopBtn.title = 'Play';
      }
    }
    // Clean up
    currentBufferSource = null;
    currentGain = null;
    currentAudioBuffer = null;
  });

  // Start playback
  currentBufferSource.start(0);
  isPlaying = true;
  isStopping = false; // Reset stopping flag when starting

  // Update UI for playing
  if (readingUI) {
    const playStopBtn = readingUI.querySelector('#playStopBtn');
    if (playStopBtn) {
      playStopBtn.textContent = '⏹';
      playStopBtn.title = 'Stop';
    }
  }
}

// Play next chunk in sequence
async function playNextChunk(savedVolume, savedSpeed) {
  const currentIndex = readingQueue.currentIndex;

  if (currentIndex >= readingQueue.audioBuffers.length) {
    // All chunks played
    readingQueue.status = 'idle';
    updateQueueProgress();
    // Update button to show play icon
    if (readingUI) {
      const playStopBtn = readingUI.querySelector('#playStopBtn');
      if (playStopBtn) {
        playStopBtn.textContent = '▶';
        playStopBtn.title = 'Play';
      }
    }
    return;
  }

  const blob = readingQueue.audioBuffers[currentIndex];
  if (!blob) {
    console.error(`**Audio buffer for chunk ${currentIndex} not ready**`);
    // Try next chunk
    readingQueue.currentIndex++;
    playNextChunk(savedVolume, savedSpeed);
    return;
  }

  console.log(`**Playing chunk ${currentIndex + 1}/${readingQueue.audioBuffers.length}**`);

  // Stop any current audio
  stopAudio(hideReadingUI, true); // Destroy old audio before creating new one

  // Initialize Web Audio API
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  // Decode audio blob to AudioBuffer
  const arrayBuffer = await blob.arrayBuffer();
  currentAudioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // Create audio buffer source node
  currentBufferSource = audioContext.createBufferSource();
  currentBufferSource.buffer = currentAudioBuffer;

  // Create gain node for volume control
  currentGain = audioContext.createGain();

  // Use stored slider values
  currentGain.gain.value = currentVolume;
  currentBufferSource.playbackRate.value = currentSpeed;

  // Connect audio graph: source -> gain -> destination
  currentBufferSource.connect(currentGain);
  currentGain.connect(audioContext.destination);

  // Apply current slider values immediately after creating audio
  if (readingUI) {
    const volumeSlider = readingUI.querySelector('#volumeSlider');
    const speedSlider = readingUI.querySelector('#speedSlider');
    if (volumeSlider) {
      const sliderVolume = parseFloat(volumeSlider.value);
      currentGain.gain.value = sliderVolume;
      currentVolume = sliderVolume;
    }
    if (speedSlider) {
      const sliderSpeed = parseFloat(speedSlider.value);
      currentBufferSource.playbackRate.value = sliderSpeed;
      currentSpeed = sliderSpeed;
    }
  }
  // Set up event listeners
  currentBufferSource.addEventListener('ended', async () => {
    console.log(`**Chunk ${currentIndex + 1} ended**`);
    if (!isStopping) {
      // Play next chunk only if not manually stopped
      readingQueue.currentIndex++;
      updateQueueProgress();
      await playNextChunk(savedVolume, savedSpeed);
    } else {
      // Reset the stopping flag
      isStopping = false;
    }
  });

  // Start playback
  currentBufferSource.start(0);
  isPlaying = true;
  isStopping = false; // Reset stopping flag when starting

  // Update UI for playing
  readingQueue.status = 'playing';
  updateQueueProgress();
  // Update button to show stop when playing
  if (readingUI) {
    const playStopBtn = readingUI.querySelector('#playStopBtn');
    if (playStopBtn) {
      console.log('**Setting chunked button to stop icon**');
      playStopBtn.textContent = '⏹';
      playStopBtn.title = 'Stop';
    } else {
      console.log('**Chunked playStopBtn not found**');
    }
  } else {
    console.log('**Chunked readingUI not set**');
  }
}
