// Content script for ElevenVoiceReader

console.log('**Content script loaded**');

// Audio globals
let currentAudio = null;
let audioBlobUrl = null;

// UI globals
let readingUI = null;

// Chrome storage utilities
async function getSettings(keys) {
  return await chrome.storage.sync.get(keys);
}

async function setSettings(settings) {
  await chrome.storage.sync.set(settings);
}

// Audio utilities
function playAudio(blob, text, showReadingUI, hideReadingUI, savedVolume = 1, savedSpeed = 1) {
  stopAudio(hideReadingUI);
  audioBlobUrl = URL.createObjectURL(blob);
  currentAudio = new Audio(audioBlobUrl);
  currentAudio.volume = savedVolume;
  currentAudio.playbackRate = savedSpeed;

  // Upgrade UI to full controls
  showReadingUI(text, false, savedVolume, savedSpeed);

  currentAudio.addEventListener('play', () => {
    // Update button to show stop icon when audio starts playing
    if (readingUI) {
      const playStopBtn = readingUI.querySelector('#playStopBtn');
      if (playStopBtn) {
        playStopBtn.textContent = '⏹';
        playStopBtn.title = 'Stop';
      }
    }
  });

  currentAudio.addEventListener('ended', () => {
    console.log('**Audio ended**');
    // Update button to show play icon when audio ends (since it's now stopped)
    if (readingUI) {
      const playStopBtn = readingUI.querySelector('#playStopBtn');
      if (playStopBtn) {
        playStopBtn.textContent = '▶';
        playStopBtn.title = 'Play';
      }
    }
    // Clean up audio when it ends naturally
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    if (audioBlobUrl) {
      URL.revokeObjectURL(audioBlobUrl);
      audioBlobUrl = null;
    }
    currentAudio = null;
  });

  currentAudio.addEventListener('pause', () => {
    // Update button to show play icon when audio is paused/stopped
    if (readingUI) {
      const playStopBtn = readingUI.querySelector('#playStopBtn');
      if (playStopBtn) {
        playStopBtn.textContent = '▶';
        playStopBtn.title = 'Play';
      }
    }
  });

  currentAudio.addEventListener('error', (e) => {
    console.error('**Audio error**:', e);
    stopAudio(hideReadingUI, true); // true = destroy audio on error
  });

  currentAudio.play().catch(console.error);
}

function stopAudio(hideReadingUI, destroyAudio = true) {
  console.log('**stopAudio called** - currentAudio:', currentAudio, 'destroy:', destroyAudio);
  if (currentAudio) {
    console.log('**Pausing audio**');
    currentAudio.pause();
    currentAudio.currentTime = 0;
    if (destroyAudio) {
      // Only destroy audio when ending naturally or on error
      if (audioBlobUrl) {
        URL.revokeObjectURL(audioBlobUrl);
        audioBlobUrl = null;
      }
      currentAudio = null;
    }
    // If not destroying, keep audio for potential restart
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
  // Inject CSS
  const css = `.api-key-modal {
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

  .api-key-modal .modal-content {
    background: rgba(28, 28, 30, 0.95);
    backdrop-filter: blur(20px);
    padding: 24px;
    border-radius: 12px;
    max-width: 420px;
    text-align: center;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    border: 1px solid rgba(142, 142, 147, 0.3);
  }

  .api-key-modal h3 {
    margin-top: 0;
    color: #f2f2f7;
    font-weight: 600;
    font-size: 18px;
  }

  .api-key-modal p {
    margin: 12px 0;
    color: #98989d;
    font-size: 14px;
    line-height: 1.5;
  }

  .api-key-modal a {
    color: #4a9eff;
    text-decoration: none;
  }

  .api-key-modal a:hover {
    text-decoration: underline;
  }

  .api-key-modal input {
    width: 100%;
    padding: 12px;
    margin: 12px 0;
    border: 1px solid rgba(142, 142, 147, 0.3);
    border-radius: 6px;
    box-sizing: border-box;
    font-size: 14px;
    background: rgba(44, 44, 46, 0.95);
    color: #f2f2f7;
    transition: border-color 0.2s;
  }

  .api-key-modal input:focus {
    outline: none;
    border-color: #4a9eff;
  }

  .api-key-modal select {
    width: 100%;
    padding: 12px;
    margin: 12px 0;
    border: 1px solid rgba(142, 142, 147, 0.3);
    border-radius: 6px;
    box-sizing: border-box;
    font-size: 14px;
    background: rgba(44, 44, 46, 0.95);
    color: #f2f2f7;
    transition: border-color 0.2s;
  }

  .api-key-modal select:focus {
    outline: none;
    border-color: #4a9eff;
  }

  .api-key-modal .buttons {
    display: flex;
    justify-content: center;
    gap: 8px;
    margin-top: 20px;
  }

  .api-key-modal button {
    padding: 10px 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s;
    min-width: 80px;
  }

  .api-key-modal button:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  }

  .api-key-modal #submitKey {
    background: #4a9eff;
    color: white;
  }

  .api-key-modal #cancelKey {
    background: #8e8e93;
    color: white;
  }

  .api-key-modal #saveSettings {
    background: #34c759;
    color: white;
  }

  .api-key-modal #backKey {
    background: #8e8e93;
    color: white;
  }

  .api-key-modal .loading {
    margin: 12px 0;
    color: #f2f2f7;
  }`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

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
        style.remove();
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
          style.remove();
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
          style.remove();
          callback(null);
        };
      };
      modal.querySelector('#cancelKey').onclick = () => {
        modal.remove();
        style.remove();
        callback(null);
      };
    }
  };

  modal.querySelector('#cancelKey').onclick = () => {
    modal.remove();
    style.remove();
    callback(null);
  };
}

