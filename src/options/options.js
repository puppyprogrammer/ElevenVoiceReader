import { fetchVoices } from '../api/index.js';
import { getSettings, setSettings } from '../utils/index.js';

// Load settings on page load
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
});

async function loadSettings() {
  const result = await getSettings(['apiKey', 'voiceId']);
  document.getElementById('apiKey').value = result.apiKey || '';
  const savedVoiceId = result.voiceId || '';
  
  toggleSaveButton();
  
  // Auto-test if API key (populate voices + restore selection)
  const apiKeyInput = document.getElementById('apiKey').value.trim();
  if (apiKeyInput) {
    await testApiKey(savedVoiceId);
  }
}

async function testApiKey(savedVoiceId = '') {
  const apiKey = document.getElementById('apiKey').value.trim();
  if (!apiKey) {
    showStatus('Please enter your API key first.', 'error');
    return;
  }
  
  const statusEl = document.getElementById('status');
  statusEl.textContent = 'Testing API key...';
  statusEl.className = 'status';
  
  try {
    const voices = await fetchVoices(apiKey);
    
    // Populate voice dropdown with ALL voices (incl. custom "My Voices"), sorted
    const select = document.getElementById('voiceSelect');
    select.innerHTML = '<option value="">Select a voice</option>';
    
    voices
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(voice => {
        const option = document.createElement('option');
        option.value = voice.voice_id;
        option.textContent = voice.name +
          (voice.labels?.accent ? ' (' + voice.labels.accent + ')' : '') +
          (voice.labels?.gender ? ' | ' + voice.labels.gender : '');
        select.appendChild(option);
      });

    // Restore saved voice selection
    if (savedVoiceId) {
      document.getElementById('voiceSelect').value = savedVoiceId;
    }

    showStatus(`✅ Success! Loaded ${voices.length} voices (incl. your custom ones).`, 'success');
    document.getElementById('voiceSelect').disabled = false;
    toggleSaveButton();
    
  } catch (error) {
    showStatus(`API test failed: ${error.message}`, 'error');
  }
}

async function saveSettings() {
  const apiKey = document.getElementById('apiKey').value.trim();
  const voiceId = document.getElementById('voiceSelect').value;
  
  await setSettings({ apiKey, voiceId });
  
  showStatus('✅ Settings saved successfully! You can now use Read Aloud.', 'success');
}

function showStatus(message, type) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}

function toggleSaveButton() {
  const apiKey = document.getElementById('apiKey').value.trim();
  const voiceId = document.getElementById('voiceSelect').value;
  const saveBtn = document.getElementById('saveBtn');
  
  saveBtn.disabled = !apiKey || !voiceId;
}

// Event listeners
document.getElementById('testBtn').addEventListener('click', testApiKey);

document.getElementById('apiKey').addEventListener('input', toggleSaveButton);
document.getElementById('voiceSelect').addEventListener('change', toggleSaveButton);

document.getElementById('settingsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  await saveSettings();
});

// Load any saved voice selection
(async () => {
  const result = await getSettings(['voiceId']);
  if (result.voiceId) {
    document.getElementById('voiceSelect').value = result.voiceId;
  }
})();