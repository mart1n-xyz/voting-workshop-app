/**
 * CLI Script to decrypt a private vote from transaction data
 * 
 * Usage:
 *   node scripts/decrypt-vote.js <txInputData> <voterAddress>
 * 
 * Example:
 *   node scripts/decrypt-vote.js "0x4a516b03..." "0xabc123..."
 */

const { decryptAndVerifyVote } = require('./decryptVoteLib');
require('dotenv').config();

async function main() {
  // Get arguments
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('❌ Usage: node scripts/decrypt-vote.js <txInputData> <voterAddress>');
    console.error('');
    console.error('Example:');
    console.error('  node scripts/decrypt-vote.js "0x4a516b03..." "0xabc123..."');
    process.exit(1);
  }
  
  const txInputData = args[0];
  const voterAddress = args[1];
  
  // Get private key from environment
  const privateKey = process.env.PRIVATE_KEY_ENCRYPTION;
  
  if (!privateKey) {
    console.error('❌ PRIVATE_KEY_ENCRYPTION not found in .env file');
    process.exit(1);
  }
  
  console.log('🔓 Decrypting Private Vote');
  console.log('━'.repeat(60));
  console.log('Transaction data:', txInputData.slice(0, 50) + '...');
  console.log('Voter address:', voterAddress);
  console.log('');
  
  try {
    const result = await decryptAndVerifyVote(txInputData, voterAddress, privateKey);
    
    console.log('');
    console.log('━'.repeat(60));
    console.log('🎉 VOTE REVEALED');
    console.log('━'.repeat(60));
    console.log('');
    
    if (result.vote) {
      console.log('✓ Vote verified successfully!');
      console.log('');
      console.log('  District voted:   ', result.districtVoted);
      console.log('  Full message:     ', result.vote.optionText);
      console.log('  Option index:     ', result.vote.optionIndex);
      console.log('  Choice number:    ', result.vote.optionIndex + 1);
      console.log('');
      console.log('━'.repeat(60));
    } else {
      console.log('✗ Could not verify vote');
      console.log('  Signature does not match any of the expected options');
      console.log('');
      console.log('  Decrypted signature:', result.decryptedSignature);
    }
    
  } catch (error) {
    console.error('');
    console.error('❌ Error:', error.message);
    console.error('');
    process.exit(1);
  }
}

main();

