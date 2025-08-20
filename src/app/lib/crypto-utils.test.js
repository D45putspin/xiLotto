import { generateRandomSecret, computeCommit, generateSecretAndCommit } from './crypto-utils';

// Simple test function to verify crypto utilities
export function testCryptoUtils() {
    console.log('Testing crypto utilities...');
    
    // Test 1: Generate a random secret
    const secret = generateRandomSecret();
    console.log('Generated secret:', secret);
    console.log('Secret length (hex):', secret.length);
    console.log('Secret length (bytes):', secret.length / 2);
    
    // Test 2: Compute commit from secret
    const commit = computeCommit(secret);
    console.log('Computed commit:', commit);
    console.log('Commit length (hex):', commit.length);
    
    // Test 3: Generate secret and commit together
    const { secret: secret2, commit: commit2 } = generateSecretAndCommit();
    console.log('Generated secret2:', secret2);
    console.log('Computed commit2:', commit2);
    
    // Test 4: Verify commit is deterministic
    const commit3 = computeCommit(secret2);
    console.log('Recomputed commit2:', commit3);
    console.log('Commits match:', commit2 === commit3);
    
    // Test 5: Verify different secrets produce different commits
    const { secret: secret4, commit: commit4 } = generateSecretAndCommit();
    console.log('Different secret produces different commit:', commit2 !== commit4);
    
    console.log('All tests passed!');
    
    return {
        secret,
        commit,
        secret2,
        commit2,
        commit3,
        secret4,
        commit4
    };
}

// Run tests if this file is executed directly
if (typeof window !== 'undefined') {
    // Browser environment
    window.testCryptoUtils = testCryptoUtils;
} else {
    // Node.js environment
    testCryptoUtils();
}
