/**
 * Chrome storage utilities
 */

/**
 * Gets settings from chrome.storage.sync
 * @param {Array<string>} keys - Keys to retrieve
 * @returns {Promise<Object>} - Settings object
 */
export async function getSettings(keys) {
  return await chrome.storage.sync.get(keys);
}

/**
 * Sets a setting in chrome.storage.sync
 * @param {Object} settings - Key-value pairs to set
 * @returns {Promise<void>}
 */
export async function setSettings(settings) {
  await chrome.storage.sync.set(settings);
}