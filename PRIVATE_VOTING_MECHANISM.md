# Private Voting Mechanism - Vote 1b

## Overview

Private votes implement **encrypted private voting** where votes are hidden during voting and can be tallied by the organizer after the vote closes. This preserves privacy during the voting period and maintains vote secrecy even after tallying. The organizer uses a **Streamlit dashboard** as a control center to decrypt and tally votes, then publishes aggregated results to participants.

## Key Components

### 1. Encryption Keys
- **Public Key**: Embedded in the app for encryption (public, known to everyone)
- **Private Key**: Kept secret by organizer, used to decrypt and tally votes after voting closes
- Uses **asymmetric encryption** (e.g., RSA or NaCl/libsodium box encryption)

**Key Distribution Strategy:**
- Private key is **only known to the organizer** (kept secret)
- Private key is **NEVER revealed to participants** (remains with organizer)
- After vote closes, organizer uses the private key to decrypt and tally votes
- Organizer publishes the final results to participants
- Trade-off: Participants trust the organizer to perform honest tally

### 2. Vote Structure
Each vote consists of:
- **Message**: The vote choice (e.g., "I vote for District A")
- **Signature**: Ethereum signature of the message by the voter's wallet
- **Encrypted Signature**: The signature encrypted with the public key
- **On-chain Storage**: Only the encrypted signature is stored in the contract

---

## Voting Flow (Client-Side)

### Step 1: User Selects Option
```
User clicks: "District A"
```

### Step 2: Sign the Vote
```typescript
// Construct the message
const message = "I vote for District A";

// User signs with their Ethereum wallet via Privy
const { signature } = await signMessage({ message });
// Result: "0x1234abcd..." (65-byte hex signature)
```

**What happens:** User's wallet creates a cryptographic signature proving they chose District A. Only they could create this signature.

### Step 3: Encrypt the Signature
```typescript
// Load public key from environment
const publicKey = process.env.NEXT_PUBLIC_ENCRYPTION_PUBLIC_KEY;

// Encrypt the signature using the public key
const encryptedSignature = encrypt(signature, publicKey);
// Result: Encrypted bytes that only private key holder can decrypt
```

**What happens:** The signature is encrypted so no one can read which option was chosen until the organizer decrypts it.

### Step 4: Submit to Contract
```typescript
// Send encrypted signature to blockchain
await contract.castPrivateVote(electionId, encryptedSignature);
```

**What happens:** The encrypted signature is stored on-chain. At this point:
- ✅ Vote is recorded and cannot be changed
- ✅ No one can see what was voted
- ✅ Voter's address is linked to their encrypted vote
- ❌ Cannot decrypt without private key

---

## Vote Tallying Flow (After Vote Closes - Organizer Only via Streamlit Dashboard)

### Step 1: Organizer Opens Streamlit Dashboard
```python
# Streamlit dashboard serves as the organizer's control center
# Dashboard has secure access to the private key
# Run locally by organizer: streamlit run organizer_dashboard.py
```

### Step 2: Retrieve All Encrypted Votes
```python
# Dashboard fetches all encrypted votes from contract
user_ids, encrypted_signatures = contract.functions.getAllPrivateVotes(election_id).call()
# user_ids: [1, 2, 3, 4, ...]
# encrypted_signatures: [encrypted_sig1, encrypted_sig2, ...]
```

### Step 3: Decrypt Each Vote (Organizer Only)
```python
# Organizer's private key is securely stored (env variable or secrets manager)
private_key = os.environ['VOTE_1B_PRIVATE_KEY']

# Decrypt all votes
decrypted_signatures = [
    decrypt(encrypted_sig, private_key) 
    for encrypted_sig in encrypted_signatures
]
# Result: Original signatures in plain text
```

### Step 4: Verify Signatures Against Options
For each decrypted signature, check which option it corresponds to:

