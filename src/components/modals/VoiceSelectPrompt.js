// Voice Selection Prompt Modal Component
// Note: This is a reference file for modularity. The actual function is inlined in content.js due to Chrome extension compatibility.

function showVoiceSelectPrompt(apiKey, voices, callback, modal, style) {
  // Update modal content for voice selection
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
    // Reattach events for API key step
    modal.querySelector('#submitKey').onclick = async () => {
      const newApiKey = modal.querySelector('#apiKeyInput').value.trim();
      if (!newApiKey) return;

      modal.querySelector('.modal-content').innerHTML = `
        <h3>Validating API Key...</h3>
        <div class="loading">⏳</div>
      `;

      try {
        const newVoices = await fetchVoices(newApiKey);
        showVoiceSelectPrompt(newApiKey, newVoices, callback, modal, style);
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
  };
}