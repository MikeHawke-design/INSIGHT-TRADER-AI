import React, { useState, useEffect, useRef } from 'react';
import { synthesizeSpeech } from '../tts';

// Icons for the button states
const PlayIcon = (props: { className?: string }) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path d="M6.3 2.841A1.5 1.5 0 0 0 4 4.11V15.89a1.5 1.5 0 0 0 2.3 1.269l9.344-5.89a1.5 1.5 0 0 0 0-2.538L6.3 2.84Z" />
    </svg>
);

const StopIcon = (props: { className?: string }) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path d="M5.5 5.5A.5.5 0 0 1 6 5h8a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-.5.5H6a.5.5 0 0 1-.5-.5v-8Z" />
    </svg>
);

const LoadingIcon = (props: { className?: string }) => (
     <svg {...props} className={`animate-spin ${props.className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const ErrorIcon = (props: { className?: string }) => (
     <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8.28-2.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.28 1.28a.75.75 0 1 0 1.06 1.06L10 11.06l1.28 1.28a.75.75 0 1 0 1.06-1.06L11.06 10l1.28-1.28a.75.75 0 0 0-1.06-1.06L10 8.94l-1.28-1.28Z" clipRule="evenodd" />
    </svg>
);

interface SpeechSynthesisButtonProps {
  textToSpeak: string;
  apiKey: string;
  voiceName: string;
}

const SpeechSynthesisButton: React.FC<SpeechSynthesisButtonProps> = ({ textToSpeak, apiKey, voiceName }) => {
    const [status, setStatus] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, []);

    const handleToggleSpeech = async () => {
        if (status === 'playing') {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
            setStatus('idle');
            return;
        }

        if (status === 'loading') {
            return;
        }

        setStatus('loading');

        try {
            const audioContent = await synthesizeSpeech(textToSpeak, apiKey, voiceName);
            
            if (!audioRef.current) {
                audioRef.current = new Audio();
                audioRef.current.onended = () => setStatus('idle');
                audioRef.current.onerror = () => {
                    console.error("Audio playback error.");
                    setStatus('error');
                    setTimeout(() => setStatus('idle'), 2000);
                };
            }
            
            audioRef.current.src = `data:audio/mp3;base64,${audioContent}`;
            audioRef.current.play();
            setStatus('playing');

        } catch (error) {
            console.error('Speech synthesis failed:', error);
            setStatus('error');
            setTimeout(() => setStatus('idle'), 2000); // Reset after 2s
        }
    };
    
    const renderIcon = () => {
        switch (status) {
            case 'playing':
                return <StopIcon className="w-5 h-5 text-yellow-400" />;
            case 'loading':
                return <LoadingIcon className="w-5 h-5 text-gray-400" />;
            case 'error':
                return <ErrorIcon className="w-5 h-5 text-red-500" />;
            case 'idle':
            default:
                return <PlayIcon className="w-5 h-5" />;
        }
    };

    if (!apiKey) {
        return null; // Don't render if there's no API key to use
    }

    return (
        <button
            onClick={handleToggleSpeech}
            disabled={status === 'loading'}
            className="p-1.5 rounded-full text-gray-400 hover:bg-gray-700 hover:text-yellow-400 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500 disabled:cursor-wait"
            aria-label={status === 'playing' ? "Stop reading aloud" : "Read text aloud"}
            title={status === 'error' ? 'Failed to generate audio' : (status === 'playing' ? 'Stop' : 'Play')}
        >
            {renderIcon()}
        </button>
    );
};

export default SpeechSynthesisButton;