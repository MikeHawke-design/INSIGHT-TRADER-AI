
import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import Logo from './Logo';
import { ApiConfiguration, User } from '../types';

interface AvatarSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAvatarSelect: (avatarDataUrl: string) => void;
    apiConfig: ApiConfiguration;
    currentUser: User | null;
}

const AvatarSelectionModal: React.FC<AvatarSelectionModalProps> = ({ isOpen, onClose, onAvatarSelect }) => {
    const [generatedAvatars, setGeneratedAvatars] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [regenAttempts, setRegenAttempts] = useState(3);

    const getAiClient = () => {
        return new GoogleGenAI({ apiKey: process.env.API_KEY });
    };
    
    const handleGenerate = async () => {
        const ai = getAiClient();
        if (!ai || regenAttempts <= 0) {
            return;
        }

        setIsLoading(true);
        setError('');
        setSelectedIndex(null);
        setGeneratedAvatars([]);
        setRegenAttempts(prev => prev - 1);

        try {
            const response = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: 'a sleek, abstract, and mystical avatar for a financial trading expert. Style: minimalist, modern, using themes of data visualization, charts, and insight. Background: dark with vibrant accent colors like gold, teal, or deep purple.',
                config: {
                    numberOfImages: 4,
                    outputMimeType: 'image/png',
                    aspectRatio: '1:1',
                },
            });
            
            const images = response.generatedImages.map(img => `data:image/png;base64,${img.image.imageBytes}`);
            setGeneratedAvatars(images);
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'Failed to generate avatars.';
            setError(`Error: ${errorMessage}`);
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        if (isOpen) {
            // Reset state when opening
            setGeneratedAvatars([]);
            setIsLoading(false);
            setError('');
            setSelectedIndex(null);
            setRegenAttempts(3);
        }
    }, [isOpen]);

    const handleSelect = () => {
        if (selectedIndex !== null && generatedAvatars[selectedIndex]) {
            onAvatarSelect(generatedAvatars[selectedIndex]);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900/80 flex items-center justify-center z-[110] p-4 animate-fadeIn">
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl max-w-2xl w-full border border-yellow-500/50 flex flex-col text-center">
                <h2 className="text-2xl font-bold text-yellow-400">Choose Your Oracle Avatar</h2>
                <p className="text-gray-400 mt-2 mb-4">
                    Generate a unique AI-powered avatar to represent you. You have {regenAttempts} attempts remaining.
                </p>

                {/* Avatar Display Area */}
                <div className="my-4 flex-grow min-h-[150px]">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <Logo className="w-16 h-16" isLoading={true} />
                            <p className="ml-4 text-gray-300">Generating avatars...</p>
                        </div>
                    ) : error ? (
                        <div className="flex items-center justify-center h-full bg-red-900/20 rounded-md p-4">
                            <p className="text-red-400">{error}</p>
                        </div>
                    ) : generatedAvatars.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {generatedAvatars.map((avatarSrc, index) => (
                                <button
                                    key={index}
                                    onClick={() => setSelectedIndex(index)}
                                    className={`rounded-full p-1 border-2 transition-all duration-200 ${
                                        selectedIndex === index
                                            ? 'border-yellow-400 scale-105'
                                            : 'border-transparent hover:border-gray-500'
                                    }`}
                                >
                                    <img src={avatarSrc} alt={`Generated Avatar ${index + 1}`} className="w-full h-auto object-cover rounded-full" />
                                </button>
                            ))}
                        </div>
                    ) : (
                         <div className="flex items-center justify-center h-full">
                            <p className="text-gray-500">Click "Generate" to create your avatars.</p>
                        </div>
                    )}
                </div>
                
                {/* Action Buttons */}
                <div className="flex justify-center items-center gap-4 mt-6">
                    <button
                        onClick={onClose}
                        className="font-semibold py-2 px-6 rounded-lg bg-gray-600 hover:bg-gray-500 text-white transition-colors"
                    >
                        Skip for Now
                    </button>
                    <button
                        onClick={handleGenerate}
                        disabled={isLoading || regenAttempts <= 0}
                        className="font-semibold py-2 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
                    >
                        {isLoading ? 'Generating...' : 'Generate New Avatars'}
                    </button>
                    <button
                        onClick={handleSelect}
                        disabled={selectedIndex === null}
                        className="font-semibold py-2 px-6 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-gray-900 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
                    >
                        Select Avatar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AvatarSelectionModal;
