/**
 * Voting Workshop Configuration
 * 
 * This file centralizes all vote definitions, contract configuration,
 * and voting flow settings for the workshop.
 */

export const VOTING_CONTRACT_ADDRESS = "0x0918E5b67187400548571D372D381C4bB4B9B27b";

export type VoteType = "public" | "private";

export interface VoteOption {
  id: number;
  text: string;
}

export interface VoteConfig {
  // App-level vote identifier
  voteKey: string;
  // Contract election ID (1, 2, 3, ...)
  electionId: number;
  // Vote type determines the flow
  type: VoteType;
  // Display title
  title: string;
  // Question/description
  question: string;
  // Additional context or instructions
  context?: string;
  // Available options
  options: VoteOption[];
  // Whether this is a practice/training vote
  isPractice?: boolean;
}

/**
 * All votes for the workshop
 * Maps app vote keys to contract election IDs and defines voting flow
 */
export const VOTES_CONFIG: Record<string, VoteConfig> = {
  // Vote 0: Training Ground (using public voting for now)
  vote0: {
    voteKey: "vote0",
    electionId: 1, // First election in contract
    type: "public", // Using public for initial implementation
    title: "Training Ground",
    question: "How are you today?",
    context: "This is a practice vote to help everyone get familiar with the voting interface. It has no impact on points or outcomes — just a warm-up.",
    isPractice: true,
    options: [
      { id: 1, text: "Feeling Messi-level productive today" },
      { id: 2, text: "Surviving on empanadas and wine" },
      { id: 3, text: "Could use a siesta." },
      { id: 4, text: "Like the peso — not so stable." },
    ],
  },

  // Vote 1a: Public Coordination
  vote1a: {
    voteKey: "vote1a",
    electionId: 2,
    type: "public",
    title: "District Funding (Public)",
    question: "Which district should receive the programming education grant?",
    context: "You are a member of a worker cooperative in Río Plata Sur. The co-op has received a grant to expand programming education. Each of you lives in one of these districts and will benefit if funds are allocated to your district.",
    options: [
      { id: 1, text: "District A" },
      { id: 2, text: "District B" },
      { id: 3, text: "District C" },
      { id: 4, text: "District D" },
    ],
  },

  // Vote 1b: Private Coordination
  vote1b: {
    voteKey: "vote1b",
    electionId: 3,
    type: "private",
    title: "District Funding (Private)",
    question: "Which district should receive the programming education grant?",
    context: "Same decision as before, but with private voting. You have recently moved to a different district.",
    options: [
      { id: 1, text: "District A" },
      { id: 2, text: "District B" },
      { id: 3, text: "District C" },
      { id: 4, text: "District D" },
    ],
  },

  // Vote 2a: Reciprocity Round 1 (Public)
  vote2a: {
    voteKey: "vote2a",
    electionId: 4,
    type: "public",
    title: "Strategic Initiative - Round 1 (Public)",
    question: "Which strategic initiative should the co-op prioritize?",
    context: "The co-op must decide which initiative to prioritize. Members belong to different committees with different interests.",
    options: [
      { id: 1, text: "A – Citywide Campaign (Marketing)" },
      { id: 2, text: "B – Process Upgrade (Operations)" },
      { id: 3, text: "C – Community Program (Community)" },
      { id: 4, text: "D – Shared Hub (Everyone)" },
    ],
  },

  // Vote 2b: Reciprocity Round 2 (Public)
  vote2b: {
    voteKey: "vote2b",
    electionId: 5,
    type: "public",
    title: "Strategic Initiative - Round 2 (Public)",
    question: "Which strategic initiative should the co-op prioritize?",
    context: "Same decision, still public. Committees are expected to honor their earlier promises.",
    options: [
      { id: 1, text: "A – Citywide Campaign (Marketing)" },
      { id: 2, text: "B – Process Upgrade (Operations)" },
      { id: 3, text: "C – Community Program (Community)" },
      { id: 4, text: "D – Shared Hub (Everyone)" },
    ],
  },

  // Vote 2c: Reciprocity Round 3 (Private)
  vote2c: {
    voteKey: "vote2c",
    electionId: 6,
    type: "private",
    title: "Strategic Initiative - Round 3 (Private)",
    question: "Which strategic initiative should the co-op prioritize?",
    context: "Same decision, but now votes are secret. Will alliances remain stable?",
    options: [
      { id: 1, text: "A – Citywide Campaign (Marketing)" },
      { id: 2, text: "B – Process Upgrade (Operations)" },
      { id: 3, text: "C – Community Program (Community)" },
      { id: 4, text: "D – Shared Hub (Everyone)" },
    ],
  },

  // Vote 2d: Reciprocity Round 4 (Private with Bonus)
  vote2d: {
    voteKey: "vote2d",
    electionId: 7,
    type: "private",
    title: "Strategic Initiative - Round 4 (Private, Final)",
    question: "Which strategic initiative should the co-op prioritize?",
    context: "BONUS REVEALED: If D (Shared Hub) receives 50% or more votes, every D voter earns a +8 point bonus!",
    options: [
      { id: 1, text: "A – Citywide Campaign (Marketing)" },
      { id: 2, text: "B – Process Upgrade (Operations)" },
      { id: 3, text: "C – Community Program (Community)" },
      { id: 4, text: "D – Shared Hub (Everyone, +8 bonus if ≥50%)" },
    ],
  },

  // Vote 3: Prize Distribution
  vote3: {
    voteKey: "vote3",
    electionId: 8,
    type: "public",
    title: "Prize Distribution Method",
    question: "How should the 3rd place prize be awarded?",
    context: "Decide whether the book prize should go to 3rd place or be randomly distributed among all participants.",
    options: [
      { id: 1, text: "RANK-3: Award to participant in 3rd place" },
      { id: 2, text: "RANDOM: Random draw among all participants" },
    ],
  },
};

/**
 * Get vote configuration by key
 */
export function getVoteConfig(voteKey: string): VoteConfig | undefined {
  return VOTES_CONFIG[voteKey];
}

/**
 * Get all vote keys in order
 */
export function getAllVoteKeys(): string[] {
  return Object.keys(VOTES_CONFIG);
}

/**
 * Get vote config by election ID
 */
export function getVoteByElectionId(electionId: number): VoteConfig | undefined {
  return Object.values(VOTES_CONFIG).find(vote => vote.electionId === electionId);
}

