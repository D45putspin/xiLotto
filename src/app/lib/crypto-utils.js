import CryptoJS from 'crypto-js';

/**
 * Generate a 32-byte random secret
 * @returns {string} 32-byte random secret as hex string
 */
export function generateRandomSecret() {
    // Generate 32 random bytes
    const array = new Uint8Array(32);
    if (typeof window !== 'undefined' && window.crypto) {
        // Use Web Crypto API if available (more secure)
        window.crypto.getRandomValues(array);
    } else {
        // Fallback to Math.random (less secure but works everywhere)
        for (let i = 0; i < 32; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }
    }
    
    // Convert to hex string
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Compute SHA256 hash of a secret
 * @param {string} secret - The secret to hash (hex string)
 * @returns {string} SHA256 hash as hex string
 */
export function computeCommit(secret) {
    // Convert hex string to WordArray
    const wordArray = CryptoJS.enc.Hex.parse(secret);
    // Compute SHA256 hash
    const hash = CryptoJS.SHA256(wordArray);
    // Return as hex string
    return hash.toString(CryptoJS.enc.Hex);
}

/**
 * Generate a new secret and compute its commit
 * @returns {Object} Object containing secret and commit
 */
export function generateSecretAndCommit() {
    const secret = generateRandomSecret();
    const commit = computeCommit(secret);
    return { secret, commit };
}