```python
options = [
  "I vote for District A",
  "I vote for District B", 
  "I vote for District C",
  "I vote for District D"
]

tally = [0, 0, 0, 0]

for user_id, signature in zip(user_ids, decrypted_signatures):
    # Get voter's wallet address from userId
    voter_address = contract.functions.idToAddress(user_id).call()
    
    # Try each option until we find a match
    for index, option in enumerate(options):
        recovered_address = Account.recover_message(
            encode_defunct(text=option), 
            signature=signature
        )
        
        if recovered_address.lower() == voter_address.lower():
            # MATCH! This voter voted for options[index]
            tally[index] += 1
            break
```

**How signature verification works:**
- Ethereum signatures are mathematically bound to both the message and the signer's address
- `recover_message()` extracts the address that created the signature
- If it matches the voter's address, we know they signed that specific message
- This proves they voted for that option

### Step 5: Display and Publish Results
```python
results = {
  "District A": tally[0],
  "District B": tally[1],
  "District C": tally[2],
  "District D": tally[3]
}

# Dashboard displays results with percentages and winner
# Organizer can then publish these results to the frontend
# Results show aggregated counts only, not individual voter mappings
```

**Privacy Note**: Only the organizer performs the decryption. Individual vote-to-voter mappings remain private. Users see only the final aggregated results published by the organizer.

---

## Security Properties

### ✅ What This Provides

1. **Vote Privacy**: During voting, no one (except organizer after closing) can see individual choices
2. **Organizer Verification**: Organizer can cryptographically verify each vote during tally
3. **Non-repudiation**: Voters cannot deny their vote (signature proves it to organizer)
4. **Immutable**: Once cast, votes cannot be changed (stored on blockchain)
5. **No double voting**: Contract prevents same user from voting twice
6. **Trust-based Tallying**: Participants rely on organizer's honesty for accurate results

### ⚠️ Trust Assumptions & Privacy Model

1. **Private Key Security**: Private key must be kept secret by organizer at all times
2. **Early Key Leak**: If private key leaks, votes can be decrypted by anyone (breaks privacy)
3. **Trust in Organizer**: 
   - ⚠️ Participants must **trust the organizer** to perform honest tally
   - ⚠️ Organizer has exclusive access to decrypt votes
   - ✅ Results show only aggregated counts (District A: 5, District B: 3, etc.)
   - ✅ Individual vote-to-voter mappings remain private with organizer
4. **Not Independently Verifiable**: Participants cannot verify the tally themselves (private key not shared)
5. **Stronger Privacy**: Individual votes remain private even from other participants (only organizer can decrypt)
6. **No Coercion Resistance**: Voters could prove their vote to organizer by showing their signature

### 🔒 Why This Works

- **Encryption** hides the vote during voting period
- **Signatures** prove authenticity after decryption  
- **On-chain storage** ensures votes cannot be tampered with
- **Ethereum signatures** tie each vote to a specific wallet address

---

## Implementation Architecture

### Frontend (Client-Side)

```
src/
  hooks/
    usePrivateVoting.ts        # Hook for signing & encrypting votes
  utils/
    encryption.ts               # Encryption utilities (encryption only, no decryption)
  config/
    votesConfig.ts             # Add vote1b configuration
```

### Organizer Dashboard (Streamlit)

```
organizer_dashboard/
  dashboard.py                  # Main Streamlit dashboard
  utils/
    decryption.py               # Decryption utilities
    tally.py                    # Vote tallying logic
    contract_interface.py       # Web3 contract interaction
  requirements.txt              # Python dependencies (streamlit, web3, cryptography)
  .env                          # Secure storage for private key
```

### Environment Variables

**Frontend (.env.local):**
```env
# Public key (safe to commit, used for encryption during voting)
NEXT_PUBLIC_ENCRYPTION_PUBLIC_KEY="..."
```

**Organizer Dashboard (.env):**
```env
# Private key - NEVER shared with participants
VOTE_1B_PRIVATE_KEY="..."

# Contract address and RPC endpoint
CONTRACT_ADDRESS="0x..."
RPC_URL="https://..."
```

**Security Note for POC**: 
- Storing keys in `.env` files is acceptable for a workshop/demonstration
- Private key remains with organizer only - never exposed to participants
- Not production-grade security, but sufficient for educational purposes
- The goal is to demonstrate encryption concepts, not build a bulletproof system
- Participants trust the organizer to perform honest tally

