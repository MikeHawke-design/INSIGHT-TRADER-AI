import { Component, ErrorInfo, ReactNode } from 'react';
interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4 font-mono">
                    <div className="max-w-4xl w-full bg-gray-800 p-8 rounded-lg border border-red-500/50 shadow-2xl">
                        <h1 className="text-2xl font-bold text-red-500 mb-4">APPLICATION CRASHED</h1>
                        <div className="bg-black/50 p-4 rounded overflow-auto max-h-[60vh] mb-6 border border-gray-700">
                            <p className="text-red-400 font-bold mb-2 text-lg">{this.state.error?.toString()}</p>
                            <div className="text-gray-400 text-xs whitespace-pre-wrap leading-relaxed">
                                {this.state.errorInfo?.componentStack}
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <button
                                onClick={() => {
                                    localStorage.clear();
                                    window.location.reload();
                                }}
                                className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-6 rounded transition-colors"
                            >
                                Clear Data & Reload
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded transition-colors"
                            >
                                Reload Application
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
