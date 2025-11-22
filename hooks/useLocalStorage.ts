// FIX: Import React to resolve namespace error for React.Dispatch and React.SetStateAction.
import React, { useState, useEffect } from 'react';

// Helper function to load from localStorage, with error handling and default merging.
const loadFromLocalStorage = <T,>(key: string, defaultValue: T): T => {
    try {
        const savedValue = localStorage.getItem(key);
        if (savedValue === null) { // Explicitly check for null in case an empty string is stored
            return defaultValue;
        }

        const parsedValue = JSON.parse(savedValue);

        // If default value is an array, ensure the loaded value is also an array.
        if (Array.isArray(defaultValue)) {
            if (Array.isArray(parsedValue)) {
                return parsedValue as T;
            }
            console.warn(`Invalid type for key '${key}' in localStorage. Expected array, got ${typeof parsedValue}. Reverting to default.`);
            return defaultValue;
        }

        // If the default value is a non-array object, merge it with the parsed value.
        // This ensures new settings fields are added without overwriting user's existing ones.
        if (typeof defaultValue === 'object' && defaultValue !== null && typeof parsedValue === 'object' && parsedValue !== null) {
            return { ...defaultValue, ...parsedValue };
        }
        
        return parsedValue as T;

    } catch (error) {
        console.error(`Failed to load '${key}' from localStorage`, error);
        // On any error (e.g., JSON parsing), return the default to prevent app crash.
        return defaultValue;
    }
};


/**
 * A custom React hook that syncs state with localStorage.
 * It provides the same interface as useState but with persistence.
 * Any update to the state is immediately saved to localStorage.
 * @param key The key to use in localStorage.
 * @param defaultValue The default value if nothing is in localStorage or if loading fails.
 * @returns A stateful value, and a function to update it.
 */
function useLocalStorage<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [value, setValue] = useState<T>(() => {
        return loadFromLocalStorage(key, defaultValue);
    });

    // This effect runs whenever the state value changes, saving it to localStorage.
    useEffect(() => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error(`Failed to save '${key}' to localStorage`, error);
        }
    }, [key, value]);

    return [value, setValue];
}

export default useLocalStorage;
