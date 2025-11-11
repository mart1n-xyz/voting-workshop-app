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
  // Whether users need district assignment
  requiresDistrictAssignment?: boolean;
  // Coordination threshold (e.g., 0.6 for 60%)
  coordinationThreshold?: number;
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
    title: "Vote 1a: Coordination",
    question: "What is your preferred district?",
    context: "You are a member of a worker cooperative in Río Plata Sur, a fictional mid-sized city in Argentina, that builds software for local businesses. The co-op has just received a grant to expand programming education across the city. Via programming bootcamps, it hopes to upskill participants to later recruit them. As voting members, you must decide how to allocate these funds across 4 districts.\n\nEach of you lives in one of these districts. You'll benefit if the funds are allocated to your district as you'll be running the bootcamps and rewarded for that.",
    requiresDistrictAssignment: true,
    coordinationThreshold: 0.6,
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
    title: "Vote 1b: Private Coordination",
    question: "Which district should receive the programming education grant?",
    context: "The co-op has received another grant for programming education. However, you have recently moved to a different district. This time, votes are private—no one can see your choice until the organizer reveals results after voting closes.",
    requiresDistrictAssignment: true,
    coordinationThreshold: 0.6,
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
    title: "Vote 2a: Strategic Initiative - Round 1 (Public)",
    question: "Which strategic initiative should the co-op prioritize for the next quarter?",
    context: "The co-op must decide which strategic initiative to prioritize. Members are organized into three committees: Marketing, Operations, and Community. Each committee has different priorities.",
    requiresDistrictAssignment: false,
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
    title: "Vote 2b: Strategic Initiative - Round 2 (Public)",
    question: "Which strategic initiative should the co-op prioritize for the next quarter?",
    context: "Same decision as before, votes remain public.",
    requiresDistrictAssignment: false,
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
    title: "Vote 2c: Strategic Initiative - Round 3 (Private)",
    question: "Which strategic initiative should the co-op prioritize for the next quarter?",
    context: "Same decision as before, but now votes are secret. No one can see your choice until the organizer reveals results.",
    requiresDistrictAssignment: false,
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
    title: "Vote 2d: Strategic Initiative - Round 4 (Final, Private)",
    question: "Which strategic initiative should the co-op prioritize for the next quarter?",
    context: "Votes remain private - no one can see your choice.",
    requiresDistrictAssignment: false,
    coordinationThreshold: 0.5,
    options: [
      { id: 1, text: "A – Citywide Campaign (Marketing)" },
      { id: 2, text: "B – Process Upgrade (Operations)" },
      { id: 3, text: "C – Community Program (Community)" },
      { id: 4, text: "D – Shared Hub (Everyone, bonus if ≥50%)" },
    ],
  },

  // Vote 3: Merit vs Luck
  vote3: {
    voteKey: "vote3",
    electionId: 8,
    type: "public",
    title: "Vote 3: Merit vs Luck",
    question: "How should Book #2 be awarded?",
    context: "We're almost done with this workshop. Three prizes will be awarded based on the final points leaderboard. The 3rd place prize is a copy of \"Farewell to Westphalia\" by Jarrad Hope and Peter Ludlow.\n\nThe organizer will announce who is currently in 3rd place before the vote. You can decide how this book should be awarded.\n\nThis vote is fully public – everyone can see who supports each option. Open discussion is encouraged.",
    options: [
      { id: 1, text: "Award to current 3rd place participant" },
      { id: 2, text: "Random draw among all participants" },
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

/**
 * Get assigned district for a wallet address (deterministic)
 * Uses simple hash to assign districts A, B, C, or D with equal probability
 * 
 * @param walletAddress - The wallet address to assign a district to
 * @param seed - Optional seed for different assignments (e.g., "vote1a", "vote1b")
 * @returns District letter: "A", "B", "C", or "D"
 */
export function getAssignedDistrict(walletAddress: string, seed: string = "default"): string {
  // Simple hash: sum of character codes with seed
  let hash = 0;
  const normalized = walletAddress.toLowerCase();
  const input = normalized + seed; // Combine address and seed for different assignments
  
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  
  // Map to districts A, B, C, D (0-3)
  const districtIndex = hash % 4;
  const districts = ['A', 'B', 'C', 'D'];
  
  return districts[districtIndex];
}

/**
 * Get assigned committee for a wallet address (deterministic)
 * Uses simple hash to assign one of three committees with equal probability
 * 
 * @param walletAddress - The wallet address to assign a committee to
 * @returns Committee name: "Marketing", "Operations", or "Community"
 */
export function getAssignedCommittee(walletAddress: string): string {
  // Simple hash: sum of character codes
  let hash = 0;
  const normalized = walletAddress.toLowerCase();
  const input = normalized + "committee"; // Add seed for committee assignment
  
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  
  // Map to committees (0-2) - equal probability
  const committeeIndex = hash % 3;
  const committees = ['Marketing', 'Operations', 'Community'];
  
  return committees[committeeIndex];
}

