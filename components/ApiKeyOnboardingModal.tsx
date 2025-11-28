import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";

const InfoIcon = (props: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" {...props}>
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
    </svg>
);

const LoadingSpinner = () => (
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);


interface ApiKeyOnboardingModalProps {
    isOpen: boolean;
    onSave: (keys: { gemini: string; openai: string }) => void;
    onClose: () => void;
}

const ApiKeyOnboardingModal: React.FC<ApiKeyOnboardingModalProps> = ({ isOpen, onSave, onClose }) => {
    const [geminiApiKey, setGeminiApiKey] = useState('');
    const [openaiApiKey, setOpenaiApiKey] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
        setIsLoading(true);
        setError('');

        if (!geminiApiKey.trim() && !openaiApiKey.trim()) {
            setError('Please provide at least one API key (Gemini or OpenAI) to proceed.');
            setIsLoading(false);
            return;
        }

        if (geminiApiKey.trim()) {
            try {
                const ai = new GoogleGenAI({ apiKey: geminiApiKey });
                await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: 'test' });
            } catch (e) {
                const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
                if (errorMessage.toLowerCase().includes('api key not valid')) {
                    setError('The provided Gemini API Key is not valid. Please check and try again.');
                } else {
                    setError(`Gemini key validation failed: ${errorMessage}.`);
                }
                setIsLoading(false);
                return;
            }
        }

        if (openaiApiKey.trim()) {
            try {
                const response = await fetch('https://api.openai.com/v1/models', {
                    headers: { 'Authorization': `Bearer ${openaiApiKey}` }
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error?.message || 'The key is invalid.');
                }
            } catch (e) {
                const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
                setError(`OpenAI key validation failed: ${errorMessage}`);
                setIsLoading(false);
                return;
            }
        }

        onSave({ gemini: geminiApiKey, openai: openaiApiKey });
        setIsLoading(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900/80 flex items-center justify-center z-[110] p-4">
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl max-w-lg w-full border border-yellow-500/50">
                <h2 className="text-2xl font-bold text-yellow-400">Set Your API Keys</h2>
                <p className="text-gray-400 mt-2 mb-4">
                    To use Chart Oracle's AI features, please provide a personal API key from either Google Gemini or OpenAI. Both providers enable all platform features.
                </p>

                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-sm font-bold text-yellow-300">Gemini API Key</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="password"
                                value={geminiApiKey}
                                onChange={(e) => setGeminiApiKey(e.target.value)}
                                placeholder="Paste your Gemini API key here"
                                className="flex-grow bg-gray-700 p-2 rounded-md text-sm text-white border border-gray-600 focus:ring-yellow-500 focus:border-yellow-500"
                            />
                            <div className="relative group">
                                <InfoIcon className="w-5 h-5 text-gray-400" />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-gray-900 text-xs text-gray-300 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-gray-700">
                                    Your API key is stored securely in your browser's session storage and is never sent to our servers. It is deleted when you close the tab.
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-bold text-blue-300">OpenAI API Key</label>
                        <input
                            type="password"
                            value={openaiApiKey}
                            onChange={(e) => setOpenaiApiKey(e.target.value)}
                            placeholder="Paste your OpenAI API key here"
                            className="w-full bg-gray-700 p-2 rounded-md text-sm text-white border border-gray-600 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                </div>

                {error ? (
                    <p className="text-red-400 text-sm mt-2">{error}</p>
                ) : (
                    <p className="text-gray-500 text-sm mt-2 h-5">At least one API key is required to proceed.</p>
                )}

                <div className="flex justify-end gap-3 mt-4">
                    <button onClick={onClose} className="font-semibold py-2 px-4 rounded-md bg-gray-600 hover:bg-gray-500 text-white">
                        Do Later
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!geminiApiKey.trim() && !openaiApiKey.trim() || isLoading}
                        className="font-semibold py-2 px-4 rounded-md bg-green-600 hover:bg-green-500 text-white disabled:bg-gray-500 flex items-center justify-center w-36"
                    >
                        {isLoading ? <><LoadingSpinner /> Validating...</> : 'Save Keys'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ApiKeyOnboardingModal;
