// API Key Prompt Modal Component
// Note: This is a reference file for modularity. The actual function is inlined in content.js due to Chrome extension compatibility.

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
  }

  .api-key-modal .modal-content {
    background: white;
    padding: 20px;
    border-radius: 10px;
    max-width: 400px;
    text-align: center;
  }

  .api-key-modal h3 {
    margin-top: 0;
  }

  .api-key-modal p {
    margin: 10px 0;
  }

  .api-key-modal input {
    width: 100%;
    padding: 10px;
    margin: 10px 0;
    border: 1px solid #ccc;
    border-radius: 5px;
    box-sizing: border-box;
  }

  .api-key-modal .buttons {
    display: flex;
    justify-content: center;
    gap: 10px;
  }

  .api-key-modal button {
    padding: 10px 20px;
    border: none;
    border-radius: 5px;
    cursor: pointer;
  }

  .api-key-modal #submitKey {
    background: #007bff;
    color: white;
  }

  .api-key-modal #cancelKey {
    background: #6c757d;
    color: white;
  }

  .api-key-modal .loading {
    margin: 10px 0;
  }`;

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const modal = document.createElement('div');
  modal.className = 'api-key-modal';

  // API Key Input Step
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

    // Show loading and validate
    modal.querySelector('.modal-content').innerHTML = `
      <h3>Validating API Key...</h3>
      <div class="loading">⏳</div>
    `;

    try {
      const voices = await fetchVoices(apiKey);
      // Proceed to voice selection
      showVoiceSelectPrompt(apiKey, voices, callback, modal, style);
    } catch (error) {
      // Show error and retry option
      modal.querySelector('.modal-content').innerHTML = `
        <h3>Invalid API Key</h3>
        <p>${error.message}</p>
        <div class="buttons">
          <button id="retryKey">Retry</button>
          <button id="cancelKey">Cancel</button>
        </div>
      `;
      modal.querySelector('#retryKey').onclick = () => {
        // Back to input
        modal.querySelector('.modal-content').innerHTML = `
          <h3>ElevenLabs API Key Required</h3>
          <p>Get your API key from <a href="https://elevenlabs.io/app/profile" target="_blank">ElevenLabs</a></p>
          <input type="password" id="apiKeyInput" placeholder="Enter your API key">
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