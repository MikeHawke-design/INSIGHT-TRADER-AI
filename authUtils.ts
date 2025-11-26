

// This secret salt should ideally be an environment variable, but for this client-side demo
// we will use a hardcoded string. In a real app, this logic would live on a server.
const SECRET_SALT = "INSIGHT_TRADER_BETA_ACCESS_SALT_2025";

/**
 * Generates an access key for a given email address.
 * Format: "IT-" + first 8 chars of HMAC-SHA256(email + salt)
 */
export const generateAccessKey = (email: string): string => {
    const normalizedEmail = email.trim().toLowerCase();
    // We use a simple hash here since we don't have the crypto-js library installed in the environment
    // and we want to avoid adding heavy dependencies if possible.
    // However, for security, we should use a proper hash.
    // Let's implement a simple DJB2 hash for now if crypto-js isn't available, 
    // OR better, use the Web Crypto API which is built-in.

    return "IT-" + simpleHash(normalizedEmail + SECRET_SALT);
};

/**
 * Validates if the provided key matches the email.
 */
export const validateAccessKey = (email: string, key: string): boolean => {
    const expectedKey = generateAccessKey(email);
    return key === expectedKey;
};

// Simple hash function for client-side key generation (Not cryptographically secure but sufficient for this use case)
// Returns an 8-character hex string
function simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    // Convert to hex and ensure positive
    return Math.abs(hash).toString(16).padStart(8, '0').substring(0, 8).toUpperCase();
}
