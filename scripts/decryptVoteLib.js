/**
 * Utility to decrypt and verify private votes (CommonJS version for Node.js)
 * Used by organizer to tally votes after voting closes
 */

const nacl = require('tweetnacl');
const util = require('tweetnacl-util');
const { verifyMessage } = require('viem');

/**
 * Vote options for verification
 * Must match the options in votesConfig.ts
 */
const VOTE_1B_OPTIONS = [
  "I vote for District A",
  "I vote for District B",
  "I vote for District C",
  "I vote for District D",
];

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
 * @param {string} txInputData - The hex input data from transaction (with or without 0x prefix)
 * @returns {string} Base64 encoded encrypted signature
 */
function extractEncryptedSignature(txInputData) {
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
 * @param {string} encryptedBase64 - Base64 encoded encrypted signature
 * @param {string} privateKeyBase64 - Base64 encoded private key
 * @returns {string} Decrypted signature as hex string (0x...)
 * @throws {Error} if decryption fails
 */
function decryptSignature(encryptedBase64, privateKeyBase64) {
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
  } catch (error) {
    throw new Error(`Decryption error: ${error.message}`);
  }
}

/**
 * Verify which option a signature corresponds to
 * 
 * @param {string} signature - The signature as hex string (0x...)
 * @param {string} voterAddress - The address of the voter
 * @param {string[]} options - Array of possible vote messages
 * @returns {Promise<{optionIndex: number, optionText: string}|null>}
 */
async function verifyVoteSignature(signature, voterAddress, options = VOTE_1B_OPTIONS) {
  try {
    // Try each option
    for (let i = 0; i < options.length; i++) {
      const message = options[i];
      
      try {
        // Verify signature using viem
        const isValid = await verifyMessage({
          address: voterAddress,
          message,
          signature: signature,
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
  } catch (error) {
    throw new Error(`Signature verification error: ${error.message}`);
  }
}

/**
 * Complete flow: Decrypt transaction and reveal vote
 * 
 * @param {string} txInputData - Transaction input data (hex)
 * @param {string} voterAddress - Address of the voter
 * @param {string} privateKeyBase64 - Private key for decryption
 * @param {string[]} options - Array of possible vote messages
 * @returns {Promise<Object>} Object with decryption and verification results
 */
async function decryptAndVerifyVote(txInputData, voterAddress, privateKeyBase64, options = VOTE_1B_OPTIONS) {
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
  } catch (error) {
    throw new Error(`Failed to decrypt and verify vote: ${error.message}`);
  }
}

module.exports = {
  extractEncryptedSignature,
  decryptSignature,
  verifyVoteSignature,
  decryptAndVerifyVote,
  VOTE_1B_OPTIONS,
};

