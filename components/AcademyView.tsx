
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { GoogleGenAI } from "@google/genai";
import { CourseModule, CourseLesson, QuizQuestion, UserCourseProgress, User, LessonBlock, LessonBlockExercise, UserSettings, StrategyKey, StrategyLogicData, ApiConfiguration } from '../types';
import { storeImage, getImage } from '../idb';
import Logo from './Logo';

interface ExerciseImageProps {
    imageKey: string;
}

const ExerciseImage: React.FC<ExerciseImageProps> = ({ imageKey }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const fetchImage = async () => {
            setIsLoading(true);
            const url = await getImage(imageKey);
            if (isMounted) {
                setImageUrl(url || null);
                setIsLoading(false);
            }
        };

        fetchImage();
        return () => { isMounted = false; };
    }, [imageKey]);

    if (isLoading) {
        return <div className="w-1/2 rounded-md border border-gray-600 bg-gray-700 animate-pulse h-48 flex items-center justify-center">Loading image...</div>;
    }

    if (!imageUrl) {
        return <div className="w-1/2 rounded-md border border-gray-600 bg-gray-800 h-48 flex items-center justify-center">Image not found.</div>;
    }

    return <img src={imageUrl} alt="Submitted exercise" className="w-1/2 rounded-md border border-gray-600" />;
};


interface AcademyViewProps {
    userCourseProgress: UserCourseProgress;
    setUserCourseProgress: React.Dispatch<React.SetStateAction<UserCourseProgress>>;
    currentUser: User | null;
    apiConfig: ApiConfiguration;
    userSettings: UserSettings;
    strategyLogicData: Record<StrategyKey, StrategyLogicData>;
    onInitiateCoaching: (strategy: StrategyLogicData, goal: 'learn_basics' | 'build_setup', strategyKey: StrategyKey) => void;

}

