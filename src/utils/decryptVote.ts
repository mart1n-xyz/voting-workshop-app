/**
 * Utility to decrypt and verify private votes
 * Used by organizer to tally votes after voting closes
 * 
 * Note: Uses both ESM (for Next.js) and CommonJS (for CLI scripts)
 */

// Dynamic imports for Node.js compatibility
let nacl: any;
let util: any;
let verifyMessage: any;

// Initialize modules (works in both Node and browser)
const initModules = async () => {
  if (typeof window === 'undefined') {
    // Node.js environment
    nacl = require('tweetnacl');
    util = require('tweetnacl-util');
    const viem = require('viem');
    verifyMessage = viem.verifyMessage;
  } else {
    // Browser environment
    const naclModule = await import('tweetnacl');
    const utilModule = await import('tweetnacl-util');
    const viemModule = await import('viem');
    nacl = naclModule;
    util = utilModule;
    verifyMessage = viemModule.verifyMessage;
  }
};

/**
 * Vote options for verification
 * Must match the options in votesConfig.ts
 */
export const VOTE_1B_OPTIONS = [
  "I vote for District A",
  "I vote for District B",
  "I vote for District C",
  "I vote for District D",
];

// Initialize immediately for CommonJS
if (typeof window === 'undefined') {
  nacl = require('tweetnacl');
  util = require('tweetnacl-util');
  const viem = require('viem');
  verifyMessage = viem.verifyMessage;
}

/**
 * Parse transaction input data to extract encrypted signature
 * 
 * Transaction format:
 * - Function selector: 4 bytes (0x4a516b03 for castPrivateVote)
 * - Election ID: 32 bytes
 * - Offset to bytes data: 32 bytes
 * - Length of bytes: 32 bytes
 * - Encrypted signature: variable length
 * 
 * @param txInputData - The hex input data from transaction (with or without 0x prefix)
 * @returns Base64 encoded encrypted signature
 */
export function extractEncryptedSignature(txInputData: string): string {
  // Remove 0x prefix if present
  const hex = txInputData.startsWith('0x') ? txInputData.slice(2) : txInputData;
  
  // Function selector: 4 bytes (8 hex chars)
  // Election ID: 32 bytes (64 hex chars)
  // Offset: 32 bytes (64 hex chars)
  // Total offset: 4 + 32 + 32 = 68 bytes = 136 hex chars
  
  // Length of encrypted data (32 bytes at position 136-200)
  const lengthHex = hex.slice(136, 200);
  const length = parseInt(lengthHex, 16);
  
  // Encrypted signature starts at position 200
  const encryptedHex = hex.slice(200, 200 + (length * 2));
  
  // Convert hex to bytes
  const encryptedBytes = new Uint8Array(encryptedHex.length / 2);
  for (let i = 0; i < encryptedHex.length; i += 2) {
    encryptedBytes[i / 2] = parseInt(encryptedHex.substring(i, i + 2), 16);
  }
  
  // Convert to base64
  return util.encodeBase64(encryptedBytes);
}

/**
 * Decrypt an encrypted signature using the private key
 * 
 * The encrypted message format is:
 * - Ephemeral public key: 32 bytes
 * - Nonce: 24 bytes
 * - Encrypted data: variable length
 * 
 * @param encryptedBase64 - Base64 encoded encrypted signature
 * @param privateKeyBase64 - Base64 encoded private key
 * @returns Decrypted signature as hex string (0x...)
 * @throws Error if decryption fails
 */
export function decryptSignature(encryptedBase64: string, privateKeyBase64: string): string {
  try {
    // Decode private key
    const privateKey = util.decodeBase64(privateKeyBase64);
    
    if (privateKey.length !== 32) {
      throw new Error(`Invalid private key length: ${privateKey.length} bytes (expected 32)`);
    }
    
    // Decode encrypted message
    const fullMessage = util.decodeBase64(encryptedBase64);
    
    // Extract components
    const ephemeralPublicKey = fullMessage.slice(0, 32);
    const nonce = fullMessage.slice(32, 56);
    const encrypted = fullMessage.slice(56);
    
    // Decrypt using NaCl box
    const decrypted = nacl.box.open(
      encrypted,
      nonce,
      ephemeralPublicKey,
      privateKey
    );
    
    if (!decrypted) {
      throw new Error('Decryption failed - invalid ciphertext or wrong key');
    }
    
    // Convert to string (should be hex signature)
    const signature = util.encodeUTF8(decrypted);
    
    return signature;
  } catch (error: any) {
    throw new Error(`Decryption error: ${error.message}`);
  }
}

