/**
 * Audio playback utilities
 */

let currentAudio = null;
let audioBlobUrl = null;

/**
 * Plays the audio blob and sets up UI
 * @param {Blob} blob - The audio blob
 * @param {string} text - The text being read
 * @param {Function} showReadingUI - Function to show the reading UI
 * @param {Function} hideReadingUI - Function to hide the reading UI
 * @param {number} savedVolume - Saved volume setting (0-1)
 * @param {number} savedSpeed - Saved speed setting (0.5-2)
 */
export function playAudio(blob, text, showReadingUI, hideReadingUI, savedVolume = 1, savedSpeed = 1) {
  stopAudio(hideReadingUI);
  audioBlobUrl = URL.createObjectURL(blob);
  currentAudio = new Audio(audioBlobUrl);
  currentAudio.volume = savedVolume;
  currentAudio.playbackRate = savedSpeed;

  // Upgrade UI to full controls
  showReadingUI(text, false, savedVolume, savedSpeed);

  currentAudio.addEventListener('ended', () => {
    console.log('**Audio ended**');
    stopAudio(hideReadingUI);
  });

  currentAudio.addEventListener('error', (e) => {
    console.error('**Audio error**:', e);
    stopAudio(hideReadingUI);
  });

  currentAudio.play().catch(console.error);
}

/**
 * Stops the current audio playback
 * @param {Function} hideReadingUI - Function to hide the reading UI
 */
export function stopAudio(hideReadingUI) {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }
  if (audioBlobUrl) {
    URL.revokeObjectURL(audioBlobUrl);
    audioBlobUrl = null;
  }
  currentAudio = null;
  // Note: UI update is handled by the component
}

/**
 * Gets the current audio element
 * @returns {HTMLAudioElement|null}
 */
export function getCurrentAudio() {
  return currentAudio;
}