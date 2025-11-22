// FIX: Import React to resolve namespace error for React.Dispatch and React.SetStateAction.
import React, { useState, useEffect } from 'react';

const loadFromSessionStorage = <T,>(key: string, defaultValue: T): T => {
    try {
        const savedValue = sessionStorage.getItem(key);
        if (savedValue === null) {
            return defaultValue;
        }
        const parsedValue = JSON.parse(savedValue);
        // Merge for objects to handle new fields without overwriting user's existing ones.
        if (typeof defaultValue === 'object' && defaultValue !== null && typeof parsedValue === 'object' && parsedValue !== null) {
            return { ...defaultValue, ...parsedValue };
        }
        return parsedValue as T;
    } catch (error) {
        console.error(`Failed to load '${key}' from sessionStorage`, error);
        return defaultValue;
    }
};

function useSessionStorage<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [value, setValue] = useState<T>(() => {
        return loadFromSessionStorage(key, defaultValue);
    });

    useEffect(() => {
        try {
            sessionStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error(`Failed to save '${key}' to sessionStorage`, error);
        }
    }, [key, value]);

    return [value, setValue];
}

export default useSessionStorage;
