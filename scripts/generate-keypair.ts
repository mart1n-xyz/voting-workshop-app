/**
 * Script to generate or derive public key from private key for encryption
 * Run with: npx ts-node scripts/generate-keypair.ts
 */

const nacl = require('tweetnacl');
const util = require('tweetnacl-util');
const fs = require('fs');
const path = require('path');

// Check if PRIVATE_KEY_ENCRYPTION exists in .env.local
const envPath = path.join(process.cwd(), '.env');
let privateKeyHex: string | undefined;

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const match = envContent.match(/PRIVATE_KEY_ENCRYPTION=(.+)/);
  if (match) {
    let rawValue = match[1].trim();
    // Remove quotes if present
    privateKeyHex = rawValue.replace(/^["']|["']$/g, '');
  }
}

if (privateKeyHex) {
  console.log('✅ Found PRIVATE_KEY_ENCRYPTION in .env');
  console.log('📝 Deriving public key from private key...\n');
  
  try {
    let privateKey: Uint8Array;
    
    // Check if the key is in hex format (starts with 0x)
    if (privateKeyHex.startsWith('0x')) {
      console.log('🔍 Detected hex format private key');
      // Remove 0x prefix and convert hex to Uint8Array
      const hex = privateKeyHex.slice(2);
      privateKey = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) {
        privateKey[i / 2] = parseInt(hex.substring(i, i + 2), 16);
      }
    } else {
      console.log('🔍 Detected base64 format private key');
      // Assume base64 format
      privateKey = util.decodeBase64(privateKeyHex);
    }
    
    if (privateKey.length !== 32) {
      throw new Error(`Private key must be 32 bytes, got ${privateKey.length} bytes`);
    }
    
    // Generate the key pair from the private key (seed)
    const keyPair = nacl.box.keyPair.fromSecretKey(privateKey);
    
    // Encode keys in both formats for display
    const privateKeyBase64 = util.encodeBase64(privateKey);
    const privateKeyHexOutput = '0x' + Array.from(privateKey).map(b => b.toString(16).padStart(2, '0')).join('');
    const publicKeyBase64 = util.encodeBase64(keyPair.publicKey);
    
    console.log('🔑 Your encryption keys:');
    console.log('━'.repeat(60));
    console.log('\nPrivate Key (hex):');
    console.log(privateKeyHexOutput);
    console.log('\nPrivate Key (base64, for .env):');
    console.log(privateKeyBase64);
    console.log('\nPublic Key (base64):');
    console.log(publicKeyBase64);
    console.log('\n━'.repeat(60));
    console.log('\n📋 Update your .env with these values:');
    console.log(`PRIVATE_KEY_ENCRYPTION="${privateKeyBase64}"`);
    console.log(`NEXT_PUBLIC_ENCRYPTION_PUBLIC_KEY="${publicKeyBase64}"`);
    console.log('\n💡 The public key will be embedded in src/utils/encryption.ts');
    
  } catch (error: any) {
    console.error('❌ Error deriving public key:', error.message);
    console.log('\n💡 Your PRIVATE_KEY_ENCRYPTION may be in wrong format.');
    console.log('   Expected: hex (0x...) or base64-encoded 32-byte key');
    process.exit(1);
  }
} else {
  console.log('⚠️  No PRIVATE_KEY_ENCRYPTION found in .env.local');
  console.log('🔧 Generating a new key pair...\n');
  
  // Generate a new key pair
  const keyPair = nacl.box.keyPair();
  
  // Encode as base64
  const privateKeyBase64 = util.encodeBase64(keyPair.secretKey);
  const publicKeyBase64 = util.encodeBase64(keyPair.publicKey);
  
  console.log('🔑 New encryption key pair generated:');
  console.log('━'.repeat(60));
  console.log('\nPrivate Key (keep secret, NEVER commit):');
  console.log(privateKeyBase64);
  console.log('\nPublic Key (safe to share & commit):');
  console.log(publicKeyBase64);
  console.log('\n━'.repeat(60));
  console.log('\n📋 Add these to your .env:');
  console.log(`PRIVATE_KEY_ENCRYPTION="${privateKeyBase64}"`);
  console.log(`NEXT_PUBLIC_ENCRYPTION_PUBLIC_KEY="${publicKeyBase64}"`);
  console.log('\n💡 The public key will be embedded in src/utils/encryption.ts');
  console.log('\n⚠️  IMPORTANT: Never commit .env or share your private key!');
}

console.log('\n✅ Done!');

