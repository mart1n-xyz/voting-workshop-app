# Votes 2a-2d Implementation Summary

## Overview

Implementing a 4-round reciprocity and unraveling exercise with committee-based voting.

---

## Committee Assignment

**Function:** `getAssignedCommittee(walletAddress)`

**Returns:** One of three committees:
- Marketing (33.3% probability)
- Operations (33.3% probability)
- Community (33.3% probability)

**Deterministic:** Same wallet → same committee always

---

## The 4 Votes

### Vote 2a: Round 1 (Public)
- **Type:** Public
- **Election ID:** 4
- **Committee Assignment:** Display user's committee
- **Goal:** Observe coalition formation
- **UI Features:**
  - Show committee badge
  - Highlight user's committee initiative
  - Show live results with voter IDs
  - Auto-refresh

### Vote 2b: Round 2 (Public)
- **Type:** Public
- **Election ID:** 5
- **Committee Assignment:** Same as 2a
- **Goal:** Test coalition stability with reputation
- **UI Features:**
  - Same as 2a
  - Emphasize "honor your promises" message

### Vote 2c: Round 3 (Private)
- **Type:** Private (encrypted)
- **Election ID:** 6
- **Committee Assignment:** Same as 2a
- **Goal:** Test coalition stability without visibility
- **UI Features:**
  - Private vote badge
  - Show committee but not individual votes
  - No live results (encrypted)
  - Status: Closed → organizer reveals

### Vote 2d: Round 4 (Private with Bonus)
- **Type:** Private (encrypted)
- **Election ID:** 7
- **Committee Assignment:** Same as 2a
- **Goal:** Test coordination with bonus incentive
- **UI Features:**
  - 🎁 Bonus banner
  - 50% threshold indicator (like vote 1a)
  - Highlight option D with bonus
  - Private vote (encrypted)

---

## Options (All 4 Votes)

1. **A – Citywide Campaign (Marketing)**
2. **B – Process Upgrade (Operations)**
3. **C – Community Program (Community)**
4. **D – Shared Hub (Everyone)**
   - Vote 2d variant: "D – Shared Hub (Everyone, bonus if ≥50%)"

---

## Vote Messages for Signing (Private Votes)

**Vote 2c:**
- "I vote for A – Citywide Campaign (Marketing)"
- "I vote for B – Process Upgrade (Operations)"
- "I vote for C – Community Program (Community)"
- "I vote for D – Shared Hub (Everyone)"

**Vote 2d:**
- "I vote for A – Citywide Campaign (Marketing)"
- "I vote for B – Process Upgrade (Operations)"
- "I vote for C – Community Program (Community)"
- "I vote for D – Shared Hub (Everyone, bonus if ≥50%)"

---

## Implementation Checklist

### Configuration (✅ DONE)
- [x] Updated vote 2a config with proper context
- [x] Updated vote 2b config with proper context
- [x] Updated vote 2c config with proper context
- [x] Updated vote 2d config with proper context and threshold
- [x] Added `getAssignedCommittee()` function
- [x] Added VOTE_2C_OPTIONS and VOTE_2D_OPTIONS to decryption lib

### Voting Booth Page (IN PROGRESS)
- [ ] Import `getAssignedCommittee`
- [ ] Add committee state variable
- [ ] Fetch committee assignment on load

**Vote 2a (Public):**
- [ ] Add state variables
- [ ] Add fetch function
- [ ] Add submit handler
- [ ] Add UI section with committee badge
- [ ] Add live results with voter IDs
- [ ] Add auto-refresh

**Vote 2b (Public):**
- [ ] Add state variables
- [ ] Add fetch function
- [ ] Add submit handler
- [ ] Add UI section with committee badge
- [ ] Add live results with voter IDs
- [ ] Add auto-refresh

**Vote 2c (Private):**
- [ ] Add state variables
- [ ] Add usePrivateVoting hook instance
- [ ] Add fetch status function
- [ ] Add submit handler
- [ ] Add UI section with committee badge
- [ ] Add private vote indicators
- [ ] Add closed state message

**Vote 2d (Private with Bonus):**
- [ ] Add state variables
- [ ] Add usePrivateVoting hook instance
- [ ] Add fetch status function
- [ ] Add submit handler
- [ ] Add UI section with bonus banner
- [ ] Add 50% threshold indicator
- [ ] Add private vote indicators
- [ ] Add closed state message

---

## UI Flow

```
Vote 1b completed
  ↓
Vote 2a appears (Task 5)
  ↓
Shows: "You are in: Marketing Committee"
  ↓
User votes publicly
  ↓
Live results show coalitions forming
  ↓
Vote 2a closes → Vote 2b opens
  ↓
Vote 2b appears (Task 6)
  ↓
Same committee badge shown
  ↓
User votes publicly again
  ↓
Live results show if promises kept
  ↓
Vote 2b closes → Vote 2c opens
  ↓
Vote 2c appears (Task 7)
  ↓
🔒 Private voting badge
  ↓
User votes privately (encrypted)
  ↓
No results shown (just status)
  ↓
Vote 2c closes → Vote 2d opens
  ↓
Vote 2d appears (Task 8)
  ↓
🎁 BONUS REVEALED banner
  ↓
User votes privately
  ↓
No results shown (just status)
  ↓
Done!
```

---

## Key Design Elements

### Committee Badge (All votes 2a-2d)
```tsx
<div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
  <p className="text-sm font-semibold text-blue-900 text-center">
    👥 Your Committee: <span className="text-lg font-bold">Marketing</span>
  </p>
  <p className="text-xs text-blue-700 text-center mt-1">
    Initiative A best serves your committee
  </p>
</div>
```

### Bonus Banner (Vote 2d only)
```tsx
<div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-6">
  <p className="text-lg font-bold text-amber-900 text-center mb-2">
    🎁 BONUS OPPORTUNITY
  </p>
  <p className="text-sm text-amber-800 text-center">
    If D (Shared Hub) reaches 50% or more votes, everyone who voted D earns a bonus!
  </p>
</div>
```

### 50% Threshold (Vote 2d, after close)
- Similar to vote 1a
- Red line at 50% mark
- Highlight when option D reaches threshold

---

## Progressive Disclosure Pattern

- **Task 5 (Vote 2a):** Unlocks after Vote 1b completion
- **Task 6 (Vote 2b):** Unlocks after Vote 2a completion
- **Task 7 (Vote 2c):** Unlocks after Vote 2b completion
- **Task 8 (Vote 2d):** Unlocks after Vote 2c completion

---

## Notes

- **No point displays in app** (presented separately)
- **Committee stays same** across all 4 votes
- **Public votes (2a, 2b):** Show everything like vote 1a
- **Private votes (2c, 2d):** Follow vote 1b pattern
- **Vote 2d:** Add 50% threshold visualization like vote 1a