/**
 * Verify which option a signature corresponds to
 * 
 * @param signature - The signature as hex string (0x...)
 * @param voterAddress - The address of the voter
 * @param options - Array of possible vote messages
 * @returns Object with { optionIndex: number, optionText: string } or null if no match
 */
export async function verifyVoteSignature(
  signature: string,
  voterAddress: string,
  options: string[] = VOTE_1B_OPTIONS
): Promise<{ optionIndex: number; optionText: string } | null> {
  try {
    // Try each option
    for (let i = 0; i < options.length; i++) {
      const message = options[i];
      
      try {
        // Verify signature using viem
        const isValid = await verifyMessage({
          address: voterAddress as `0x${string}`,
          message,
          signature: signature as `0x${string}`,
        });
        
        if (isValid) {
          return {
            optionIndex: i,
            optionText: message,
          };
        }
      } catch {
        // This option doesn't match, continue
        continue;
      }
    }
    
    // No match found
    return null;
  } catch (error: any) {
    throw new Error(`Signature verification error: ${error.message}`);
  }
}

/**
 * Complete flow: Decrypt transaction and reveal vote
 * 
 * @param txInputData - Transaction input data (hex)
 * @param voterAddress - Address of the voter
 * @param privateKeyBase64 - Private key for decryption
 * @param options - Array of possible vote messages
 * @returns Object with decryption and verification results
 */
export async function decryptAndVerifyVote(
  txInputData: string,
  voterAddress: string,
  privateKeyBase64: string,
  options: string[] = VOTE_1B_OPTIONS
): Promise<{
  encryptedSignature: string;
  decryptedSignature: string;
  vote: { optionIndex: number; optionText: string } | null;
  districtVoted: string | null;
}> {
  try {
    // Step 1: Extract encrypted signature from transaction
    console.log('Step 1: Extracting encrypted signature from transaction...');
    const encryptedSignature = extractEncryptedSignature(txInputData);
    console.log('✓ Encrypted signature extracted');
    
    // Step 2: Decrypt signature
    console.log('Step 2: Decrypting signature with private key...');
    const decryptedSignature = decryptSignature(encryptedSignature, privateKeyBase64);
    console.log('✓ Signature decrypted:', decryptedSignature);
    
    // Step 3: Verify which option was voted for
    console.log('Step 3: Verifying signature against options...');
    const vote = await verifyVoteSignature(decryptedSignature, voterAddress, options);
    
    if (vote) {
      console.log(`✓ Vote verified: ${vote.optionText}`);
      
      // Extract district letter from "I vote for District X"
      const districtMatch = vote.optionText.match(/District ([A-D])/);
      const districtVoted = districtMatch ? districtMatch[1] : null;
      
      return {
        encryptedSignature,
        decryptedSignature,
        vote,
        districtVoted,
      };
    } else {
      console.log('✗ Could not verify vote - signature does not match any option');
      return {
        encryptedSignature,
        decryptedSignature,
        vote: null,
        districtVoted: null,
      };
    }
  } catch (error: any) {
    throw new Error(`Failed to decrypt and verify vote: ${error.message}`);
  }
}

// CommonJS exports for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    extractEncryptedSignature,
    decryptSignature,
    verifyVoteSignature,
    decryptAndVerifyVote,
    VOTE_1B_OPTIONS,
  };
}

/**
 * Example usage for testing
 */
export async function testDecryption() {
  const txData = "0x4a516b030000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000ccc13d4d9f3c590c67f475968a84d6c43e71aec7c98707ba2493f56822bd24b9750d50e6a146eb30f4f0d3c69238a039e6345c8ac6672f2b85cb6b45f96c3efdf883b44988f55fc2ae1f046fb5c53c0949863129f540e9e93b80a7d146b7a1bca985f80991ffb19a94d35340f01163550a3e52a1862e7e8f010a5a21bec46b0555f4169dc7c4255d18a01d415caeb2d54120340329df585d0d54e813d5c597fe870020515703932258335680c38971b4c98854c664c40441268559714a1a8a7a4f0457eb8e74d6bebce53b02040000000000000000000000000000000000000000";
  const voterAddress = "0xYourVoterAddress"; // Replace with actual voter address
  const privateKey = "UgsmFEqNQrYE32riH1Ph0mBV7g2IVQ1FIXPEbTyb0zY="; // Your private key
  
  try {
    const result = await decryptAndVerifyVote(txData, voterAddress, privateKey);
    console.log('\n=== VOTE REVEALED ===');
    console.log('District voted:', result.districtVoted);
    console.log('Full message:', result.vote?.optionText);
    console.log('Option index:', result.vote?.optionIndex);
    return result;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

