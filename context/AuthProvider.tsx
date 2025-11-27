import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../firebase';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    logout: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });

        // Fallback: If Firebase takes too long (e.g., offline), stop loading so the app can render (likely in logged-out state)
        const timeout = setTimeout(() => {
            setLoading(false);
        }, 2000);

        return () => {
            unsubscribe();
            clearTimeout(timeout);
        };
    }, []);

    const logout = async () => {
        await signOut(auth);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#050505] text-yellow-500 font-mono">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="animate-pulse tracking-widest">INITIALIZING SYSTEM...</p>
                </div>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{ user, loading, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
