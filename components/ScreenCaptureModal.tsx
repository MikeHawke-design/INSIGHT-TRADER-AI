
import React, { useRef, useState, useEffect } from 'react';

interface ScreenCaptureModalProps {
    isOpen: boolean;
    stream: MediaStream | null;
    onCapture: (dataUrl: string) => void;
    onClose: () => void;
    error?: string | null;
}

const ScreenCaptureModal: React.FC<ScreenCaptureModalProps> = ({ isOpen, stream, onCapture, onClose, error }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isVideoReady, setIsVideoReady] = useState(false);

    useEffect(() => {
        const videoElement = videoRef.current;
        if (isOpen && stream && videoElement) {
            videoElement.srcObject = stream;
            videoElement.onloadedmetadata = () => {
                videoElement.play().then(() => setIsVideoReady(true)).catch(e => console.error("Play error:", e));
            };
        } else {
            setIsVideoReady(false);
        }
    }, [isOpen, stream]);

    const handleCaptureClick = () => {
        if (!videoRef.current || !canvasRef.current || !isVideoReady) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        if (video.videoWidth === 0 || video.videoHeight === 0) {
             console.error("Capture failed: video dimensions are zero.");
             return;
        }
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        onCapture(canvas.toDataURL('image/jpeg', 0.9));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900/90 flex flex-col items-center justify-center z-[120] p-4 animate-fadeIn backdrop-blur-sm">
            <div className="bg-gray-800 p-4 rounded-lg shadow-2xl w-full max-w-4xl border border-yellow-500/30 flex flex-col max-h-[90vh]">
                <h2 className="text-xl font-bold text-yellow-400 mb-4 text-center font-display tracking-wider">SCREEN CAPTURE PREVIEW</h2>
                <div className="bg-black rounded-md flex-grow overflow-hidden border border-gray-700 relative min-h-[300px] flex items-center justify-center">
                    <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        muted 
                        className="max-w-full max-h-full object-contain"
                    ></video>
                    {!isVideoReady && !error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-10">
                            <div className="w-10 h-10 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                            <p className="text-yellow-500 font-mono text-sm">INITIALIZING FEED...</p>
                        </div>
                    )}
                    {error && (
                        <div className="absolute inset-0 flex items-center justify-center bg-red-900/80 p-4 z-20">
                            <p className="text-white text-center font-bold">{error}</p>
                        </div>
                    )}
                </div>
                <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
                <div className="flex justify-center space-x-4 mt-6 flex-shrink-0">
                     <button 
                        onClick={onClose} 
                        className="font-bold py-3 px-8 rounded-lg transition-all bg-gray-700 hover:bg-gray-600 text-gray-200 uppercase tracking-wide text-sm"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleCaptureClick} 
                        disabled={!isVideoReady} 
                        className="font-bold py-3 px-8 rounded-lg transition-all bg-yellow-500 hover:bg-yellow-400 text-black disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed uppercase tracking-wide text-sm shadow-[0_0_15px_rgba(234,179,8,0.4)]"
                    >
                        Capture Frame
                    </button>
                </div>
            </div>
            <style>{`@keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } } .animate-fadeIn { animation: fadeIn 0.2s ease-out; }`}</style>
        </div>
    );
};

export default ScreenCaptureModal;