async function getApiKey() {
  return new Promise((resolve) => {
    showApiKeyPrompt((result) => resolve(result));
  });
}

// Reading UI Component
function showReadingUI(text, isLoading = false, savedVolume = 1, savedSpeed = 1) {
  hideReadingUI();

  // Inject CSS
  // Inject external CSS file
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('src/components/ui/ReadingUI.css');
  document.head.appendChild(link);

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
          <svg class="elf-hat-icon" viewBox="0 0 16 16" width="16" height="16" fill="#4a9eff">
            <path d="M8 2L6 6h4L8 2z" fill="#228B22"/>
            <path d="M8 2L10 6h-4L8 2z" fill="#32CD32"/>
            <path d="M6 6L8 10L10 6z" fill="#228B22"/>
            <circle cx="8" cy="11" r="1" fill="#FFD700"/>
            <path d="M7 12Q8 13 9 12" stroke="#FFD700" stroke-width="0.5" fill="none"/>
          </svg>
          <span class="title">ElevenVoiceReader</span>
        </div>
        <button class="close-btn" id="closeBtn">×</button>
      </div>
      <div class="content">
        <div class="text-area">
          <textarea readonly>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
        </div>
        <div class="controls-section">
          <button id="playStopBtn" title="Play/Stop">▶</button>
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
    readingUI.querySelector('#closeBtn').onclick = hideReadingUI;
    readingUI.querySelector('#playStopBtn').onclick = () => {
      const playStopBtn = readingUI.querySelector('#playStopBtn');
      if (!playStopBtn) return;

      if (playStopBtn.textContent === '▶') {
        // Button shows play, so try to play/restart audio
        if (currentAudio) {
          console.log('**Playing audio**');
          currentAudio.play().catch(console.error);
          // Event listener will update button to ⏹ when audio starts
        } else {
          console.log('**No audio to play**');
        }
      } else if (playStopBtn.textContent === '⏹') {
        // Button shows stop, so pause audio (don't destroy)
        console.log('**Stopping audio**');
        stopAudio(hideReadingUI, false); // false = don't destroy audio
        // Update button to show play immediately
        playStopBtn.textContent = '▶';
        playStopBtn.title = 'Play';
      }
    };
    // Set initial values from saved settings
    readingUI.querySelector('#volumeSlider').value = savedVolume;
    readingUI.querySelector('#speedSlider').value = savedSpeed;
    currentAudio.volume = savedVolume;
    currentAudio.playbackRate = savedSpeed;

    readingUI.querySelector('#volumeSlider').oninput = async (e) => {
      currentAudio.volume = e.target.value;
      await setSettings({ volume: parseFloat(e.target.value) });
    };
    readingUI.querySelector('#speedSlider').oninput = async (e) => {
      currentAudio.playbackRate = e.target.value;
      await setSettings({ speed: parseFloat(e.target.value) });
    };
  }

  document.body.appendChild(readingUI);
}

function hideReadingUI() {
  if (readingUI) {
    readingUI.remove();
    readingUI = null;
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

  if (text.length > 5000) {
    console.error('**Text too long**');
    return;
  }

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