export const AcademyView: React.FC<AcademyViewProps> = ({ userCourseProgress, setUserCourseProgress, currentUser, apiConfig, userSettings, strategyLogicData, onInitiateCoaching }) => {
    const [activeView, setActiveView] = useState<'modules' | 'lesson' | 'quiz'>('modules');
    const [selectedModule, setSelectedModule] = useState<CourseModule | null>(null);
    const [selectedLesson, setSelectedLesson] = useState<CourseLesson | null>(null);

    // Quiz State
    const [currentQuizAnswers, setCurrentQuizAnswers] = useState<Record<number, string>>({});
    const [quizResult, setQuizResult] = useState<{ score: number; feedback: string } | null>(null);
    const [isSubmittingQuiz, setIsSubmittingQuiz] = useState(false);

    // Exercise State
    const [exerciseImage, setExerciseImage] = useState<string | null>(null);
    const [isProcessingExercise, setIsProcessingExercise] = useState(false);
    const [exerciseError, setExerciseError] = useState<string | null>(null);
    const exerciseFileRef = useRef<HTMLInputElement>(null);

    const [expandedUserModules, setExpandedUserModules] = useState<Record<string, boolean>>({});

    const toggleUserModule = (moduleId: string) => {
        setExpandedUserModules(prev => ({ ...prev, [moduleId]: !prev[moduleId] }));
    };

    const getAiClient = useCallback(() => {
        const apiKey = apiConfig.geminiApiKey || import.meta.env.VITE_API_KEY;
        return new GoogleGenAI({ apiKey });
    }, [apiConfig.geminiApiKey]);


    const handleSelectLesson = (lesson: CourseLesson, module: CourseModule) => {
        setSelectedLesson(lesson);
        setSelectedModule(module);
        setActiveView('lesson');
    };

    const handleMarkLessonComplete = (lessonId: string) => {
        setUserCourseProgress(prev => {
            const newCompleted = new Set([...prev.completedLessons, lessonId]);
            return { ...prev, completedLessons: Array.from(newCompleted) };
        });
        setActiveView('modules');
    };

    const handleStartQuiz = (module: CourseModule) => {
        setSelectedModule(module);
        setQuizResult(null);
        setCurrentQuizAnswers({});
        setActiveView('quiz');
    };

    const handleAnswerQuestion = (questionIndex: number, answer: string) => {
        setCurrentQuizAnswers(prev => ({ ...prev, [questionIndex]: answer }));
    };

    const handleSubmitQuiz = async () => {
        const ai = getAiClient();
        if (!selectedModule || !ai) {
            alert("Platform API key is missing. Cannot submit quiz for feedback.");
            return;
        }

        setIsSubmittingQuiz(true);

        let correctCount = 0;
        selectedModule.quiz.forEach((q, index) => {
            if (currentQuizAnswers[index] === q.correctAnswer) {
                correctCount++;
            }
        });

        const score = (correctCount / selectedModule.quiz.length) * 100;
        setUserCourseProgress(prev => ({
            ...prev,
            quizScores: { ...prev.quizScores, [selectedModule.id]: score }
        }));

        const feedbackPrompt = `The user just scored ${score.toFixed(0)}% on the "${selectedModule.title}" quiz. Provide a brief, encouraging, and constructive feedback summary based on this score. If the score is low, suggest revisiting specific lessons.`;

        try {
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: feedbackPrompt });
            setQuizResult({ score, feedback: response.text || "Score recorded." });
        } catch (error) {
            console.error("Failed to get quiz feedback:", error);
            setQuizResult({ score, feedback: "Your score has been recorded. Keep up the great work!" });
        } finally {
            setIsSubmittingQuiz(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setExerciseImage(event.target?.result as string);
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    const handleSubmitExercise = async (lessonId: string, blockIndex: number, validationPrompt: string) => {
        const ai = getAiClient();
        if (!exerciseImage || !ai) {
            setExerciseError("Please upload an image first.");
            return;
        }

        setIsProcessingExercise(true);
        setExerciseError(null);

        try {
            const storedKey = await storeImage(exerciseImage);
            setUserCourseProgress(prev => ({
                ...prev,
                exerciseStates: {
                    ...prev.exerciseStates,
                    [`${lessonId}-${blockIndex}`]: { imageKey: storedKey, status: 'pending' }
                }
            }));

            const prefixMatch = exerciseImage.match(/^data:(image\/(?:png|jpeg|webp));base64,/);
            if (!prefixMatch) throw new Error("Invalid image format");

            const mimeType = prefixMatch[1];
            const data = exerciseImage.substring(prefixMatch[0].length);

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [{ inlineData: { mimeType, data } }] },
                config: { systemInstruction: validationPrompt }
            });

            const feedback = response.text || "";
            const status = feedback && feedback.startsWith("PASS:") ? 'passed' : 'failed';

            setUserCourseProgress(prev => ({
                ...prev,
                exerciseStates: {
                    ...prev.exerciseStates,
                    [`${lessonId}-${blockIndex}`]: { imageKey: storedKey, status, feedback: feedback || "No feedback." }
                }
            }));

            // Clear image for next exercise
            setExerciseImage(null);

        } catch (err) {
            console.error(err);
            const message = err instanceof Error ? err.message : "An unknown error occurred.";
            setExerciseError(`AI Validation Failed: ${message}`);
            // Clear the pending state on error
            setUserCourseProgress(prev => {
                const newStates = { ...prev.exerciseStates };
                delete newStates[`${lessonId}-${blockIndex}`];
                return { ...prev, exerciseStates: newStates };
            });
        } finally {
            setIsProcessingExercise(false);
        }
    };

    const { userGeneratedModules } = useMemo(() => {
        // Strictly only use custom modules from user strategies
        // Removed foundational modules from here as they are no longer used
        const customModules = (Object.values(strategyLogicData) as StrategyLogicData[])
            .filter((strat: StrategyLogicData) => strat.courseModule)
            .map(strat => strat.courseModule as CourseModule);

        return { userGeneratedModules: customModules };
    }, [strategyLogicData]);

    const handleResetView = () => {
        setActiveView('modules');
        setSelectedModule(null);
        setSelectedLesson(null);
        setQuizResult(null);
        setCurrentQuizAnswers({});
    };

    const renderModuleList = (modules: CourseModule[], title: string) => {
        if (modules.length === 0) return (
            <div className="text-center py-12 bg-gray-800/50 rounded-lg border border-gray-700">
                <p className="text-gray-400">No custom strategy courses yet.</p>
                <p className="text-sm text-gray-500 mt-2">Create a strategy in Master Controls and enable "Generate Course" to see lessons here.</p>
            </div>
        );

        return (
            <div className="bg-gray-800 rounded-lg p-4 md:p-6 border border-gray-700">
                <h3 className="font-bold text-yellow-400 mb-4" style={{ fontSize: `${userSettings.headingFontSize}px` }}>{title}</h3>
                <div className="space-y-3">
                    {modules.map(module => {
                        // SAFE CHECK ADDED: Ensure module.lessons exists and has length
                        const progress = (module.lessons && module.lessons.length > 0)
                            ? (userCourseProgress.completedLessons.filter(id => module.lessons.some(l => l.id === id)).length / module.lessons.length) * 100
                            : 0;

                        const quizScore = userCourseProgress.quizScores[module.id];
                        const isExpanded = !!expandedUserModules[module.id];

                        return (
                            <div key={module.id} className="bg-gray-900/50 rounded-lg border border-gray-700/50 overflow-hidden">
                                <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer" onClick={() => toggleUserModule(module.id)}>
                                    <div className="flex-grow">
                                        <h4 className="font-semibold text-white" style={{ fontSize: `${userSettings.headingFontSize - 2}px` }}>{module.title}</h4>
                                        <p className="text-sm text-gray-400 mt-1">{module.description}</p>
                                    </div>
                                    <div className="flex items-center gap-4 flex-shrink-0">
                                        {quizScore !== undefined && (<div className={`text-sm font-bold ${quizScore >= 70 ? 'text-green-400' : 'text-red-400'}`}>Quiz: {quizScore.toFixed(0)}%</div>)}
                                        <div className="w-24">
                                            <p className="text-xs text-gray-400 text-right mb-1">{progress.toFixed(0)}%</p>
                                            <div className="w-full bg-gray-600 rounded-full h-2"><div className="bg-yellow-400 h-2 rounded-full" style={{ width: `${progress}%` }}></div></div>
                                        </div>
                                    </div>
                                </div>
                                {isExpanded && (
                                    <div className="bg-gray-800/30 p-4 border-t border-gray-700/50">
                                        <ul className="space-y-2">
                                            {module.lessons && module.lessons.map(lesson => {
                                                const isCompleted = userCourseProgress.completedLessons.includes(lesson.id);
                                                return (
                                                    <li key={lesson.id} onClick={() => handleSelectLesson(lesson, module)} className="p-3 flex justify-between items-center bg-gray-700/50 rounded-md hover:bg-gray-700 cursor-pointer transition-colors">
                                                        <div>
                                                            <p className="font-medium text-gray-200">{lesson.title}</p>
                                                            <p className="text-xs text-gray-500">{lesson.estimatedTime}</p>
                                                        </div>
                                                        {isCompleted && <span className="text-green-400 text-xs font-bold">✓ COMPLETED</span>}
                                                    </li>
                                                )
                                            })}
                                        </ul>
                                        <div className="mt-4 flex flex-col sm:flex-row gap-2">
                                            <button onClick={() => handleStartQuiz(module)} className="flex-1 font-semibold py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white">Take Quiz</button>
                                            <button onClick={() => {
                                                const strategyKey = Object.keys(strategyLogicData).find(key => strategyLogicData[key].courseModule?.id === module.id);
                                                if (strategyKey) {
                                                    onInitiateCoaching(strategyLogicData[strategyKey], 'learn_basics', strategyKey);
                                                }
                                            }} className="flex-1 font-semibold py-2 px-4 rounded-lg bg-purple-600 hover:bg-purple-500 text-white">Live Coach Me</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    };

    const renderLessonView = () => {
        if (!selectedLesson || !selectedModule) return null;

        return (
            <div className="max-w-4xl mx-auto">
                <button onClick={handleResetView} className="mb-4 text-sm font-semibold text-yellow-400 hover:text-yellow-300">← Back to Modules</button>
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h2 className="text-3xl font-bold text-white">{selectedLesson.title}</h2>
                    <p className="text-gray-400 mt-1 mb-6">From: {selectedModule.title}</p>

                    <div className="space-y-8">
                        {selectedLesson.blocks.map((block, index) => {
                            const exerciseState = userCourseProgress.exerciseStates[`${selectedLesson.id}-${index}`];
                            if (block.type === 'text') {
                                return <div key={index} className="prose prose-sm prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: block.content }} />;
                            }
                            if (block.type === 'exercise') {
                                return (
                                    <div key={index} className="p-4 bg-gray-900/50 rounded-lg border border-gray-700/50 space-y-4">
                                        <div className="prose prose-sm prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: block.prompt }} />
                                        {exerciseState?.status === 'passed' ? (
                                            <div className="p-3 bg-green-900/30 border border-green-500/50 rounded-md">
                                                <h5 className="font-bold text-green-300">✓ Passed!</h5>
                                                <p className="text-sm text-gray-300 mt-1">{exerciseState.feedback}</p>
                                            </div>
                                        ) : (
                                            <>
                                                {exerciseState?.status === 'failed' && (
                                                    <div className="p-3 bg-red-900/30 border border-red-500/50 rounded-md">
                                                        <h5 className="font-bold text-red-300">✗ Needs Improvement</h5>
                                                        <p className="text-sm text-gray-300 mt-1">{exerciseState.feedback}</p>
                                                    </div>
                                                )}
                                                <div className="flex flex-col sm:flex-row items-center gap-4">
                                                    <div className="flex-1 w-full">
                                                        <input ref={exerciseFileRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                                                        <button onClick={() => exerciseFileRef.current?.click()} className="w-full text-center p-3 border-2 border-dashed border-gray-600 rounded-lg text-gray-400 hover:bg-gray-700/50 hover:border-yellow-400 transition-colors">
                                                            {exerciseImage ? 'Image Selected' : 'Click to Upload Chart Image'}
                                                        </button>
                                                    </div>
                                                    {exerciseImage && <img src={exerciseImage} alt="preview" className="w-1/2 sm:w-1/3 rounded-md border border-gray-600" />}
                                                </div>
                                                <button onClick={() => handleSubmitExercise(selectedLesson.id, index, block.validationPrompt)} disabled={!exerciseImage || isProcessingExercise} className="w-full font-semibold py-2 px-4 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-gray-900 disabled:bg-gray-600 flex items-center justify-center">
                                                    {isProcessingExercise ? <><Logo className="w-5 h-5 mr-2" isLoading /> Submitting...</> : 'Submit for Feedback'}
                                                </button>
                                                {exerciseError && <p className="text-sm text-red-400">{exerciseError}</p>}
                                            </>
                                        )}
                                    </div>
                                );
                            }
                            return null;
                        })}
                    </div>
                    <button onClick={() => handleMarkLessonComplete(selectedLesson.id)} className="mt-8 w-full font-semibold py-2 px-4 rounded-lg bg-green-600 hover:bg-green-500 text-white">Mark as Complete & Return</button>
                </div>
            </div>
        )
    };

    const renderQuizView = () => {
        if (!selectedModule) return null;

        if (quizResult) {
            return (
                <div className="max-w-2xl mx-auto text-center">
                    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                        <h2 className="text-2xl font-bold text-white">Quiz Complete!</h2>
                        <p className="text-5xl font-bold my-4" style={{ color: quizResult.score >= 70 ? '#34D399' : '#F87171' }}>{quizResult.score.toFixed(0)}%</p>
                        <p className="text-gray-300">{quizResult.feedback}</p>
                        <button onClick={handleResetView} className="mt-6 font-semibold py-2 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 text-white">Back to Modules</button>
                    </div>
                </div>
            )
        }

        return (
            <div className="max-w-4xl mx-auto">
                <button onClick={handleResetView} className="mb-4 text-sm font-semibold text-yellow-400 hover:text-yellow-300">← Back to Modules</button>
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h2 className="text-2xl font-bold text-white">Quiz: {selectedModule.title}</h2>
                    <div className="space-y-6 mt-6">
                        {selectedModule.quiz.map((q, index) => (
                            <div key={index} className="p-4 bg-gray-900/50 rounded-lg">
                                <p className="font-semibold text-gray-200">{index + 1}. {q.question}</p>
                                <div className="mt-3 space-y-2">
                                    {q.options.map(option => (
                                        <label key={option} className="flex items-center p-2 rounded-md bg-gray-700/50 hover:bg-gray-700 cursor-pointer">
                                            <input type="radio" name={`q-${index}`} value={option} checked={currentQuizAnswers[index] === option} onChange={() => handleAnswerQuestion(index, option)} className="w-4 h-4 accent-yellow-400 bg-gray-600 border-gray-500" />
                                            <span className="ml-3 text-gray-300">{option}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                    <button onClick={handleSubmitQuiz} disabled={isSubmittingQuiz} className="mt-8 w-full font-semibold py-2 px-4 rounded-lg bg-green-600 hover:bg-green-500 text-white disabled:bg-gray-600 flex items-center justify-center">
                        {isSubmittingQuiz ? <><Logo className="w-5 h-5 mr-2" isLoading /> Submitting...</> : 'Submit Quiz'}
                    </button>
                </div>
            </div>
        )
    }

    if (activeView === 'lesson') return renderLessonView();
    if (activeView === 'quiz') return renderQuizView();

    return (
        <div className="p-4 md:p-6 space-y-8">
            <div className="text-center">
                <h2 className="font-bold text-white" style={{ fontSize: `${userSettings.headingFontSize + 12}px` }}>Academy</h2>
                <p className="text-gray-400 mt-1" style={{ fontSize: `${userSettings.uiFontSize}px` }}>Learn trading concepts and master your strategies with interactive lessons.</p>
            </div>

            {renderModuleList(userGeneratedModules, "Your Custom Strategy Courses")}
        </div>
    );
};
