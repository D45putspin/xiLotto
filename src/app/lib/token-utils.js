/**
 * Format token display name
 * @param {string} token - The token identifier
 * @returns {string} - Formatted token name
 */
export const formatTokenName = (token) => {
    if (!token) return 'TOKEN';
    
    // If token is "currency", display as "Xian"
    if (token === 'currency') {
        return 'Xian';
    }
    
    // If token starts with "con_", remove the "con_" prefix
    if (token.startsWith('con_')) {
        return token.substring(4); // Remove "con_" (4 characters)
    }
    
    // Return token as-is for other cases
    return token;
};
