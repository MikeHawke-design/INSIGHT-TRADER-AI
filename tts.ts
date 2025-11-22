const TTS_API_ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';

/**
 * Calls the Google Cloud Text-to-Speech API to synthesize audio from text.
 * @param text The text to synthesize.
 * @param apiKey The user's Google Cloud API key.
 * @param voiceName The name of the voice model to use (e.g., 'en-US-Wavenet-D').
 * @returns A base64 encoded string of the audio content (MP3).
 */
export async function synthesizeSpeech(text: string, apiKey: string, voiceName: string): Promise<string> {
    if (!apiKey) {
        throw new Error("API key is not provided.");
    }

    // Add a defensive check to ensure voiceName is valid, falling back to a default if not.
    const effectiveVoiceName = voiceName || 'en-US-Standard-C';

    // 1. Remove markdown-style asterisks to prevent them from being read aloud.
    const textForSpeech = text.replace(/\*/g, '');

    // 2. Clean text by stripping any remaining HTML tags to get pure text content.
    const cleanedText = new DOMParser().parseFromString(textForSpeech, 'text/html').body.textContent || "";
    if (!cleanedText.trim()) {
        throw new Error("Text to speak is empty after cleaning.");
    }

    const languageCode = effectiveVoiceName.substring(0, 5); // e.g., 'en-US'
    
    const response = await fetch(`${TTS_API_ENDPOINT}?key=${apiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            input: { text: cleanedText },
            voice: {
                languageCode: languageCode,
                name: effectiveVoiceName,
            },
            audioConfig: {
                audioEncoding: 'MP3',
                speakingRate: 1.25,
                pitch: 0,
            },
        }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("Google TTS API Error:", JSON.stringify(errorData, null, 2));
        
        const message = errorData.error?.message || 'Failed to synthesize speech.';
        const reason = errorData.error?.details?.[0]?.reason;

        const isApiKeyProblem = message.includes('API key not valid') || 
                                message.includes('API has not been used') ||
                                reason === 'API_KEY_SERVICE_BLOCKED' ||
                                message.toLowerCase().includes('are blocked');

        // Add a helpful tip for the user for common API key issues.
        if (isApiKeyProblem) {
            throw new Error('Permission Denied. The Text-to-Speech API is likely not enabled for your project. Please go to your Google Cloud Console, search for "Cloud Text-to-Speech API", and click "Enable".');
        }
        throw new Error(message);
    }

    const data = await response.json();
    return data.audioContent; // This is a base64 encoded string
}