### Smart Contract (Already Implemented)

```solidity
function castPrivateVote(uint256 electionId, bytes calldata encryptedSignature)
function getAllPrivateVotes(uint256 electionId) 
  returns (uint256[] memory userIds, bytes[] memory signatures)
```

### Organizer Tally Dashboard (Streamlit)

```
organizer_dashboard/
  dashboard.py                  # Main dashboard with tally functionality
```

**Tally Process:**
- After vote closes, organizer opens Streamlit dashboard
- Dashboard uses private key to decrypt all votes
- Votes are verified and tallied automatically
- Results are displayed in the dashboard
- Organizer publishes final results to participants (via frontend update or API)
- Participants see aggregated results but cannot independently verify

---

## User Flow Comparison

### Vote 1a (Public)
```
User selects District A
  ↓
Transaction sent with choice = 1
  ↓
Everyone can see: "User #42 voted for District A"
  ↓
Live results update immediately
```

### Vote 1b (Private)
```
User selects District A
  ↓
Sign message: "I vote for District A"
  ↓
Encrypt signature with public key
  ↓
Transaction sent with encrypted signature
  ↓
No one can see what they voted for
  ↓
After close, organizer uses Streamlit dashboard to decrypt and tally
  ↓
Organizer publishes final results (counts only, not individual voter IDs)
  ↓
Users see aggregated results (cannot independently verify)
```

---

## UX Considerations

### During Voting
- Show **no live results** (votes are encrypted)
- Display **number of votes cast** (this is public)
- Inform users: "Results will be revealed after voting closes"

### After User Votes
- Confirm: "Your encrypted vote has been recorded"
- Show: "Total votes cast: 12"
- Inform users: "Results will be revealed after voting closes"

### After Vote Closes
- Organizer runs Streamlit dashboard to decrypt and tally votes
- Organizer publishes final results to participants
- Final vote distribution displayed (counts only, not individual voter IDs)
- **Privacy preserved**: Unlike public votes, we don't show which user voted for what
- **Trust model**: Participants trust organizer to report accurate results


---

## Encryption Library Options

### Option 1: TweetNaCl (Recommended)
```bash
npm install tweetnacl tweetnacl-util
```
- Simple API
- Well-audited
- Good for this use case

### Option 2: Libsodium.js
```bash
npm install libsodium-wrappers
```
- More features
- Slightly larger bundle

### Option 3: Web Crypto API
- Built into browsers
- No dependencies
- More complex API

---

## Implementation Checklist

### Phase 1: Voting
- [ ] Generate encryption key pair
- [ ] Store public key in env variable
- [ ] Store private key securely (organizer only)
- [ ] Implement encryption utility functions
- [ ] Add Vote 1b to votesConfig.ts
- [ ] Create private voting UI component
- [ ] Integrate Privy's signMessage
- [ ] Encrypt signature before submission
- [ ] Submit to castPrivateVote contract function
- [ ] Show confirmation after vote

### Phase 2: Display (During Voting)
- [ ] Show "Waiting for results" state
- [ ] Display total vote count (not distribution)
- [ ] Add banner: "Votes are private - results after closing"

### Phase 3: Tallying (After Close - Organizer Dashboard)
- [ ] Create Streamlit dashboard application
- [ ] Implement Web3 contract interface in Python
- [ ] Add decryption utilities using Python crypto library
- [ ] Fetch all encrypted votes from contract in dashboard
- [ ] Decrypt using organizer's private key
- [ ] Verify signatures against options
- [ ] Build vote distribution (counts only)
- [ ] Display results in Streamlit dashboard
- [ ] Add mechanism to publish results to frontend (API or manual update)
- [ ] Display final results in user-facing UI (NO voter ID mappings)
- [ ] Preserve privacy: Don't expose which specific users voted for what
- [ ] Document trust model: participants trust organizer's tally

---

## Example Messages for Each Option

```typescript
const VOTE_MESSAGES = {
  1: "I vote for District A",
  2: "I vote for District B",
  3: "I vote for District C",
  4: "I vote for District D"
};
```

These must be **exactly the same** in:
1. Frontend when signing
2. Tally script when verifying

