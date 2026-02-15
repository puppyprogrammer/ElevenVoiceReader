/**
 * ElevenLabs API utilities
 */

/**
 * Generates TTS audio blob from text using ElevenLabs API
 * @param {string} text - The text to convert to speech
 * @param {string} voiceId - The voice ID to use
 * @param {string} apiKey - The ElevenLabs API key
 * @returns {Promise<Blob>} - The audio blob
 */
export async function generateTTS(text, voiceId, apiKey) {
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

/**
 * Fetches available voices from ElevenLabs API
 * @param {string} apiKey - The ElevenLabs API key
 * @returns {Promise<Array>} - Array of voice objects
 */
export async function fetchVoices(apiKey) {
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