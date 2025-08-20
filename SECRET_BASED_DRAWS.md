# Secret-Based Draw System Implementation

This document describes the implementation of the secret-based draw system for the XiLotto lottery application.

## Overview

The draw system now uses a commit-reveal scheme where:

1. When starting a draw, a 32-byte random secret is generated off-chain
2. The SHA256 hash of the secret (commit) is sent to the contract
3. When finishing a draw, the original secret is revealed to prove the commitment

## Implementation Details

### Crypto Utilities (`src/app/lib/crypto-utils.js`)

The crypto utilities provide three main functions:

- `generateRandomSecret()`: Generates a cryptographically secure 32-byte random secret
- `computeCommit(secret)`: Computes the SHA256 hash of a secret
- `generateSecretAndCommit()`: Generates both secret and commit in one call

### Changes to LotteryAdmin Component

1. **Persistent Secret Storage**: Added localStorage-based secret storage with automatic loading
2. **Modified startDraw()**: Now generates a secret and commit, stores secret persistently, calls contract with commit
3. **Added finishDraw()**: Uses stored secret to finish draws, removes secret after completion
4. **UI Updates**: Added draw management section showing secret availability and localStorage status

### Changes to MultiDrawDashboard Component

1. **Persistent Secret Storage**: Added localStorage-based secret storage with automatic loading
2. **Modified finishDraw()**: Now accepts manual secrets, handles both stored and manual secrets
3. **UI Updates**: Updated finish button to show secret availability status and localStorage warnings
4. **Secret Entry Modal**: Added popup modal for manual secret entry when no stored secret exists
5. **Secret Validation**: Real-time validation of secret format and length
6. **Smart Secret Handling**: Automatically saves secrets for draws with no tickets, finishes draws with tickets

## Contract Interface

### Starting a Draw

```javascript
// Generate secret and commit
const { secret, commit } = generateSecretAndCommit();

// Call contract with commit
await svc.sendTransaction(CONTRACT, "start_draw", {
  token_contract: "currency",
  price: "1",
  fee: 10,
  cap: 0,
  commit: commit, // SHA256 hash of the secret
});

// Store secret persistently for later use
if (storageAvailable) {
  storeDrawSecret(drawId, secret);
}
setDrawSecrets((prev) => new Map(prev).set(drawId, secret));
```

### Finishing a Draw

```javascript
// Retrieve stored secret
const secret = drawSecrets.get(drawId);

// Call contract with secret
await svc.sendTransaction(CONTRACT, "finish_draw", {
  draw_id: drawId,
  reveal: secret, // Original 32-byte secret
});

// Remove secret from storage after successful finish
if (storageAvailable) {
  removeDrawSecret(drawId);
}
setDrawSecrets((prev) => {
  const newMap = new Map(prev);
  newMap.delete(drawId);
  return newMap;
});
```

## Security Features

1. **Cryptographic Security**: Uses Web Crypto API when available, with Math.random fallback
2. **Persistent Secret Storage**: Secrets are stored in localStorage for persistence across sessions
3. **Commit Verification**: Contract verifies the secret matches the original commit
4. **Access Control**: Only users with stored secrets can finish draws
5. **Automatic Cleanup**: Secrets are automatically removed from storage after successful draw completion

## UI Enhancements

1. **Secret Status Indicators**: Shows whether a secret is available for finishing draws
2. **Enhanced Button States**: Finish buttons are disabled when no secret is available
3. **Visual Feedback**: Clear indicators for secret availability and draw management
4. **Warning Messages**: Informative messages when secrets are not available
5. **Visible Secret Management**: Users can view, copy, and manage their stored secrets
6. **Copy to Clipboard**: One-click copying of secrets for backup or transfer
7. **Bulk Secret Management**: Clear all secrets with confirmation dialog
8. **Manual Secret Entry**: Modal popup for entering secrets when none are stored
9. **Secret Validation**: Real-time validation of secret format (64 hex characters)
10. **Smart Secret Handling**: Saves secrets for draws with no tickets, finishes draws with tickets

## Testing

A test file (`src/app/lib/crypto-utils.test.js`) is provided to verify:

- Secret generation produces 32-byte values
- Commit computation is deterministic
- Different secrets produce different commits
- SHA256 hashing works correctly

Run tests in browser console: `window.testCryptoUtils()`

## Dependencies

- `crypto-js`: For SHA256 hashing operations
- Web Crypto API: For secure random number generation (when available)
- localStorage: For persistent secret storage across browser sessions

## Migration Notes

- Existing draws without secrets cannot be finished through the new interface
- Only draws created after this implementation will have stored secrets
- The contract must support the new `commit` parameter in `start_draw`
- The contract must support the new `secret` parameter in `finish_draw`
- Secrets are now persisted in localStorage and survive page refreshes and browser restarts
- Users can close the page and return later to finish their draws
- Users can now view and copy their secrets for backup or use on other devices
- Secrets are automatically cleaned up after successful draw completion
- Users can manually enter secrets via popup modal when no stored secret exists
- Real-time validation ensures secrets are in correct format before submission
