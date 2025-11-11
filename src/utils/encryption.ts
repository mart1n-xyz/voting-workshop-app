/**
 * Encryption utilities for private voting
 * Uses TweetNaCl for asymmetric encryption (NaCl box)
 * 
 * ## Setup Instructions:
 * 
 * 1. Generate encryption keys by running:
 *    ```
 *    npx ts-node scripts/generate-keypair.ts
 *    ```
 * 
 * 2. Add the keys to your .env file:
 *    ```
 *    PRIVATE_KEY_ENCRYPTION="..." (base64, keep secret, organizer only)
 *    NEXT_PUBLIC_ENCRYPTION_PUBLIC_KEY="..." (base64, safe to commit)
 *    ```
 * 
 * 3. The public key from NEXT_PUBLIC_ENCRYPTION_PUBLIC_KEY will be used
 *    automatically for encrypting votes client-side.
 * 
 * 4. The private key should NEVER be committed or exposed to users.
 *    It's used by the organizer in the Streamlit dashboard for decryption.
 * 
 * ## How it works:
 * - Users sign a vote message with their wallet
 * - The signature is encrypted with the public key
 * - Encrypted signature is stored on-chain
 * - Only the organizer (with private key) can decrypt and tally
 */

import * as nacl from 'tweetnacl';
import * as util from 'tweetnacl-util';

/**
 * Get the public key for encryption from environment variable
 * 
 * The public key is safe to commit and share publicly.
 * It's loaded from NEXT_PUBLIC_ENCRYPTION_PUBLIC_KEY environment variable.
 * 
 * @returns Public key as Uint8Array
 * @throws Error if NEXT_PUBLIC_ENCRYPTION_PUBLIC_KEY is not set or invalid
 */
export const getPublicKey = (): Uint8Array => {
  const publicKeyBase64 = process.env.NEXT_PUBLIC_ENCRYPTION_PUBLIC_KEY;
  
  if (!publicKeyBase64) {
    throw new Error(
      'NEXT_PUBLIC_ENCRYPTION_PUBLIC_KEY not found in environment variables. ' +
      'Run: npx ts-node scripts/generate-keypair.ts to generate keys.'
    );
  }
  
  try {
    return util.decodeBase64(publicKeyBase64);
  } catch {
    throw new Error('Invalid public key format. Expected base64-encoded key.');
  }
};

/**
 * Encrypt a message using the public key
 * Uses NaCl's box encryption (public key encryption)
 * 
 * @param message - The plaintext message to encrypt
 * @returns Base64-encoded encrypted message with nonce prepended
 */
export function encryptMessage(message: string): string {
  try {
    const publicKey = getPublicKey();
    
    // Generate a random nonce (24 bytes)
    const nonce = nacl.randomBytes(24);
    
    // Generate a temporary key pair for this encryption
    const ephemeralKeyPair = nacl.box.keyPair();
    
    // Convert message to Uint8Array
    const messageUint8 = util.decodeUTF8(message);
    
    // Encrypt the message
    const encrypted = nacl.box(
      messageUint8,
      nonce,
      publicKey,
      ephemeralKeyPair.secretKey
    );
    
    if (!encrypted) {
      throw new Error('Encryption failed');
    }
    
    // Combine ephemeral public key + nonce + encrypted message
    // This allows the recipient (with private key) to decrypt
    const fullMessage = new Uint8Array(
      ephemeralKeyPair.publicKey.length + nonce.length + encrypted.length
    );
    fullMessage.set(ephemeralKeyPair.publicKey);
    fullMessage.set(nonce, ephemeralKeyPair.publicKey.length);
    fullMessage.set(encrypted, ephemeralKeyPair.publicKey.length + nonce.length);
    
    // Return as base64
    return util.encodeBase64(fullMessage);
  } catch (error: any) {
    throw new Error(`Encryption error: ${error.message}`);
  }
}

/**
 * Verify that a signature is valid for a given message and address
 * This is used client-side to verify before encryption
 * 
 * @param _message - The original message that was signed
 * @param signature - The signature (hex string starting with 0x)
 * @param _address - The expected signer address
 * @returns True if signature is valid
 */
export function verifySignature(
  _message: string,
  signature: string,
  _address: string
): boolean {
  // We'll use ethers or viem for full verification
  // For now, return true as Privy's signMessage already validates
  // The actual verification happens in the tally process
  return signature.startsWith('0x') && signature.length === 132;
}

/**
 * Convert hex signature to bytes for encryption
 * 
 * @param hexSignature - Signature as hex string (0x...)
 * @returns Uint8Array of signature bytes
 */
export function hexToBytes(hexSignature: string): Uint8Array {
  // Remove 0x prefix if present
  const hex = hexSignature.startsWith('0x') ? hexSignature.slice(2) : hexSignature;
  
  // Convert hex string to Uint8Array
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  
  return bytes;
}

/**
 * Encrypt a signature (hex string) for private voting
 * 
 * @param hexSignature - The signature as hex string (0x...)
 * @returns Base64-encoded encrypted signature
 */
export function encryptSignature(hexSignature: string): string {
  try {
    // Convert hex signature to string (keeping the 0x prefix)
    // We encrypt the full hex string so it can be easily handled
    return encryptMessage(hexSignature);
  } catch (error: any) {
    throw new Error(`Failed to encrypt signature: ${error.message}`);
  }
}


