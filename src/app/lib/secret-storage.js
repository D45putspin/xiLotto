/**
 * Secret Storage Utility
 * Provides persistent storage for draw secrets using localStorage
 */

const STORAGE_PREFIX = 'XiLotto_secret_';

/**
 * Store a secret for a specific draw
 * @param {number} drawId - The draw ID
 * @param {string} secret - The 32-byte secret (hex string)
 */
export function storeDrawSecret(drawId, secret) {
    try {
        const key = `${STORAGE_PREFIX}${drawId}`;
        localStorage.setItem(key, secret);
        console.log(`Secret stored for draw #${drawId}`);
    } catch (error) {
        console.error('Failed to store secret:', error);
        throw new Error('Failed to store secret in localStorage');
    }
}

/**
 * Retrieve a secret for a specific draw
 * @param {number} drawId - The draw ID
 * @returns {string|null} The secret or null if not found
 */
export function getDrawSecret(drawId) {
    try {
        const key = `${STORAGE_PREFIX}${drawId}`;
        const secret = localStorage.getItem(key);
        return secret;
    } catch (error) {
        console.error('Failed to retrieve secret:', error);
        return null;
    }
}

/**
 * Remove a secret for a specific draw (after successful finish)
 * @param {number} drawId - The draw ID
 */
export function removeDrawSecret(drawId) {
    try {
        const key = `${STORAGE_PREFIX}${drawId}`;
        localStorage.removeItem(key);
        console.log(`Secret removed for draw #${drawId}`);
    } catch (error) {
        console.error('Failed to remove secret:', error);
    }
}

/**
 * Get all stored draw secrets
 * @returns {Map<number, string>} Map of drawId to secret
 */
export function getAllDrawSecrets() {
    const secrets = new Map();
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(STORAGE_PREFIX)) {
                const drawId = parseInt(key.replace(STORAGE_PREFIX, ''));
                const secret = localStorage.getItem(key);
                if (secret) {
                    secrets.set(drawId, secret);
                }
            }
        }
    } catch (error) {
        console.error('Failed to retrieve all secrets:', error);
    }
    return secrets;
}

/**
 * Clear all stored draw secrets
 */
export function clearAllDrawSecrets() {
    try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(STORAGE_PREFIX)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        console.log('All draw secrets cleared');
    } catch (error) {
        console.error('Failed to clear secrets:', error);
    }
}

/**
 * Check if localStorage is available
 * @returns {boolean} True if localStorage is available
 */
export function isLocalStorageAvailable() {
    try {
        const test = '__localStorage_test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch (error) {
        return false;
    }
}
