
import React, { useState, useEffect } from 'react';
import { SavedTrade, UploadedImageKeys } from '../types';
import { TIME_FRAMES_STEPS } from '../constants';
import { getImage } from '../idb';

interface ImageViewerModalProps {
  trade: SavedTrade;
  onClose: () => void;
}

const ImageViewerModal: React.FC<ImageViewerModalProps> = ({ trade, onClose }) => {
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [loadedImages, setLoadedImages] = useState<Record<string, string | null>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchImages = async () => {
      setIsLoading(true);
      const images: Record<string, string | null> = {};
      const setupImageKeys = trade.uploadedImageKeys || {};
      
      for (const key in setupImageKeys) {
        const imageKey = setupImageKeys[key as any];
        if (imageKey) {
            const url = await getImage(imageKey);
            images[`setup-${key}`] = url || null;
        }
      }

      if (trade.resultImageKey) {
          const url = await getImage(trade.resultImageKey);
          images['result-0'] = url || null;
      }

      setLoadedImages(images);
      setIsLoading(false);
    };

    fetchImages();
  }, [trade.uploadedImageKeys, trade.resultImageKey]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (zoomedImage) {
          setZoomedImage(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, zoomedImage]);

  const setupImagesWithData = Object.entries(loadedImages)
      .filter(([key, imageSrc]) => key.startsWith('setup-') && imageSrc);
  const resultImage = loadedImages['result-0'];
  const hasAnyImages = setupImagesWithData.length > 0 || !!resultImage;

  return (
    <div 
      className="fixed inset-0 bg-gray-900/80 flex items-center justify-center z-[100] p-4 animate-fadeIn"
      aria-modal="true"
      role="dialog"
      onClick={onClose} 
    >
      <div 
        className="bg-gray-800 p-4 md:p-6 rounded-lg shadow-xl max-w-6xl w-full border border-yellow-500/50 max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()} 
      >
        {/* Header */}
        <div className="flex justify-between items-start pb-4 border-b border-gray-700">
            <div className="flex-grow">
                <h2 className="text-xl md:text-2xl font-bold text-yellow-400">
                    Analysis Charts: {trade.symbol} {trade.direction} {trade.type}
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                    Journaled on: {new Date(trade.savedDate).toLocaleString()}
                </p>
            </div>
            <button
                onClick={onClose}
                className="p-1 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
                aria-label="Close chart viewer"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>

        {/* Content */}
        <div className="flex-grow overflow-y-auto pt-4 space-y-6">
             {isLoading ? (
                <div className="flex items-center justify-center h-full bg-gray-700/50 rounded-md py-20">
                    <p className="text-gray-400 animate-pulse">Loading images...</p>
                </div>
             ) : hasAnyImages ? (
                <>
                    {setupImagesWithData.length > 0 && (
                        <div>
                            <h3 className="text-lg font-semibold text-gray-300 mb-3 text-center">Setup Charts</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {setupImagesWithData.map(([key, imageSrc]) => {
                                    const indexStr = key.split('-')[1];
                                    const index = parseInt(indexStr, 10);
                                    
                                    // NEW LOGIC: Use dynamic metadata if available, otherwise fallback to static labels
                                    const detectedLabel = trade.chartMetadata?.[indexStr] || TIME_FRAMES_STEPS.find(s => s.step === index + 1)?.title || `Chart ${index + 1}`;

                                    if (!imageSrc) return null;
                                    
                                    return (
                                        <div key={key} className="bg-gray-900/30 p-2 rounded-md border border-gray-700/30">
                                            <h4 className="text-sm font-semibold text-gray-300 mb-2 text-center">{detectedLabel}</h4>
                                            <img 
                                                src={imageSrc} 
                                                alt={`Saved chart for ${detectedLabel}`}
                                                className="max-w-full h-auto rounded-md border-2 border-gray-700 mx-auto transition-transform duration-200 hover:scale-105 cursor-zoom-in"
                                                onClick={() => setZoomedImage(imageSrc)}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {resultImage && (
                        <div className="pt-4 border-t border-gray-700/50">
                            <h3 className="text-lg font-semibold text-gray-300 mb-3 text-center">Outcome Chart</h3>
                            <div className="max-w-2xl mx-auto bg-gray-900/30 p-2 rounded-md border border-gray-700/30">
                                <img 
                                    src={resultImage}
                                    alt="Trade outcome chart"
                                    className="max-w-full h-auto rounded-md border-2 border-gray-700 mx-auto transition-transform duration-200 hover:scale-105 cursor-zoom-in"
                                    onClick={() => setZoomedImage(resultImage)}
                                />
                            </div>
                        </div>
                    )}
                </>
             ) : (
                <div className="flex items-center justify-center h-full bg-gray-700/50 rounded-md py-20">
                    <p className="text-gray-500">No images were saved with this trade.</p>
                </div>
            )}
        </div>
        
        {zoomedImage && (
            <div 
                className="fixed inset-0 z-[110] bg-black/80 flex items-center justify-center p-4 animate-fadeIn cursor-zoom-out"
                onClick={() => setZoomedImage(null)}
            >
                <img 
                    src={zoomedImage}
                    alt="Zoomed chart"
                    className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
                    onClick={e => e.stopPropagation()}
                />
            </div>
        )}
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .cursor-zoom-in { cursor: zoom-in; }
        .cursor-zoom-out { cursor: zoom-out; }
      `}</style>
    </div>
  );
};

export default ImageViewerModal;