---

## Security Best Practices

1. **Keep private key secret at all times** - only organizer should have access
2. **Use strong key generation** (not weak passwords)
3. **Never reveal private key to participants** - organizer-only access
4. **Rotate keys** between different votes/workshops
5. **Store private key securely** on organizer's machine (env file or secrets manager)
6. **Use HTTPS** to prevent man-in-the-middle attacks
7. **Validate all inputs** before encryption
8. **Document trust model clearly** so participants understand organizer performs tally
9. **Backup private key securely** - losing it means votes cannot be decrypted

---

## Advantages Over Traditional Private Voting

### Compared to Off-Chain Voting
- ✅ Blockchain immutability
- ✅ Cannot change votes after submission
- ✅ Transparent vote count (even if content is hidden)

### Compared to Zero-Knowledge Proofs
- ✅ Much simpler to implement
- ✅ Easier to understand for participants
- ✅ Fewer cryptographic assumptions
- ✅ Stronger long-term privacy (votes remain encrypted to all except organizer)
- ⚠️ Requires trust in organizer (not independently verifiable)
- ⚠️ Centralized tally process

### Compared to Fully Public Voting (Vote 1a)
- ✅ No social pressure during voting
- ✅ No strategic bandwagoning
- ✅ True secret ballot (individual votes not exposed to participants)
- ✅ Results show aggregated counts, not per-voter breakdown
- ✅ Vote distribution remains encrypted to participants (only organizer can decrypt)
- ⚠️ Requires trust in organizer's honesty

---

## Conclusion

**Is this implementable?** ✅ **YES!**

**Is this secure?** ✅ **YES** (with proper key management by organizer)

**Complexity level:** Medium (encryption + Streamlit dashboard, but well-documented)

**Estimated implementation time:** 
- Frontend encryption: 2-3 hours
- Streamlit dashboard: 3-4 hours
- Integration & testing: 2 hours
- Total: 7-9 hours for full implementation

**Best use case:** Workshops where vote privacy is important for game theory experiments AND participants trust the organizer to perform honest tally (exactly your Vote 1b scenario!)

**Trust model:** Centralized (organizer-controlled) but with strong privacy guarantees for participants

---

## Next Steps

1. **Generate key pair** using a crypto library
2. **Add to votesConfig.ts**: vote1b with `type: "private"` (no privateKey field needed in frontend)
3. **Implement encryption utilities** in frontend (encryption only, no decryption)
4. **Create private voting UI** (similar to Vote 1a but with encryption and "waiting for results")
5. **Build Streamlit dashboard** for organizer:
   - Web3 contract interface
   - Decryption utilities (Python)
   - Signature verification
   - Tally computation
   - Results display
6. **Add results publishing mechanism** (API endpoint or manual config update)
7. **Display final results** in user-facing UI
8. **Document trust model** clearly for participants
9. **Test thoroughly** with multiple test votes

Ready to implement when you say go! 🚀

---

## Key Architectural Decision

**Organizer-Controlled Tally with Enhanced Privacy**: By keeping the private key exclusively with the organizer and using a Streamlit dashboard for tallying, we achieve:
- ✅ **Strong Privacy**: Votes remain encrypted to all participants permanently
- ✅ **Simple User Experience**: Participants don't need to run tally scripts
- ✅ **Centralized Control**: Organizer manages the entire voting process via dashboard
- ✅ **Educational Value**: Demonstrates encryption and trust models in voting systems
- ✅ **Results Privacy**: Aggregated counts only, individual votes remain secret

**Trust Model for POC:**
- **During voting**: Fully private (encryption protects all votes)
- **After voting**: Organizer decrypts and tallies, publishes aggregated results
- **Trust assumption**: Participants trust organizer to perform honest tally
- **Privacy trade-off**: No independent verification, but stronger vote privacy
- **For workshop purposes**: Appropriate model for educational demonstration with trusted organizer

**Streamlit Dashboard Benefits:**
- Clean control center interface for organizer
- Real-time tally computation and visualization
- Easy to use and understand
- No need to expose private key to participants
- Maintains workshop trust dynamics (organizer as facilitator)

