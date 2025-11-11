"use client";

import { usePrivy, useSendTransaction } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Header } from "@/components/ui/header";
import { FullScreenLoader } from "@/components/ui/fullscreen-loader";
import { createPublicClient, http, encodeFunctionData } from "viem";
import { statusNetworkSepolia } from "viem/chains";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { ToastContainer } from "react-toastify";
import { showSuccessToast, showErrorToast } from "@/components/ui/custom-toast";
import { getVoteConfig, VOTING_CONTRACT_ADDRESS, getAssignedDistrict, getAssignedCommittee } from "@/config/votesConfig";
import { usePrivateVoting } from "@/hooks/usePrivateVoting";

const VOTING_WORKSHOP_ABI = [
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "addressToId",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "idToAddress",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getTotalRegistered",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "electionId", type: "uint256" },
      { internalType: "uint256", name: "choice", type: "uint256" }
    ],
    name: "castPublicVote",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "electionId", type: "uint256" },
      { internalType: "bytes", name: "encryptedSignature", type: "bytes" }
    ],
    name: "castPrivateVote",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "electionId", type: "uint256" },
      { internalType: "address", name: "userAddress", type: "address" }
    ],
    name: "hasUserVoted",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "electionId", type: "uint256" },
      { internalType: "uint256", name: "numChoices", type: "uint256" }
    ],
    name: "getElectionResults",
    outputs: [{ internalType: "uint256[]", name: "counts", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "electionId", type: "uint256" }],
    name: "getElection",
    outputs: [{
      components: [
        { internalType: "uint256", name: "id", type: "uint256" },
        { internalType: "uint8", name: "status", type: "uint8" },
        { internalType: "bool", name: "isPublic", type: "bool" },
        { internalType: "uint256", name: "openedAt", type: "uint256" },
        { internalType: "uint256", name: "closedAt", type: "uint256" }
      ],
      internalType: "struct VotingWorkshop.Election",
      name: "",
      type: "tuple"
    }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "electionId", type: "uint256" }],
    name: "getAllPublicVotes",
    outputs: [
      { internalType: "uint256[]", name: "userIds", type: "uint256[]" },
      { internalType: "uint256[]", name: "choices", type: "uint256[]" }
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

export default function VotingBooth() {
  const { ready, authenticated, user } = usePrivy();
  const { sendTransaction } = useSendTransaction();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [task1Complete, setTask1Complete] = useState(false);
  const [task1Collapsed, setTask1Collapsed] = useState(false);
  const [vote0Collapsed, setVote0Collapsed] = useState(false);
  const [vote1aCollapsed, setVote1aCollapsed] = useState(false);
  const [vote1bCollapsed, setVote1bCollapsed] = useState(false);
  
  // Vote 0 state
  const [selectedOption0, setSelectedOption0] = useState<number | null>(null);
  const [isSubmitting0, setIsSubmitting0] = useState(false);
  const [hasVoted0, setHasVoted0] = useState(false);
  const [userVote0, setUserVote0] = useState<number | null>(null);
  const [voteCounts0, setVoteCounts0] = useState<number[]>([]);
  const [totalVotes0, setTotalVotes0] = useState(0);
  const [electionStatus0, setElectionStatus0] = useState<"Open" | "Closed" | null>(null);
  const [isRefreshingResults0, setIsRefreshingResults0] = useState(false);
  const [votersByChoice0, setVotersByChoice0] = useState<Record<number, number[]>>({});
  
  // Vote 1a state
  const [selectedOption1a, setSelectedOption1a] = useState<number | null>(null);
  const [isSubmitting1a, setIsSubmitting1a] = useState(false);
  const [hasVoted1a, setHasVoted1a] = useState(false);
  const [userVote1a, setUserVote1a] = useState<number | null>(null);
  const [voteCounts1a, setVoteCounts1a] = useState<number[]>([]);
  const [totalVotes1a, setTotalVotes1a] = useState(0);
  const [electionStatus1a, setElectionStatus1a] = useState<"Open" | "Closed" | null>(null);
  const [isRefreshingResults1a, setIsRefreshingResults1a] = useState(false);
  const [assignedDistrict, setAssignedDistrict] = useState<string | null>(null);
  const [votersByChoice1a, setVotersByChoice1a] = useState<Record<number, number[]>>({});
  
  // Vote 1a state
  const [assignedDistrict1a, setAssignedDistrict1a] = useState<string | null>(null);
  // Vote 1b has its own district assignment (independent from 1a)
  const [assignedDistrict1b, setAssignedDistrict1b] = useState<string | null>(null);
  
  // Committee assignment (same for all votes 2a-2d)
  const [assignedCommittee, setAssignedCommittee] = useState<string | null>(null);
  
  // Voter list modal
  const [showVoterListModal, setShowVoterListModal] = useState(false);
  const [allVoters, setAllVoters] = useState<Array<{ id: number; address: string; committee: string }>>([]);
  
  // Vote 2a state (public)
  const [selectedOption2a, setSelectedOption2a] = useState<number | null>(null);
  const [isSubmitting2a, setIsSubmitting2a] = useState(false);
  const [hasVoted2a, setHasVoted2a] = useState(false);
  const [userVote2a, setUserVote2a] = useState<number | null>(null);
  const [voteCounts2a, setVoteCounts2a] = useState<number[]>([]);
  const [totalVotes2a, setTotalVotes2a] = useState(0);
  const [electionStatus2a, setElectionStatus2a] = useState<"Open" | "Closed" | null>(null);
  const [isRefreshingResults2a, setIsRefreshingResults2a] = useState(false);
  const [votersByChoice2a, setVotersByChoice2a] = useState<Record<number, number[]>>({});
  const [vote2aCollapsed, setVote2aCollapsed] = useState(false);
  
  // Vote 2b state (public)
  const [selectedOption2b, setSelectedOption2b] = useState<number | null>(null);
  const [isSubmitting2b, setIsSubmitting2b] = useState(false);
  const [hasVoted2b, setHasVoted2b] = useState(false);
  const [userVote2b, setUserVote2b] = useState<number | null>(null);
  const [voteCounts2b, setVoteCounts2b] = useState<number[]>([]);
  const [totalVotes2b, setTotalVotes2b] = useState(0);
  const [electionStatus2b, setElectionStatus2b] = useState<"Open" | "Closed" | null>(null);
  const [isRefreshingResults2b, setIsRefreshingResults2b] = useState(false);
  const [votersByChoice2b, setVotersByChoice2b] = useState<Record<number, number[]>>({});
  const [vote2bCollapsed, setVote2bCollapsed] = useState(false);
  
  // Vote 2c state (private)
  const [selectedOption2c, setSelectedOption2c] = useState<number | null>(null);
  const [hasVoted2c, setHasVoted2c] = useState(false);
  const [electionStatus2c, setElectionStatus2c] = useState<"Open" | "Closed" | null>(null);
  const [vote2cCollapsed, setVote2cCollapsed] = useState(false);
  
  // Vote 2d state (private with bonus)
  const [selectedOption2d, setSelectedOption2d] = useState<number | null>(null);
  const [hasVoted2d, setHasVoted2d] = useState(false);
  const [electionStatus2d, setElectionStatus2d] = useState<"Open" | "Closed" | null>(null);
  const [vote2dCollapsed, setVote2dCollapsed] = useState(false);
  
  // Vote 3 state (public)
  const [selectedOption3, setSelectedOption3] = useState<number | null>(null);
  const [isSubmitting3, setIsSubmitting3] = useState(false);
  const [hasVoted3, setHasVoted3] = useState(false);
  const [userVote3, setUserVote3] = useState<number | null>(null);
  const [voteCounts3, setVoteCounts3] = useState<number[]>([]);
  const [totalVotes3, setTotalVotes3] = useState(0);
  const [electionStatus3, setElectionStatus3] = useState<"Open" | "Closed" | null>(null);
  const [isRefreshingResults3, setIsRefreshingResults3] = useState(false);
  const [votersByChoice3, setVotersByChoice3] = useState<Record<number, number[]>>({});
  const [vote3Collapsed, setVote3Collapsed] = useState(false);
  
  const vote0Config = getVoteConfig("vote0");
  const vote1aConfig = getVoteConfig("vote1a");
  const vote1bConfig = getVoteConfig("vote1b");
  const vote2aConfig = getVoteConfig("vote2a");
  const vote2bConfig = getVoteConfig("vote2b");
  const vote2cConfig = getVoteConfig("vote2c");
  const vote2dConfig = getVoteConfig("vote2d");
  const vote3Config = getVoteConfig("vote3");
  
  // Vote 1b state (private vote)
  const [selectedOption1b, setSelectedOption1b] = useState<number | null>(null);
  const [hasVoted1b, setHasVoted1b] = useState(false);
  const [electionStatus1b, setElectionStatus1b] = useState<"Open" | "Closed" | null>(null);
  
  // Private voting hook for vote 1b
  const { submitPrivateVote: submitVote1b, isSubmitting: isSubmitting1b } = usePrivateVoting({
    voteConfig: vote1bConfig!,
    onSuccess: () => {
      showSuccessToast("Your private vote has been recorded!");
      setHasVoted1b(true);
      setTimeout(() => fetchElectionStatus1b(), 1500);
    },
    onError: (error) => {
      showErrorToast(error);
    },
  });
  
  // Private voting hook for vote 2c
  const { submitPrivateVote: submitVote2c, isSubmitting: isSubmitting2c } = usePrivateVoting({
    voteConfig: vote2cConfig!,
    onSuccess: () => {
      showSuccessToast("Your private vote has been recorded!");
      setHasVoted2c(true);
      setTimeout(() => fetchElectionStatus2c(), 1500);
    },
    onError: (error) => {
      showErrorToast(error);
    },
  });
  
  // Private voting hook for vote 2d
  const { submitPrivateVote: submitVote2d, isSubmitting: isSubmitting2d } = usePrivateVoting({
    voteConfig: vote2dConfig!,
    onSuccess: () => {
      showSuccessToast("Your private vote has been recorded!");
      setHasVoted2d(true);
      setTimeout(() => fetchElectionStatus2d(), 1500);
    },
    onError: (error) => {
      showErrorToast(error);
    },
  });

  // Function to fetch all registered voters and their committee assignments
  const fetchAllVoters = async () => {
    try {
      const publicClient = createPublicClient({
        chain: statusNetworkSepolia,
        transport: http("https://public.sepolia.rpc.status.network"),
      });

      // Get total number of registered users
      const totalRegistered = await publicClient.readContract({
        address: VOTING_CONTRACT_ADDRESS,
        abi: VOTING_WORKSHOP_ABI,
        functionName: "getTotalRegistered",
        args: [],
      });

      const total = Number(totalRegistered);
      const voters: Array<{ id: number; address: string; committee: string }> = [];

      // Fetch each voter's address and calculate committee
      for (let i = 1; i <= total; i++) {
        const address = await publicClient.readContract({
          address: VOTING_CONTRACT_ADDRESS,
          abi: VOTING_WORKSHOP_ABI,
          functionName: "idToAddress",
          args: [BigInt(i)],
        });

        const committee = getAssignedCommittee(address as string);
        voters.push({
          id: i,
          address: address as string,
          committee: committee,
        });
      }

      setAllVoters(voters);
    } catch (error) {
      console.error("Error fetching all voters:", error);
    }
  };

  // Function to fetch election results for Vote 0
  const fetchElectionResults0 = async (autoCollapseOnLoad = false) => {
    if (!vote0Config) return;
    
    try {
      const publicClient = createPublicClient({
        chain: statusNetworkSepolia,
        transport: http("https://public.sepolia.rpc.status.network"),
      });

      // Get election status
      const election = await publicClient.readContract({
        address: VOTING_CONTRACT_ADDRESS,
        abi: VOTING_WORKSHOP_ABI,
        functionName: "getElection",
        args: [BigInt(vote0Config.electionId)],
      });

      const status = election.status === 1 ? "Open" : "Closed";
      setElectionStatus0(status);
      
      // Auto-collapse if closed or on initial load
      if (autoCollapseOnLoad && status !== "Open") {
        setVote0Collapsed(true);
      }

      // Get vote counts for all options
      const counts = await publicClient.readContract({
        address: VOTING_CONTRACT_ADDRESS,
        abi: VOTING_WORKSHOP_ABI,
        functionName: "getElectionResults",
        args: [BigInt(vote0Config.electionId), BigInt(vote0Config.options.length)],
      });

      const countsArray = counts.map(c => Number(c));
      setVoteCounts0(countsArray);
      setTotalVotes0(countsArray.reduce((sum, count) => sum + count, 0));

      // Get all votes to show voter IDs per choice
      const allVotes = await publicClient.readContract({
        address: VOTING_CONTRACT_ADDRESS,
        abi: VOTING_WORKSHOP_ABI,
        functionName: "getAllPublicVotes",
        args: [BigInt(vote0Config.electionId)],
      });

      // Destructure the tuple result
      const [userIds, choices] = allVotes;

      // Group voters by their choice
      const votersByChoice: Record<number, number[]> = {};
      userIds.forEach((userId: bigint, index: number) => {
        const choice = Number(choices[index]);
        if (!votersByChoice[choice]) {
          votersByChoice[choice] = [];
        }
        votersByChoice[choice].push(Number(userId));
      });

      setVotersByChoice0(votersByChoice);
    } catch (error) {
      console.error("Error fetching results for vote 0:", error);
      // If election doesn't exist yet, auto-collapse on load
      if (autoCollapseOnLoad) {
        setVote0Collapsed(true);
      }
    }
  };

  // Function to fetch election status and vote count for Vote 1b (private vote)
  const fetchElectionStatus1b = async (autoCollapseOnLoad = false) => {
    if (!vote1bConfig) return;
    
    try {
      const publicClient = createPublicClient({
        chain: statusNetworkSepolia,
        transport: http("https://public.sepolia.rpc.status.network"),
      });

      // Get election status
      const election = await publicClient.readContract({
        address: VOTING_CONTRACT_ADDRESS,
        abi: VOTING_WORKSHOP_ABI,
        functionName: "getElection",
        args: [BigInt(vote1bConfig.electionId)],
      });

      const status = election.status === 1 ? "Open" : "Closed";
      setElectionStatus1b(status);
      
      // Auto-collapse if closed or on initial load
      if (autoCollapseOnLoad && status !== "Open") {
        setVote1bCollapsed(true);
      }
    } catch (error) {
      console.error("Error fetching status for vote 1b:", error);
      // If election doesn't exist yet, auto-collapse on load
      if (autoCollapseOnLoad) {
        setVote1bCollapsed(true);
      }
    }
  };

  // Function to fetch election results for Vote 2a (public)
  const fetchElectionResults2a = async (autoCollapseOnLoad = false) => {
    if (!vote2aConfig) return;
    
    try {
      const publicClient = createPublicClient({
        chain: statusNetworkSepolia,
        transport: http("https://public.sepolia.rpc.status.network"),
      });

      const election = await publicClient.readContract({
        address: VOTING_CONTRACT_ADDRESS,
        abi: VOTING_WORKSHOP_ABI,
        functionName: "getElection",
        args: [BigInt(vote2aConfig.electionId)],
      });

      const status = election.status === 1 ? "Open" : "Closed";
      setElectionStatus2a(status);
      
      if (autoCollapseOnLoad && status !== "Open") {
        setVote2aCollapsed(true);
      }

      const counts = await publicClient.readContract({
        address: VOTING_CONTRACT_ADDRESS,
        abi: VOTING_WORKSHOP_ABI,
        functionName: "getElectionResults",
        args: [BigInt(vote2aConfig.electionId), BigInt(vote2aConfig.options.length)],
      });

      const countsArray = counts.map(c => Number(c));
      setVoteCounts2a(countsArray);
      setTotalVotes2a(countsArray.reduce((sum, count) => sum + count, 0));

      const allVotes = await publicClient.readContract({
        address: VOTING_CONTRACT_ADDRESS,
        abi: VOTING_WORKSHOP_ABI,
        functionName: "getAllPublicVotes",
        args: [BigInt(vote2aConfig.electionId)],
      });

      const [userIds, choices] = allVotes;
      const votersByChoice: Record<number, number[]> = {};
      userIds.forEach((userId: bigint, index: number) => {
        const choice = Number(choices[index]);
        if (!votersByChoice[choice]) {
          votersByChoice[choice] = [];
        }
        votersByChoice[choice].push(Number(userId));
      });

      setVotersByChoice2a(votersByChoice);
    } catch (error) {
      console.error("Error fetching results for vote 2a:", error);
      if (autoCollapseOnLoad) {
        setVote2aCollapsed(true);
      }
    }
  };

  // Function to fetch election results for Vote 2b (public)
  const fetchElectionResults2b = async (autoCollapseOnLoad = false) => {
    if (!vote2bConfig) return;
    
    try {
      const publicClient = createPublicClient({
        chain: statusNetworkSepolia,
        transport: http("https://public.sepolia.rpc.status.network"),
      });

      const election = await publicClient.readContract({
        address: VOTING_CONTRACT_ADDRESS,
        abi: VOTING_WORKSHOP_ABI,
        functionName: "getElection",
        args: [BigInt(vote2bConfig.electionId)],
      });

      const status = election.status === 1 ? "Open" : "Closed";
      setElectionStatus2b(status);
      
      if (autoCollapseOnLoad && status !== "Open") {
        setVote2bCollapsed(true);
      }

      const counts = await publicClient.readContract({
        address: VOTING_CONTRACT_ADDRESS,
        abi: VOTING_WORKSHOP_ABI,
        functionName: "getElectionResults",
        args: [BigInt(vote2bConfig.electionId), BigInt(vote2bConfig.options.length)],
      });

      const countsArray = counts.map(c => Number(c));
      setVoteCounts2b(countsArray);
      setTotalVotes2b(countsArray.reduce((sum, count) => sum + count, 0));

      const allVotes = await publicClient.readContract({
        address: VOTING_CONTRACT_ADDRESS,
        abi: VOTING_WORKSHOP_ABI,
        functionName: "getAllPublicVotes",
        args: [BigInt(vote2bConfig.electionId)],
      });

      const [userIds, choices] = allVotes;
      const votersByChoice: Record<number, number[]> = {};
      userIds.forEach((userId: bigint, index: number) => {
        const choice = Number(choices[index]);
        if (!votersByChoice[choice]) {
          votersByChoice[choice] = [];
        }
        votersByChoice[choice].push(Number(userId));
      });

      setVotersByChoice2b(votersByChoice);
    } catch (error) {
      console.error("Error fetching results for vote 2b:", error);
      if (autoCollapseOnLoad) {
        setVote2bCollapsed(true);
      }
    }
  };

  // Function to fetch election status for Vote 2c (private)
  const fetchElectionStatus2c = async (autoCollapseOnLoad = false) => {
    if (!vote2cConfig) return;
    
    try {
      const publicClient = createPublicClient({
        chain: statusNetworkSepolia,
        transport: http("https://public.sepolia.rpc.status.network"),
      });

      const election = await publicClient.readContract({
        address: VOTING_CONTRACT_ADDRESS,
        abi: VOTING_WORKSHOP_ABI,
        functionName: "getElection",
        args: [BigInt(vote2cConfig.electionId)],
      });

      const status = election.status === 1 ? "Open" : "Closed";
      setElectionStatus2c(status);
      
      if (autoCollapseOnLoad && status !== "Open") {
        setVote2cCollapsed(true);
      }
    } catch (error) {
      console.error("Error fetching status for vote 2c:", error);
      if (autoCollapseOnLoad) {
        setVote2cCollapsed(true);
      }
    }
  };

  // Function to fetch election status for Vote 2d (private)
  const fetchElectionStatus2d = async (autoCollapseOnLoad = false) => {
    if (!vote2dConfig) return;
    
    try {
      const publicClient = createPublicClient({
        chain: statusNetworkSepolia,
        transport: http("https://public.sepolia.rpc.status.network"),
      });

      const election = await publicClient.readContract({
        address: VOTING_CONTRACT_ADDRESS,
        abi: VOTING_WORKSHOP_ABI,
        functionName: "getElection",
        args: [BigInt(vote2dConfig.electionId)],
      });

      const status = election.status === 1 ? "Open" : "Closed";
      setElectionStatus2d(status);
      
      if (autoCollapseOnLoad && status !== "Open") {
        setVote2dCollapsed(true);
      }
    } catch (error) {
      console.error("Error fetching status for vote 2d:", error);
      if (autoCollapseOnLoad) {
        setVote2dCollapsed(true);
      }
    }
  };

  // Function to fetch election results for Vote 3 (public)
  const fetchElectionResults3 = async (autoCollapseOnLoad = false) => {
    if (!vote3Config) return;
    
    try {
      const publicClient = createPublicClient({
        chain: statusNetworkSepolia,
        transport: http("https://public.sepolia.rpc.status.network"),
      });

      const election = await publicClient.readContract({
        address: VOTING_CONTRACT_ADDRESS,
        abi: VOTING_WORKSHOP_ABI,
        functionName: "getElection",
        args: [BigInt(vote3Config.electionId)],
      });

      const status = election.status === 1 ? "Open" : "Closed";
      setElectionStatus3(status);
      
      if (autoCollapseOnLoad && status !== "Open") {
        setVote3Collapsed(true);
      }

      const counts = await publicClient.readContract({
        address: VOTING_CONTRACT_ADDRESS,
        abi: VOTING_WORKSHOP_ABI,
        functionName: "getElectionResults",
        args: [BigInt(vote3Config.electionId), BigInt(vote3Config.options.length)],
      });

      const countsArray = counts.map(c => Number(c));
      setVoteCounts3(countsArray);
      setTotalVotes3(countsArray.reduce((sum, count) => sum + count, 0));

      const allVotes = await publicClient.readContract({
        address: VOTING_CONTRACT_ADDRESS,
        abi: VOTING_WORKSHOP_ABI,
        functionName: "getAllPublicVotes",
        args: [BigInt(vote3Config.electionId)],
      });

      const [userIds, choices] = allVotes;
      const votersByChoice: Record<number, number[]> = {};
      userIds.forEach((userId: bigint, index: number) => {
        const choice = Number(choices[index]);
        if (!votersByChoice[choice]) {
          votersByChoice[choice] = [];
        }
        votersByChoice[choice].push(Number(userId));
      });

      setVotersByChoice3(votersByChoice);
    } catch (error) {
      console.error("Error fetching results for vote 3:", error);
      if (autoCollapseOnLoad) {
        setVote3Collapsed(true);
      }
    }
  };

  // Function to fetch election results for Vote 1a
  const fetchElectionResults1a = async (autoCollapseOnLoad = false) => {
    if (!vote1aConfig) return;
    
    try {
      const publicClient = createPublicClient({
        chain: statusNetworkSepolia,
        transport: http("https://public.sepolia.rpc.status.network"),
      });

      // Get election status
      const election = await publicClient.readContract({
        address: VOTING_CONTRACT_ADDRESS,
        abi: VOTING_WORKSHOP_ABI,
        functionName: "getElection",
        args: [BigInt(vote1aConfig.electionId)],
      });

      const status = election.status === 1 ? "Open" : "Closed";
      setElectionStatus1a(status);
      
      // Auto-collapse if closed or on initial load
      if (autoCollapseOnLoad && status !== "Open") {
        setVote1aCollapsed(true);
      }

      // Get vote counts for all options
      const counts = await publicClient.readContract({
        address: VOTING_CONTRACT_ADDRESS,
        abi: VOTING_WORKSHOP_ABI,
        functionName: "getElectionResults",
        args: [BigInt(vote1aConfig.electionId), BigInt(vote1aConfig.options.length)],
      });

      const countsArray = counts.map(c => Number(c));
      setVoteCounts1a(countsArray);
      setTotalVotes1a(countsArray.reduce((sum, count) => sum + count, 0));

      // Get all votes to show voter IDs per choice
      const allVotes = await publicClient.readContract({
        address: VOTING_CONTRACT_ADDRESS,
        abi: VOTING_WORKSHOP_ABI,
        functionName: "getAllPublicVotes",
        args: [BigInt(vote1aConfig.electionId)],
      });

      // Destructure the tuple result
      const [userIds, choices] = allVotes;

      // Group voters by their choice
      const votersByChoice: Record<number, number[]> = {};
      userIds.forEach((userId: bigint, index: number) => {
        const choice = Number(choices[index]);
        if (!votersByChoice[choice]) {
          votersByChoice[choice] = [];
        }
        votersByChoice[choice].push(Number(userId));
      });

      setVotersByChoice1a(votersByChoice);
    } catch (error) {
      console.error("Error fetching results for vote 1a:", error);
      // If election doesn't exist yet, auto-collapse on load
      if (autoCollapseOnLoad) {
        setVote1aCollapsed(true);
      }
    }
  };

  useEffect(() => {
    async function checkRegistrationAndVotes() {
      if (!ready || !authenticated || !user) return;

      try {
        // Get the user's wallet address
        const walletAddress = user.wallet?.address;
        if (!walletAddress) {
          router.push("/");
          return;
        }

        // Create a public client to read from the contract
        const publicClient = createPublicClient({
          chain: statusNetworkSepolia,
          transport: http("https://public.sepolia.rpc.status.network"),
        });

        // Check if user is registered
        const id = await publicClient.readContract({
          address: VOTING_CONTRACT_ADDRESS,
          abi: VOTING_WORKSHOP_ABI,
          functionName: "addressToId",
          args: [walletAddress as `0x${string}`],
        });

        if (id === BigInt(0)) {
          // User is not registered, redirect to home
          router.push("/");
        } else {
          setUserId(id.toString());
          
          // Assign districts for vote 1a and 1b (different assignments)
          const district1a = getAssignedDistrict(walletAddress, "vote1a");
          const district1b = getAssignedDistrict(walletAddress, "vote1b");
          setAssignedDistrict(district1a); // Keep for backward compatibility
          setAssignedDistrict1a(district1a);
          setAssignedDistrict1b(district1b);
          
          // Assign committee for votes 2a-2d (same committee for all)
          const committee = getAssignedCommittee(walletAddress);
          setAssignedCommittee(committee);
          
          // Mark Task 1 as complete (assume user has seen their ID after registration)
          setTask1Complete(true);
          setTask1Collapsed(true);
          
          const publicVotesABI = [
            {
              inputs: [
                { internalType: "uint256", name: "", type: "uint256" },
                { internalType: "uint256", name: "", type: "uint256" }
              ],
              name: "publicVotes",
              outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
              stateMutability: "view",
              type: "function",
            },
          ] as const;
          
          // Check if user has voted in vote 0
          if (vote0Config) {
            const voted0 = await publicClient.readContract({
              address: VOTING_CONTRACT_ADDRESS,
              abi: VOTING_WORKSHOP_ABI,
              functionName: "hasUserVoted",
              args: [BigInt(vote0Config.electionId), walletAddress as `0x${string}`],
            });
            
            setHasVoted0(voted0);
            
            // If voted, get their vote choice
            if (voted0) {
              const choice = await publicClient.readContract({
                address: VOTING_CONTRACT_ADDRESS,
                abi: publicVotesABI,
                functionName: "publicVotes",
                args: [BigInt(vote0Config.electionId), id],
              });
              
              setUserVote0(Number(choice));
            }
            
            // Fetch initial results for vote 0 (with auto-collapse on load)
            await fetchElectionResults0(true);
          }
          
          // Check if user has voted in vote 1a
          if (vote1aConfig) {
            const voted1a = await publicClient.readContract({
              address: VOTING_CONTRACT_ADDRESS,
              abi: VOTING_WORKSHOP_ABI,
              functionName: "hasUserVoted",
              args: [BigInt(vote1aConfig.electionId), walletAddress as `0x${string}`],
            });
            
            setHasVoted1a(voted1a);
            
            // If voted, get their vote choice
            if (voted1a) {
              const choice = await publicClient.readContract({
                address: VOTING_CONTRACT_ADDRESS,
                abi: publicVotesABI,
                functionName: "publicVotes",
                args: [BigInt(vote1aConfig.electionId), id],
              });
              
              setUserVote1a(Number(choice));
            }
            
            // Fetch initial results for vote 1a (with auto-collapse on load)
            await fetchElectionResults1a(true);
          }
          
          // Check if user has voted in vote 1b (private vote)
          if (vote1bConfig) {
            const voted1b = await publicClient.readContract({
              address: VOTING_CONTRACT_ADDRESS,
              abi: VOTING_WORKSHOP_ABI,
              functionName: "hasUserVoted",
              args: [BigInt(vote1bConfig.electionId), walletAddress as `0x${string}`],
            });
            
            setHasVoted1b(voted1b);
            
            // Fetch initial status for vote 1b (with auto-collapse on load)
            await fetchElectionStatus1b(true);
          }
          
          // Check if user has voted in vote 2a (public)
          if (vote2aConfig) {
            const voted2a = await publicClient.readContract({
              address: VOTING_CONTRACT_ADDRESS,
              abi: VOTING_WORKSHOP_ABI,
              functionName: "hasUserVoted",
              args: [BigInt(vote2aConfig.electionId), walletAddress as `0x${string}`],
            });
            
            setHasVoted2a(voted2a);
            
            if (voted2a) {
              const choice = await publicClient.readContract({
                address: VOTING_CONTRACT_ADDRESS,
                abi: publicVotesABI,
                functionName: "publicVotes",
                args: [BigInt(vote2aConfig.electionId), id],
              });
              setUserVote2a(Number(choice));
            }
            
            await fetchElectionResults2a(true);
          }
          
          // Check if user has voted in vote 2b (public)
          if (vote2bConfig) {
            const voted2b = await publicClient.readContract({
              address: VOTING_CONTRACT_ADDRESS,
              abi: VOTING_WORKSHOP_ABI,
              functionName: "hasUserVoted",
              args: [BigInt(vote2bConfig.electionId), walletAddress as `0x${string}`],
            });
            
            setHasVoted2b(voted2b);
            
            if (voted2b) {
              const choice = await publicClient.readContract({
                address: VOTING_CONTRACT_ADDRESS,
                abi: publicVotesABI,
                functionName: "publicVotes",
                args: [BigInt(vote2bConfig.electionId), id],
              });
              setUserVote2b(Number(choice));
            }
            
            await fetchElectionResults2b(true);
          }
          
          // Check if user has voted in vote 2c (private)
          if (vote2cConfig) {
            const voted2c = await publicClient.readContract({
              address: VOTING_CONTRACT_ADDRESS,
              abi: VOTING_WORKSHOP_ABI,
              functionName: "hasUserVoted",
              args: [BigInt(vote2cConfig.electionId), walletAddress as `0x${string}`],
            });
            
            setHasVoted2c(voted2c);
            await fetchElectionStatus2c(true);
          }
          
          // Check if user has voted in vote 2d (private)
          if (vote2dConfig) {
            const voted2d = await publicClient.readContract({
              address: VOTING_CONTRACT_ADDRESS,
              abi: VOTING_WORKSHOP_ABI,
              functionName: "hasUserVoted",
              args: [BigInt(vote2dConfig.electionId), walletAddress as `0x${string}`],
            });
            
            setHasVoted2d(voted2d);
            await fetchElectionStatus2d(true);
          }
          
          // Check if user has voted in vote 3 (public)
          if (vote3Config) {
            const voted3 = await publicClient.readContract({
              address: VOTING_CONTRACT_ADDRESS,
              abi: VOTING_WORKSHOP_ABI,
              functionName: "hasUserVoted",
              args: [BigInt(vote3Config.electionId), walletAddress as `0x${string}`],
            });
            
            setHasVoted3(voted3);
            
            if (voted3) {
              const choice = await publicClient.readContract({
                address: VOTING_CONTRACT_ADDRESS,
                abi: publicVotesABI,
                functionName: "publicVotes",
                args: [BigInt(vote3Config.electionId), id],
              });
              setUserVote3(Number(choice));
            }
            
            await fetchElectionResults3(true);
          }
          
          setLoading(false);
        }
      } catch (error) {
        console.error("Error checking registration:", error);
        router.push("/");
      }
    }

    checkRegistrationAndVotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authenticated, user, router, vote0Config, vote1aConfig, vote1bConfig, vote2aConfig, vote2bConfig, vote2cConfig, vote2dConfig, vote3Config]);

  // Auto-refresh results for Vote 0 every 5 seconds (only when Open)
  useEffect(() => {
    if (!vote0Config || !task1Complete || electionStatus0 !== "Open") return;

    const intervalId = setInterval(() => {
      fetchElectionResults0();
    }, 5000);

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vote0Config, task1Complete, electionStatus0]);

  // Auto-refresh results for Vote 1a every 5 seconds (only when Open)
  useEffect(() => {
    if (!vote1aConfig || !task1Complete || !hasVoted0 || electionStatus1a !== "Open") return;

    const intervalId = setInterval(() => {
      fetchElectionResults1a();
    }, 5000);

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vote1aConfig, task1Complete, hasVoted0, electionStatus1a]);

  // Check if Vote 1b election closed (stop checking once closed)
  useEffect(() => {
    if (!vote1bConfig || !task1Complete || !hasVoted1a || electionStatus1b === "Closed") return;

    const intervalId = setInterval(() => {
      fetchElectionStatus1b();
    }, 5000);

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vote1bConfig, task1Complete, hasVoted1a, electionStatus1b]);

  // Auto-refresh results for Vote 2a every 5 seconds (only when Open)
  useEffect(() => {
    if (!vote2aConfig || !task1Complete || !hasVoted1b || electionStatus2a !== "Open") return;

    const intervalId = setInterval(() => {
      fetchElectionResults2a();
    }, 5000);

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vote2aConfig, task1Complete, hasVoted1b, electionStatus2a]);

  // Auto-refresh results for Vote 2b every 5 seconds (only when Open)
  useEffect(() => {
    if (!vote2bConfig || !task1Complete || !hasVoted2a || electionStatus2b !== "Open") return;

    const intervalId = setInterval(() => {
      fetchElectionResults2b();
    }, 5000);

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vote2bConfig, task1Complete, hasVoted2a, electionStatus2b]);

  // Check if Vote 2c election closed (stop checking once closed)
  useEffect(() => {
    if (!vote2cConfig || !task1Complete || !hasVoted2b || electionStatus2c === "Closed") return;

    const intervalId = setInterval(() => {
      fetchElectionStatus2c();
    }, 5000);

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vote2cConfig, task1Complete, hasVoted2b, electionStatus2c]);

  // Check if Vote 2d election closed (stop checking once closed)
  useEffect(() => {
    if (!vote2dConfig || !task1Complete || !hasVoted2c || electionStatus2d === "Closed") return;

    const intervalId = setInterval(() => {
      fetchElectionStatus2d();
    }, 5000);

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vote2dConfig, task1Complete, hasVoted2c, electionStatus2d]);

  // Auto-refresh results for Vote 3 every 5 seconds (only when Open)
  useEffect(() => {
    if (!vote3Config || !task1Complete || !hasVoted2d || electionStatus3 !== "Open") return;

    const intervalId = setInterval(() => {
      fetchElectionResults3();
    }, 5000);

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vote3Config, task1Complete, hasVoted2d, electionStatus3]);

  const handleRefreshResults0 = async () => {
    setIsRefreshingResults0(true);
    await fetchElectionResults0();
    setTimeout(() => setIsRefreshingResults0(false), 300);
  };

  const handleRefreshResults1a = async () => {
    setIsRefreshingResults1a(true);
    await fetchElectionResults1a();
    setTimeout(() => setIsRefreshingResults1a(false), 300);
  };

  const handleRefreshResults2a = async () => {
    setIsRefreshingResults2a(true);
    await fetchElectionResults2a();
    setTimeout(() => setIsRefreshingResults2a(false), 300);
  };

  const handleRefreshResults2b = async () => {
    setIsRefreshingResults2b(true);
    await fetchElectionResults2b();
    setTimeout(() => setIsRefreshingResults2b(false), 300);
  };

  const handleRefreshResults3 = async () => {
    setIsRefreshingResults3(true);
    await fetchElectionResults3();
    setTimeout(() => setIsRefreshingResults3(false), 300);
  };

  const handleVoteSubmit0 = async () => {
    if (selectedOption0 === null || !vote0Config) {
      showErrorToast("Please select an option");
      return;
    }

    setIsSubmitting0(true);

    try {
      const data = encodeFunctionData({
        abi: VOTING_WORKSHOP_ABI,
        functionName: "castPublicVote",
        args: [BigInt(vote0Config.electionId), BigInt(selectedOption0)],
      });

      await sendTransaction({
        to: VOTING_CONTRACT_ADDRESS,
        data: data,
        value: BigInt(0),
      });

      showSuccessToast("Vote submitted successfully!");
      setHasVoted0(true);
      setUserVote0(selectedOption0);
      
      setTimeout(() => fetchElectionResults0(), 1500);
    } catch (error: any) {
      console.error("Vote submission error:", error);
      showErrorToast(error?.message || "Failed to submit vote. Please try again.");
    } finally {
      setIsSubmitting0(false);
    }
  };

  const handleVoteSubmit1a = async () => {
    if (selectedOption1a === null || !vote1aConfig) {
      showErrorToast("Please select an option");
      return;
    }

    setIsSubmitting1a(true);

    try {
      const data = encodeFunctionData({
        abi: VOTING_WORKSHOP_ABI,
        functionName: "castPublicVote",
        args: [BigInt(vote1aConfig.electionId), BigInt(selectedOption1a)],
      });

      await sendTransaction({
        to: VOTING_CONTRACT_ADDRESS,
        data: data,
        value: BigInt(0),
      });

      showSuccessToast("Vote submitted successfully!");
      setHasVoted1a(true);
      setUserVote1a(selectedOption1a);
      
      setTimeout(() => fetchElectionResults1a(), 1500);
    } catch (error: any) {
      console.error("Vote submission error:", error);
      showErrorToast(error?.message || "Failed to submit vote. Please try again.");
    } finally {
      setIsSubmitting1a(false);
    }
  };

  const handleVoteSubmit1b = async () => {
    if (selectedOption1b === null) {
      showErrorToast("Please select an option");
      return;
    }

    try {
      await submitVote1b(selectedOption1b);
      // Success handling is done in the hook's onSuccess callback
    } catch (error: any) {
      // Error handling is done in the hook's onError callback
      console.error("Private vote submission error:", error);
    }
  };

  const handleVoteSubmit2a = async () => {
    if (selectedOption2a === null || !vote2aConfig) {
      showErrorToast("Please select an option");
      return;
    }

    setIsSubmitting2a(true);

    try {
      const data = encodeFunctionData({
        abi: VOTING_WORKSHOP_ABI,
        functionName: "castPublicVote",
        args: [BigInt(vote2aConfig.electionId), BigInt(selectedOption2a)],
      });

      await sendTransaction({
        to: VOTING_CONTRACT_ADDRESS,
        data: data,
        value: BigInt(0),
      });

      showSuccessToast("Vote submitted successfully!");
      setHasVoted2a(true);
      setUserVote2a(selectedOption2a);
      
      setTimeout(() => fetchElectionResults2a(), 1500);
    } catch (error: any) {
      console.error("Vote submission error:", error);
      showErrorToast(error?.message || "Failed to submit vote. Please try again.");
    } finally {
      setIsSubmitting2a(false);
    }
  };

  const handleVoteSubmit2b = async () => {
    if (selectedOption2b === null || !vote2bConfig) {
      showErrorToast("Please select an option");
      return;
    }

    setIsSubmitting2b(true);

    try {
      const data = encodeFunctionData({
        abi: VOTING_WORKSHOP_ABI,
        functionName: "castPublicVote",
        args: [BigInt(vote2bConfig.electionId), BigInt(selectedOption2b)],
      });

      await sendTransaction({
        to: VOTING_CONTRACT_ADDRESS,
        data: data,
        value: BigInt(0),
      });

      showSuccessToast("Vote submitted successfully!");
      setHasVoted2b(true);
      setUserVote2b(selectedOption2b);
      
      setTimeout(() => fetchElectionResults2b(), 1500);
    } catch (error: any) {
      console.error("Vote submission error:", error);
      showErrorToast(error?.message || "Failed to submit vote. Please try again.");
    } finally {
      setIsSubmitting2b(false);
    }
  };

  const handleVoteSubmit2c = async () => {
    if (selectedOption2c === null) {
      showErrorToast("Please select an option");
      return;
    }

    try {
      await submitVote2c(selectedOption2c);
    } catch (error: any) {
      console.error("Private vote submission error:", error);
    }
  };

  const handleVoteSubmit2d = async () => {
    if (selectedOption2d === null) {
      showErrorToast("Please select an option");
      return;
    }

    try {
      await submitVote2d(selectedOption2d);
    } catch (error: any) {
      console.error("Private vote submission error:", error);
    }
  };

  const handleVoteSubmit3 = async () => {
    if (selectedOption3 === null || !vote3Config) {
      showErrorToast("Please select an option");
      return;
    }

    setIsSubmitting3(true);

    try {
      const data = encodeFunctionData({
        abi: VOTING_WORKSHOP_ABI,
        functionName: "castPublicVote",
        args: [BigInt(vote3Config.electionId), BigInt(selectedOption3)],
      });

      await sendTransaction({
        to: VOTING_CONTRACT_ADDRESS,
        data: data,
        value: BigInt(0),
      });

      showSuccessToast("Vote submitted successfully!");
      setHasVoted3(true);
      setUserVote3(selectedOption3);
      
      setTimeout(() => fetchElectionResults3(), 1500);
    } catch (error: any) {
      console.error("Vote submission error:", error);
      showErrorToast(error?.message || "Failed to submit vote. Please try again.");
    } finally {
      setIsSubmitting3(false);
    }
  };

  const handleOpenVoterList = async () => {
    if (allVoters.length === 0) {
      await fetchAllVoters();
    }
    setShowVoterListModal(true);
  };

  // Helper function to get committee prefix
  const getCommitteePrefix = (committee: string): string => {
    if (committee === "Marketing") return "M";
    if (committee === "Operations") return "O";
    if (committee === "Community") return "C";
    return "";
  };

  // Helper function to get voter info including committee by voter ID
  const getVoterInfo = (voterId: number) => {
    const voter = allVoters.find((v) => v.id === voterId);
    if (voter) {
      return {
        prefix: getCommitteePrefix(voter.committee),
        display: `${getCommitteePrefix(voter.committee)}: #${voterId}`,
      };
    }
    return { prefix: "", display: `#${voterId}` };
  };

  if (!ready || loading) {
    return <FullScreenLoader />;
  }

  if (!authenticated) {
    router.push("/");
    return <FullScreenLoader />;
  }

  if (isSubmitting0 || isSubmitting1a || isSubmitting1b || isSubmitting2a || isSubmitting2b || isSubmitting2c || isSubmitting2d || isSubmitting3) {
    return <FullScreenLoader message="Submitting your vote..." />;
  }

  if (!vote0Config) {
    return <div className="p-8 text-center">Error: Vote configuration not found</div>;
  }

  return (
    <div className="bg-gray-100 min-h-screen">
      <Header />
      <main className="px-6 py-8 min-h-[calc(100vh-60px)]">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header with Participant ID Badge */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
                Voting Booth
              </h1>
              <p className="text-gray-600 mt-1">Complete each task as instructed</p>
            </div>
            <div className="flex items-center gap-3 bg-white/80 backdrop-blur-sm px-6 py-3 rounded-full border-2 border-gray-900 shadow-sm">
              <span className="text-sm font-medium text-gray-600">Your ID:</span>
              <span className="text-2xl font-bold text-gray-900">#{userId}</span>
            </div>
          </div>

          {/* Task 1: Registration Confirmation */}
          <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden shadow-sm">
            <div className="flex items-center gap-4 px-6 py-4 bg-gray-50 border-b-2 border-gray-200">
              {task1Complete ? (
                <CheckCircleIcon className="w-7 h-7 text-green-600" />
              ) : (
                <div className="w-7 h-7 rounded-full border-2 border-gray-400 flex items-center justify-center bg-white">
                  <span className="text-sm font-bold text-gray-600">1</span>
                </div>
              )}
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900">
                  ID Display
                </h2>
                {task1Complete && (
                  <p className="text-sm text-green-600 font-medium">Completed</p>
                )}
              </div>
              <button
                onClick={() => setTask1Collapsed(!task1Collapsed)}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                {task1Collapsed ? "Expand" : "Collapse"}
              </button>
            </div>

            {!task1Collapsed && (
              <div className="p-8 space-y-6">
                <div className="text-center space-y-4">
                  <p className="text-2xl font-bold text-gray-900">
                    🎉 You are now registered in the workshop!
                  </p>
                  <p className="text-lg text-gray-700">
                    Your Participant ID is <span className="font-bold text-gray-900">#{userId}</span>
                  </p>
                </div>

                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 space-y-3">
                  <p className="font-semibold text-gray-900 flex items-start gap-2">
                    <span className="text-blue-600 text-xl">📝</span>
                    <span>Important Instructions:</span>
                  </p>
                  <ul className="space-y-2 text-gray-700 ml-8">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 font-bold">•</span>
                      <span>Write your Participant ID <strong>#{userId}</strong> on a piece of paper or name tag</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 font-bold">•</span>
                      <span>Display it visibly so other participants can see it</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 font-bold">•</span>
                      <span>Keep your ID visible throughout the entire workshop</span>
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Task 2: Vote 0 - Training Ground */}
          <div className={`bg-white rounded-2xl border-2 overflow-hidden shadow-sm transition-all duration-300 ${
            task1Complete ? "border-gray-200" : "border-gray-100 opacity-50"
          }`}>
            <div className="flex items-center gap-4 px-6 py-4 bg-gray-50 border-b-2 border-gray-200">
              {hasVoted0 ? (
                <CheckCircleIcon className="w-7 h-7 text-green-600" />
              ) : (
                <div className="w-7 h-7 rounded-full border-2 border-gray-400 flex items-center justify-center bg-white">
                  <span className="text-sm font-bold text-gray-600">2</span>
                </div>
              )}
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900">
                  {vote0Config.title}
                </h2>
                {!task1Complete && (
                  <p className="text-sm text-gray-500">Complete previous task to unlock</p>
                )}
                {hasVoted0 && electionStatus0 === "Open" && (
                  <p className="text-sm text-green-600 font-medium">Voted</p>
                )}
                {electionStatus0 === "Closed" && (
                  <p className="text-sm text-blue-600 font-medium">Closed</p>
                )}
                {electionStatus0 === null && task1Complete && (
                  <p className="text-sm text-amber-600 font-medium">Waiting to open...</p>
                )}
              </div>
              {task1Complete && (
                <button
                  onClick={() => setVote0Collapsed(!vote0Collapsed)}
                  className="text-sm text-gray-500 hover:text-gray-700 underline"
                >
                  {vote0Collapsed ? "Expand" : "Collapse"}
                </button>
              )}
            </div>

{task1Complete && !vote0Collapsed && (
              <div className="p-8 space-y-6">
                {vote0Config.isPractice && (
                  <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4">
                    <p className="text-sm text-yellow-800 font-medium">
                      🎯 Practice Vote — No points or consequences
                    </p>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <p className="text-lg font-bold text-gray-900 mb-2">
                      {vote0Config.question}
                    </p>
                    {vote0Config.context && (
                      <p className="text-gray-600">
                        {vote0Config.context}
                      </p>
                    )}
                  </div>

                  {/* Waiting for Election to Open */}
                  {electionStatus0 === null && (
                    <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-6 text-center">
                      <p className="text-lg font-semibold text-amber-900 mb-2">
                        ⏳ Waiting for Vote to Open
                      </p>
                      <p className="text-sm text-amber-700">
                        The organizer will open this vote when ready. Please wait.
                      </p>
                    </div>
                  )}

                  {/* Voting Section - Only shown if not voted and election is open */}
                  {!hasVoted0 && electionStatus0 === "Open" && (
                    <>
                      <div className="pt-2">
                        <p className="text-sm font-semibold text-gray-700 mb-3">Cast Your Vote:</p>
                        <div className="space-y-3">
                          {vote0Config.options.map((option) => (
                            <button
                              key={option.id}
                              onClick={() => setSelectedOption0(option.id)}
                              className={`w-full text-left px-6 py-4 border-2 rounded-xl transition-all duration-200 font-medium ${
                                selectedOption0 === option.id
                                  ? "border-gray-900 bg-gray-900 text-white"
                                  : "border-gray-200 bg-gray-50 text-gray-900 hover:border-gray-400 hover:bg-white"
                              }`}
                            >
                              {option.text}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={handleVoteSubmit0}
                        disabled={selectedOption0 === null || isSubmitting0}
                        className="w-full bg-gray-900 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:bg-gray-800 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting0 ? "Submitting..." : "Submit Vote"}
                      </button>
                    </>
                  )}

                  {/* Vote Confirmation - Shown after voting */}
                  {hasVoted0 && (
                    <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                      <p className="text-sm font-semibold text-green-800">
                        ✓ You voted for: <span className="font-bold">{vote0Config.options.find(o => o.id === userVote0)?.text}</span>
                      </p>
                    </div>
                  )}

                  {/* Results Section - Only visible when election has been opened */}
                  {electionStatus0 !== null && (
                  <div className="border-t-2 border-gray-200 pt-6 mt-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">
                          {electionStatus0 === "Closed" ? "Final Results" : "Live Results"}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {totalVotes0} {totalVotes0 === 1 ? "vote" : "votes"} cast
                          {electionStatus0 === "Closed" && " • Voting closed"}
                        </p>
                      </div>
                      <button
                        onClick={handleRefreshResults0}
                        disabled={isRefreshingResults0}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 border-2 border-gray-300 rounded-lg text-sm font-medium text-gray-700 transition-all disabled:opacity-50"
                        title="Refresh results"
                      >
                        <svg 
                          className={`w-4 h-4 ${isRefreshingResults0 ? 'animate-spin' : ''}`} 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                      </button>
                    </div>

                    {electionStatus0 === "Closed" && (
                      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-3 mb-4">
                        <p className="text-sm text-blue-800 font-medium text-center">
                          🏁 These results are final
                        </p>
                      </div>
                    )}

                    <div className="space-y-3">
                      {vote0Config.options.map((option, index) => {
                        const voteCount = voteCounts0[index] || 0;
                        const percentage = totalVotes0 > 0 ? (voteCount / totalVotes0) * 100 : 0;
                        const isWinner = electionStatus0 === "Closed" && voteCount > 0 && voteCount === Math.max(...voteCounts0);
                        const isUserChoice = hasVoted0 && option.id === userVote0;
                        const voters = votersByChoice0[option.id] || [];

                        return (
                          <div
                            key={option.id}
                            className={`rounded-xl border-2 transition-all overflow-hidden ${
                              isWinner
                                ? "border-green-400 bg-green-50"
                                : isUserChoice
                                ? "border-blue-300 bg-blue-50"
                                : "border-gray-200 bg-white"
                            }`}
                          >
                            <div className="relative overflow-hidden">
                              {/* Progress bar background */}
                              <div 
                                className={`absolute inset-0 transition-all duration-500 ${
                                  isWinner
                                    ? "bg-green-100"
                                    : isUserChoice
                                    ? "bg-blue-100"
                                    : "bg-gray-100"
                                }`}
                                style={{ width: `${percentage}%` }}
                              />
                              
                              {/* Content */}
                              <div className="relative px-4 py-3 flex items-center justify-between">
                                <div className="flex-1 pr-4">
                                  <div className="flex items-center gap-2">
                                    {isWinner && (
                                      <span className="text-lg">🏆</span>
                                    )}
                                    {isUserChoice && !isWinner && (
                                      <span className="text-blue-600 font-bold">→</span>
                                    )}
                                    <p className={`font-medium ${
                                      isWinner ? "text-green-900 font-bold" : "text-gray-900"
                                    }`}>
                                      {option.text}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="text-right">
                                    <p className={`text-2xl font-bold ${
                                      isWinner ? "text-green-700" : "text-gray-900"
                                    }`}>
                                      {percentage.toFixed(1)}%
                                    </p>
                                    <p className="text-xs text-gray-600">
                                      {voteCount} {voteCount === 1 ? "vote" : "votes"}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Voter IDs List */}
                            {voters.length > 0 && (
                              <div className={`px-4 py-2 border-t ${
                                isWinner
                                  ? "border-green-200 bg-green-50"
                                  : isUserChoice
                                  ? "border-blue-200 bg-blue-50"
                                  : "border-gray-200 bg-gray-50"
                              }`}>
                                <p className="text-xs text-gray-600 mb-1">Voters:</p>
                                <div className="flex flex-wrap gap-1">
                                  {voters.map((voterId) => (
                                    <span
                                      key={voterId}
                                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                        voterId === Number(userId)
                                          ? "bg-blue-200 text-blue-800"
                                          : "bg-gray-200 text-gray-700"
                                      }`}
                                    >
                                      #{voterId}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Task 3: Vote 1a - Coordination */}
          {vote1aConfig && (
            <div className={`bg-white rounded-2xl border-2 overflow-hidden shadow-sm transition-all duration-300 ${
              hasVoted0 ? "border-gray-200" : "border-gray-100 opacity-50"
            }`}>
              <div className="flex items-center gap-4 px-6 py-4 bg-gray-50 border-b-2 border-gray-200">
                {hasVoted1a ? (
                  <CheckCircleIcon className="w-7 h-7 text-green-600" />
                ) : (
                  <div className="w-7 h-7 rounded-full border-2 border-gray-400 flex items-center justify-center bg-white">
                    <span className="text-sm font-bold text-gray-600">3</span>
                  </div>
                )}
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-900">
                    {vote1aConfig.title}
                  </h2>
                  {!hasVoted0 && (
                    <p className="text-sm text-gray-500">Complete previous task to unlock</p>
                  )}
                  {hasVoted1a && electionStatus1a === "Open" && (
                    <p className="text-sm text-green-600 font-medium">Voted</p>
                  )}
                  {electionStatus1a === "Closed" && (
                    <p className="text-sm text-blue-600 font-medium">Closed</p>
                  )}
                  {electionStatus1a === null && hasVoted0 && (
                    <p className="text-sm text-amber-600 font-medium">Waiting to open...</p>
                  )}
                </div>
                {hasVoted0 && (
                  <button
                    onClick={() => setVote1aCollapsed(!vote1aCollapsed)}
                    className="text-sm text-gray-500 hover:text-gray-700 underline"
                  >
                    {vote1aCollapsed ? "Expand" : "Collapse"}
                  </button>
                )}
              </div>

              {hasVoted0 && !vote1aCollapsed && (
                <div className="p-8 space-y-6">
                  {/* District Assignment Banner */}
                  {assignedDistrict && (
                    <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                      <p className="text-sm font-semibold text-blue-900 text-center">
                        📍 You live in: <span className="text-lg font-bold">District {assignedDistrict}</span>
                      </p>
                      <p className="text-xs text-blue-700 text-center mt-1">
                        You&apos;ll benefit if funds are allocated to your district
                      </p>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <p className="text-base text-gray-700 mb-3 leading-relaxed whitespace-pre-line">
                        {vote1aConfig.context}
                      </p>
                      <p className="text-lg font-bold text-gray-900 mt-4">
                        {vote1aConfig.question}
                      </p>
                    </div>

                    {/* Waiting for Election to Open */}
                    {electionStatus1a === null && (
                      <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-6 text-center">
                        <p className="text-lg font-semibold text-amber-900 mb-2">
                          ⏳ Waiting for Vote to Open
                        </p>
                        <p className="text-sm text-amber-700">
                          The organizer will open this vote when ready. Please wait.
                        </p>
                      </div>
                    )}

                    {/* Voting Section */}
                    {!hasVoted1a && electionStatus1a === "Open" && (
                      <>
                        <div className="pt-2">
                          <p className="text-sm font-semibold text-gray-700 mb-3">Cast Your Vote:</p>
                          <div className="space-y-3">
                            {vote1aConfig.options.map((option) => {
                              const isHomeDistrict = assignedDistrict && option.text.includes(assignedDistrict);
                              return (
                                <button
                                  key={option.id}
                                  onClick={() => setSelectedOption1a(option.id)}
                                  className={`w-full text-left px-6 py-4 border-2 rounded-xl transition-all duration-200 font-medium relative ${
                                    selectedOption1a === option.id
                                      ? "border-gray-900 bg-gray-900 text-white"
                                      : isHomeDistrict
                                      ? "border-blue-300 bg-blue-50 text-gray-900 hover:border-blue-400"
                                      : "border-gray-200 bg-gray-50 text-gray-900 hover:border-gray-400 hover:bg-white"
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span>{option.text}</span>
                                    {isHomeDistrict && selectedOption1a !== option.id && (
                                      <span className="text-xs text-blue-600 font-semibold">🏠 Your District</span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <button
                          onClick={handleVoteSubmit1a}
                          disabled={selectedOption1a === null || isSubmitting1a}
                          className="w-full bg-gray-900 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:bg-gray-800 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSubmitting1a ? "Submitting..." : "Submit Vote"}
                        </button>
                      </>
                    )}

                    {/* Vote Confirmation */}
                    {hasVoted1a && (
                      <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                        <p className="text-sm font-semibold text-green-800">
                          ✓ You voted for: <span className="font-bold">{vote1aConfig.options.find(o => o.id === userVote1a)?.text}</span>
                        </p>
                      </div>
                    )}

                    {/* Results Section with 60% Threshold - Only visible when election has been opened */}
                    {electionStatus1a !== null && (
                    <div className="border-t-2 border-gray-200 pt-6 mt-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">
                            {electionStatus1a === "Closed" ? "Final Results" : "Live Results"}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {totalVotes1a} {totalVotes1a === 1 ? "vote" : "votes"} cast
                            {electionStatus1a === "Closed" && " • Voting closed"}
                          </p>
                        </div>
                        <button
                          onClick={handleRefreshResults1a}
                          disabled={isRefreshingResults1a}
                          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 border-2 border-gray-300 rounded-lg text-sm font-medium text-gray-700 transition-all disabled:opacity-50"
                          title="Refresh results"
                        >
                          <svg 
                            className={`w-4 h-4 ${isRefreshingResults1a ? 'animate-spin' : ''}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Refresh
                        </button>
                      </div>

                      {/* 60% Threshold Alert */}
                      {vote1aConfig.coordinationThreshold && voteCounts1a.some((count, index) => {
                        const percentage = totalVotes1a > 0 ? (count / totalVotes1a) : 0;
                        return percentage >= vote1aConfig.coordinationThreshold!;
                      }) && (
                        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 mb-4">
                          <p className="text-sm text-amber-900 font-bold text-center">
                            🎓 60% Threshold Reached! A programming school will be opened!
                          </p>
                        </div>
                      )}

                      {electionStatus1a === "Closed" && (
                        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-3 mb-4">
                          <p className="text-sm text-blue-800 font-medium text-center">
                            🏁 These results are final
                          </p>
                        </div>
                      )}

                      <div className="space-y-3">
                        {vote1aConfig.options.map((option, index) => {
                          const voteCount = voteCounts1a[index] || 0;
                          const percentage = totalVotes1a > 0 ? (voteCount / totalVotes1a) * 100 : 0;
                          const isWinner = electionStatus1a === "Closed" && voteCount > 0 && voteCount === Math.max(...voteCounts1a);
                          const isUserChoice = hasVoted1a && option.id === userVote1a;
                          const isHomeDistrict = assignedDistrict && option.text.includes(assignedDistrict);
                          const passedThreshold = vote1aConfig.coordinationThreshold && percentage >= (vote1aConfig.coordinationThreshold * 100);
                          const voters = votersByChoice1a[option.id] || [];

                          return (
                            <div key={option.id} className="relative">
                              <div
                                className={`rounded-xl border-2 transition-all overflow-hidden ${
                                  isWinner
                                    ? "border-green-400 bg-green-50"
                                    : passedThreshold
                                    ? "border-amber-400 bg-amber-50"
                                    : isUserChoice
                                    ? "border-blue-300 bg-blue-50"
                                    : "border-gray-200 bg-white"
                                }`}
                              >
                                <div className="relative overflow-hidden">
                                  {/* 60% Threshold Line */}
                                  {vote1aConfig.coordinationThreshold && (
                                    <div 
                                      className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-10"
                                      style={{ left: `${vote1aConfig.coordinationThreshold * 100}%` }}
                                      title="60% threshold"
                                    />
                                  )}

                                  {/* Progress bar */}
                                  <div 
                                    className={`absolute inset-0 transition-all duration-500 ${
                                      isWinner
                                        ? "bg-green-100"
                                        : passedThreshold
                                        ? "bg-amber-100"
                                        : isUserChoice
                                        ? "bg-blue-100"
                                        : "bg-gray-100"
                                    }`}
                                    style={{ width: `${percentage}%` }}
                                  />
                                  
                                  {/* Content */}
                                  <div className="relative px-4 py-3 flex items-center justify-between">
                                    <div className="flex-1 pr-4">
                                      <div className="flex items-center gap-2">
                                        {isWinner && <span className="text-lg">🏆</span>}
                                        {passedThreshold && !isWinner && <span className="text-lg">🎓</span>}
                                        {isUserChoice && !isWinner && !passedThreshold && (
                                          <span className="text-blue-600 font-bold">→</span>
                                        )}
                                        {isHomeDistrict && !isUserChoice && !passedThreshold && (
                                          <span className="text-sm">🏠</span>
                                        )}
                                        <p className={`font-medium ${
                                          isWinner || passedThreshold ? "font-bold" : ""
                                        }`}>
                                          {option.text}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <div className="text-right">
                                        <p className={`text-2xl font-bold ${
                                          isWinner ? "text-green-700" : passedThreshold ? "text-amber-700" : "text-gray-900"
                                        }`}>
                                          {percentage.toFixed(1)}%
                                        </p>
                                        <p className="text-xs text-gray-600">
                                          {voteCount} {voteCount === 1 ? "vote" : "votes"}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Voter IDs List */}
                                {voters.length > 0 && (
                                  <div className={`px-4 py-2 border-t ${
                                    isWinner
                                      ? "border-green-200 bg-green-50"
                                      : passedThreshold
                                      ? "border-amber-200 bg-amber-50"
                                      : isUserChoice
                                      ? "border-blue-200 bg-blue-50"
                                      : "border-gray-200 bg-gray-50"
                                  }`}>
                                    <p className="text-xs text-gray-600 mb-1">Voters:</p>
                                    <div className="flex flex-wrap gap-1">
                                      {voters.map((voterId) => (
                                        <span
                                          key={voterId}
                                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                            voterId === Number(userId)
                                              ? "bg-blue-200 text-blue-800"
                                              : "bg-gray-200 text-gray-700"
                                          }`}
                                        >
                                          #{voterId}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Task 4: Vote 1b - Private Coordination */}
          {vote1bConfig && (
            <div className={`bg-white rounded-2xl border-2 overflow-hidden shadow-sm transition-all duration-300 ${
              hasVoted1a ? "border-gray-200" : "border-gray-100 opacity-50"
            }`}>
              <div className="flex items-center gap-4 px-6 py-4 bg-gray-50 border-b-2 border-gray-200">
                {hasVoted1b ? (
                  <CheckCircleIcon className="w-7 h-7 text-green-600" />
                ) : (
                  <div className="w-7 h-7 rounded-full border-2 border-gray-400 flex items-center justify-center bg-white">
                    <span className="text-sm font-bold text-gray-600">4</span>
                  </div>
                )}
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-900">
                    {vote1bConfig.title}
                  </h2>
                  {!hasVoted1a && (
                    <p className="text-sm text-gray-500">Complete previous task to unlock</p>
                  )}
                  {hasVoted1b && electionStatus1b === "Open" && (
                    <p className="text-sm text-green-600 font-medium">Voted</p>
                  )}
                  {electionStatus1b === "Closed" && (
                    <p className="text-sm text-blue-600 font-medium">Closed</p>
                  )}
                  {electionStatus1b === null && hasVoted1a && (
                    <p className="text-sm text-amber-600 font-medium">Waiting to open...</p>
                  )}
                </div>
                {hasVoted1a && (
                  <button
                    onClick={() => setVote1bCollapsed(!vote1bCollapsed)}
                    className="text-sm text-gray-500 hover:text-gray-700 underline"
                  >
                    {vote1bCollapsed ? "Expand" : "Collapse"}
                  </button>
                )}
              </div>

              {hasVoted1a && !vote1bCollapsed && (
                <div className="p-8 space-y-6">
                  {/* District Assignment Banner for Vote 1b */}
                  {assignedDistrict1b && (
                    <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-4">
                      <p className="text-sm font-semibold text-indigo-900 text-center">
                        📍 You have moved to: <span className="text-lg font-bold">District {assignedDistrict1b}</span>
                      </p>
                      <p className="text-xs text-indigo-700 text-center mt-1">
                        You&apos;ll benefit if funds are allocated to your new district
                      </p>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <p className="text-base text-gray-700 mb-3 leading-relaxed whitespace-pre-line">
                        {vote1bConfig.context}
                      </p>
                      <p className="text-lg font-bold text-gray-900 mt-4">
                        {vote1bConfig.question}
                      </p>
                    </div>

                    {/* Waiting for Election to Open */}
                    {electionStatus1b === null && (
                      <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-6 text-center">
                        <p className="text-lg font-semibold text-amber-900 mb-2">
                          ⏳ Waiting for Vote to Open
                        </p>
                        <p className="text-sm text-amber-700">
                          The organizer will open this vote when ready. Please wait.
                        </p>
                      </div>
                    )}

                    {/* Voting Section */}
                    {!hasVoted1b && electionStatus1b === "Open" && (
                      <>
                        <div className="pt-2">
                          <p className="text-sm font-semibold text-gray-700 mb-3">Cast Your Private Vote:</p>
                          <div className="space-y-3">
                            {vote1bConfig.options.map((option) => {
                              const isHomeDistrict = assignedDistrict1b && option.text.includes(assignedDistrict1b);
                              return (
                                <button
                                  key={option.id}
                                  onClick={() => setSelectedOption1b(option.id)}
                                  className={`w-full text-left px-6 py-4 border-2 rounded-xl transition-all duration-200 font-medium relative ${
                                    selectedOption1b === option.id
                                      ? "border-gray-900 bg-gray-900 text-white"
                                      : isHomeDistrict
                                      ? "border-indigo-300 bg-indigo-50 text-gray-900 hover:border-indigo-400"
                                      : "border-gray-200 bg-gray-50 text-gray-900 hover:border-gray-400 hover:bg-white"
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span>{option.text}</span>
                                    {isHomeDistrict && selectedOption1b !== option.id && (
                                      <span className="text-xs text-indigo-600 font-semibold">🏠 Your New District</span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <button
                          onClick={handleVoteSubmit1b}
                          disabled={selectedOption1b === null || isSubmitting1b}
                          className="w-full bg-gray-900 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:bg-gray-800 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSubmitting1b ? "Encrypting and submitting..." : "Submit Private Vote"}
                        </button>

                        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                          <p className="text-xs text-blue-800">
                            <strong>How it works:</strong> You&apos;ll be asked to sign a message with your wallet. 
                            This signature will be encrypted and submitted to the blockchain. Only the organizer can decrypt and tally the votes to present the final results. Individual votes remain secret.
                          </p>
                        </div>
                      </>
                    )}

                    {/* Vote Confirmation */}
                    {hasVoted1b && (
                      <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                        <p className="text-sm font-semibold text-green-800 text-center">
                          ✓ Your encrypted vote has been recorded on the blockchain
                        </p>
                        <p className="text-xs text-green-700 text-center mt-1">
                          The organizer will present the results after voting closes
                        </p>
                      </div>
                    )}

                    {/* Show status when voting is closed */}
                    {electionStatus1b === "Closed" && (
                      <div className="border-t-2 border-gray-200 pt-6 mt-6">
                        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                          <p className="text-sm text-blue-800 font-medium text-center">
                            🔐 Voting is closed. The organizer will present the results.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Task 5: Vote 2a - Reciprocity Round 1 (Public) */}
          {vote2aConfig && (
            <div className={`bg-white rounded-2xl border-2 overflow-hidden shadow-sm transition-all duration-300 ${
              hasVoted1b ? "border-gray-200" : "border-gray-100 opacity-50"
            }`}>
              <div className="flex items-center gap-4 px-6 py-4 bg-gray-50 border-b-2 border-gray-200">
                {hasVoted2a ? (
                  <CheckCircleIcon className="w-7 h-7 text-green-600" />
                ) : (
                  <div className="w-7 h-7 rounded-full border-2 border-gray-400 flex items-center justify-center bg-white">
                    <span className="text-sm font-bold text-gray-600">5</span>
                  </div>
                )}
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-900">
                    {vote2aConfig.title}
                  </h2>
                  {!hasVoted1b && (
                    <p className="text-sm text-gray-500">Complete previous task to unlock</p>
                  )}
                  {hasVoted2a && electionStatus2a === "Open" && (
                    <p className="text-sm text-green-600 font-medium">Voted</p>
                  )}
                  {electionStatus2a === "Closed" && (
                    <p className="text-sm text-blue-600 font-medium">Closed</p>
                  )}
                  {electionStatus2a === null && hasVoted1b && (
                    <p className="text-sm text-amber-600 font-medium">Waiting to open...</p>
                  )}
                </div>
                {hasVoted1b && (
                  <button
                    onClick={() => setVote2aCollapsed(!vote2aCollapsed)}
                    className="text-sm text-gray-500 hover:text-gray-700 underline"
                  >
                    {vote2aCollapsed ? "Expand" : "Collapse"}
                  </button>
                )}
              </div>

              {hasVoted1b && !vote2aCollapsed && (
                <div className="p-8 space-y-6">
                  {/* Committee Assignment Banner with View All button */}
                  {assignedCommittee && (
                    <div className="space-y-3">
                      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                        <p className="text-sm font-semibold text-blue-900 text-center">
                          👥 Your Committee: <span className="text-lg font-bold">{assignedCommittee}</span>
                        </p>
                        <p className="text-xs text-blue-700 text-center mt-1">
                          Initiative {assignedCommittee === "Marketing" ? "A" : assignedCommittee === "Operations" ? "B" : "C"} best serves your committee
                        </p>
                      </div>
                      <button
                        onClick={handleOpenVoterList}
                        className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 border-2 border-gray-300 rounded-lg text-sm font-medium text-gray-700 transition-all"
                      >
                        📋 View Committee Composition
                      </button>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <p className="text-base text-gray-700 mb-3 leading-relaxed whitespace-pre-line">
                        {vote2aConfig.context}
                      </p>
                      <p className="text-lg font-bold text-gray-900 mt-4">
                        {vote2aConfig.question}
                      </p>
                    </div>

                    {electionStatus2a === null && (
                      <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-6 text-center">
                        <p className="text-lg font-semibold text-amber-900 mb-2">
                          ⏳ Waiting for Vote to Open
                        </p>
                        <p className="text-sm text-amber-700">
                          The organizer will open this vote when ready. Please wait.
                        </p>
                      </div>
                    )}

                    {!hasVoted2a && electionStatus2a === "Open" && (
                      <>
                        <div className="pt-2">
                          <p className="text-sm font-semibold text-gray-700 mb-3">Cast Your Vote:</p>
                          <div className="space-y-3">
                            {vote2aConfig.options.map((option) => {
                              const isCommitteeInitiative = (
                                (assignedCommittee === "Marketing" && option.text.includes("(Marketing)")) ||
                                (assignedCommittee === "Operations" && option.text.includes("(Operations)")) ||
                                (assignedCommittee === "Community" && option.text.includes("(Community)"))
                              );
                              return (
                                <button
                                  key={option.id}
                                  onClick={() => setSelectedOption2a(option.id)}
                                  className={`w-full text-left px-6 py-4 border-2 rounded-xl transition-all duration-200 font-medium ${
                                    selectedOption2a === option.id
                                      ? "border-gray-900 bg-gray-900 text-white"
                                      : isCommitteeInitiative
                                      ? "border-blue-300 bg-blue-50 text-gray-900 hover:border-blue-400"
                                      : "border-gray-200 bg-gray-50 text-gray-900 hover:border-gray-400 hover:bg-white"
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span>{option.text}</span>
                                    {isCommitteeInitiative && selectedOption2a !== option.id && (
                                      <span className="text-xs text-blue-600 font-semibold">👥 Your Committee</span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <button
                          onClick={handleVoteSubmit2a}
                          disabled={selectedOption2a === null || isSubmitting2a}
                          className="w-full bg-gray-900 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:bg-gray-800 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSubmitting2a ? "Submitting..." : "Submit Vote"}
                        </button>
                      </>
                    )}

                    {hasVoted2a && (
                      <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                        <p className="text-sm font-semibold text-green-800">
                          ✓ You voted for: <span className="font-bold">{vote2aConfig.options.find(o => o.id === userVote2a)?.text}</span>
                        </p>
                      </div>
                    )}

                    {electionStatus2a !== null && (
                      <div className="border-t-2 border-gray-200 pt-6 mt-6">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="text-lg font-bold text-gray-900">
                              {electionStatus2a === "Closed" ? "Final Results" : "Live Results"}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {totalVotes2a} {totalVotes2a === 1 ? "vote" : "votes"} cast
                              {electionStatus2a === "Closed" && " • Voting closed"}
                            </p>
                          </div>
                          <button
                            onClick={handleRefreshResults2a}
                            disabled={isRefreshingResults2a}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 border-2 border-gray-300 rounded-lg text-sm font-medium text-gray-700 transition-all disabled:opacity-50"
                          >
                            <svg 
                              className={`w-4 h-4 ${isRefreshingResults2a ? 'animate-spin' : ''}`} 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Refresh
                          </button>
                        </div>

                        {electionStatus2a === "Closed" && (
                          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-3 mb-4">
                            <p className="text-sm text-blue-800 font-medium text-center">
                              🏁 These results are final
                            </p>
                          </div>
                        )}

                        <div className="space-y-3">
                          {vote2aConfig.options.map((option, index) => {
                            const voteCount = voteCounts2a[index] || 0;
                            const percentage = totalVotes2a > 0 ? (voteCount / totalVotes2a) * 100 : 0;
                            const isWinner = electionStatus2a === "Closed" && voteCount > 0 && voteCount === Math.max(...voteCounts2a);
                            const isUserChoice = hasVoted2a && option.id === userVote2a;
                            const voters = votersByChoice2a[option.id] || [];

                            return (
                              <div
                                key={option.id}
                                className={`rounded-xl border-2 transition-all overflow-hidden ${
                                  isWinner
                                    ? "border-green-400 bg-green-50"
                                    : isUserChoice
                                    ? "border-blue-300 bg-blue-50"
                                    : "border-gray-200 bg-white"
                                }`}
                              >
                                <div className="relative overflow-hidden">
                                  <div 
                                    className={`absolute inset-0 transition-all duration-500 ${
                                      isWinner
                                        ? "bg-green-100"
                                        : isUserChoice
                                        ? "bg-blue-100"
                                        : "bg-gray-100"
                                    }`}
                                    style={{ width: `${percentage}%` }}
                                  />
                                  
                                  <div className="relative px-4 py-3 flex items-center justify-between">
                                    <div className="flex-1 pr-4">
                                      <div className="flex items-center gap-2">
                                        {isWinner && <span className="text-lg">🏆</span>}
                                        {isUserChoice && !isWinner && (
                                          <span className="text-blue-600 font-bold">→</span>
                                        )}
                                        <p className={`font-medium ${
                                          isWinner ? "text-green-900 font-bold" : "text-gray-900"
                                        }`}>
                                          {option.text}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <div className="text-right">
                                        <p className={`text-2xl font-bold ${
                                          isWinner ? "text-green-700" : "text-gray-900"
                                        }`}>
                                          {percentage.toFixed(1)}%
                                        </p>
                                        <p className="text-xs text-gray-600">
                                          {voteCount} {voteCount === 1 ? "vote" : "votes"}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                
                                {voters.length > 0 && (
                                  <div className={`px-4 py-2 border-t ${
                                    isWinner
                                      ? "border-green-200 bg-green-50"
                                      : isUserChoice
                                      ? "border-blue-200 bg-blue-50"
                                      : "border-gray-200 bg-gray-50"
                                  }`}>
                                    <p className="text-xs text-gray-600 mb-1">Voters:</p>
                                    <div className="flex flex-wrap gap-1">
                                      {voters.map((voterId) => {
                                        const voterInfo = getVoterInfo(voterId);
                                        return (
                                          <span
                                            key={voterId}
                                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                              voterId === Number(userId)
                                                ? "bg-blue-200 text-blue-800"
                                                : "bg-gray-200 text-gray-700"
                                            }`}
                                          >
                                            {voterInfo.display}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Task 6: Vote 2b - Reciprocity Round 2 (Public) */}
          {vote2bConfig && (
            <div className={`bg-white rounded-2xl border-2 overflow-hidden shadow-sm transition-all duration-300 ${
              hasVoted2a ? "border-gray-200" : "border-gray-100 opacity-50"
            }`}>
              <div className="flex items-center gap-4 px-6 py-4 bg-gray-50 border-b-2 border-gray-200">
                {hasVoted2b ? (
                  <CheckCircleIcon className="w-7 h-7 text-green-600" />
                ) : (
                  <div className="w-7 h-7 rounded-full border-2 border-gray-400 flex items-center justify-center bg-white">
                    <span className="text-sm font-bold text-gray-600">6</span>
                  </div>
                )}
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-900">
                    {vote2bConfig.title}
                  </h2>
                  {!hasVoted2a && (
                    <p className="text-sm text-gray-500">Complete previous task to unlock</p>
                  )}
                  {hasVoted2b && electionStatus2b === "Open" && (
                    <p className="text-sm text-green-600 font-medium">Voted</p>
                  )}
                  {electionStatus2b === "Closed" && (
                    <p className="text-sm text-blue-600 font-medium">Closed</p>
                  )}
                  {electionStatus2b === null && hasVoted2a && (
                    <p className="text-sm text-amber-600 font-medium">Waiting to open...</p>
                  )}
                </div>
                {hasVoted2a && (
                  <button
                    onClick={() => setVote2bCollapsed(!vote2bCollapsed)}
                    className="text-sm text-gray-500 hover:text-gray-700 underline"
                  >
                    {vote2bCollapsed ? "Expand" : "Collapse"}
                  </button>
                )}
              </div>

              {hasVoted2a && !vote2bCollapsed && (
                <div className="p-8 space-y-6">
                  {/* Committee Assignment Banner with View All button */}
                  {assignedCommittee && (
                    <div className="space-y-3">
                      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                        <p className="text-sm font-semibold text-blue-900 text-center">
                          👥 Your Committee: <span className="text-lg font-bold">{assignedCommittee}</span>
                        </p>
                        <p className="text-xs text-blue-700 text-center mt-1">
                          Initiative {assignedCommittee === "Marketing" ? "A" : assignedCommittee === "Operations" ? "B" : "C"} best serves your committee
                        </p>
                      </div>
                      <button
                        onClick={handleOpenVoterList}
                        className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 border-2 border-gray-300 rounded-lg text-sm font-medium text-gray-700 transition-all"
                      >
                        📋 View Committee Composition
                      </button>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <p className="text-base text-gray-700 mb-3 leading-relaxed whitespace-pre-line">
                        {vote2bConfig.context}
                      </p>
                      <p className="text-lg font-bold text-gray-900 mt-4">
                        {vote2bConfig.question}
                      </p>
                    </div>

                    {electionStatus2b === null && (
                      <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-6 text-center">
                        <p className="text-lg font-semibold text-amber-900 mb-2">
                          ⏳ Waiting for Vote to Open
                        </p>
                        <p className="text-sm text-amber-700">
                          The organizer will open this vote when ready. Please wait.
                        </p>
                      </div>
                    )}

                    {!hasVoted2b && electionStatus2b === "Open" && (
                      <>
                        <div className="pt-2">
                          <p className="text-sm font-semibold text-gray-700 mb-3">Cast Your Vote:</p>
                          <div className="space-y-3">
                            {vote2bConfig.options.map((option) => {
                              const isCommitteeInitiative = (
                                (assignedCommittee === "Marketing" && option.text.includes("(Marketing)")) ||
                                (assignedCommittee === "Operations" && option.text.includes("(Operations)")) ||
                                (assignedCommittee === "Community" && option.text.includes("(Community)"))
                              );
                              return (
                                <button
                                  key={option.id}
                                  onClick={() => setSelectedOption2b(option.id)}
                                  className={`w-full text-left px-6 py-4 border-2 rounded-xl transition-all duration-200 font-medium ${
                                    selectedOption2b === option.id
                                      ? "border-gray-900 bg-gray-900 text-white"
                                      : isCommitteeInitiative
                                      ? "border-blue-300 bg-blue-50 text-gray-900 hover:border-blue-400"
                                      : "border-gray-200 bg-gray-50 text-gray-900 hover:border-gray-400 hover:bg-white"
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span>{option.text}</span>
                                    {isCommitteeInitiative && selectedOption2b !== option.id && (
                                      <span className="text-xs text-blue-600 font-semibold">👥 Your Committee</span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <button
                          onClick={handleVoteSubmit2b}
                          disabled={selectedOption2b === null || isSubmitting2b}
                          className="w-full bg-gray-900 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:bg-gray-800 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSubmitting2b ? "Submitting..." : "Submit Vote"}
                        </button>
                      </>
                    )}

                    {hasVoted2b && (
                      <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                        <p className="text-sm font-semibold text-green-800">
                          ✓ You voted for: <span className="font-bold">{vote2bConfig.options.find(o => o.id === userVote2b)?.text}</span>
                        </p>
                      </div>
                    )}

                    {electionStatus2b !== null && (
                      <div className="border-t-2 border-gray-200 pt-6 mt-6">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="text-lg font-bold text-gray-900">
                              {electionStatus2b === "Closed" ? "Final Results" : "Live Results"}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {totalVotes2b} {totalVotes2b === 1 ? "vote" : "votes"} cast
                              {electionStatus2b === "Closed" && " • Voting closed"}
                            </p>
                          </div>
                          <button
                            onClick={handleRefreshResults2b}
                            disabled={isRefreshingResults2b}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 border-2 border-gray-300 rounded-lg text-sm font-medium text-gray-700 transition-all disabled:opacity-50"
                          >
                            <svg 
                              className={`w-4 h-4 ${isRefreshingResults2b ? 'animate-spin' : ''}`} 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Refresh
                          </button>
                        </div>

                        {electionStatus2b === "Closed" && (
                          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-3 mb-4">
                            <p className="text-sm text-blue-800 font-medium text-center">
                              🏁 These results are final
                            </p>
                          </div>
                        )}

                        <div className="space-y-3">
                          {vote2bConfig.options.map((option, index) => {
                            const voteCount = voteCounts2b[index] || 0;
                            const percentage = totalVotes2b > 0 ? (voteCount / totalVotes2b) * 100 : 0;
                            const isWinner = electionStatus2b === "Closed" && voteCount > 0 && voteCount === Math.max(...voteCounts2b);
                            const isUserChoice = hasVoted2b && option.id === userVote2b;
                            const voters = votersByChoice2b[option.id] || [];

                            return (
                              <div
                                key={option.id}
                                className={`rounded-xl border-2 transition-all overflow-hidden ${
                                  isWinner
                                    ? "border-green-400 bg-green-50"
                                    : isUserChoice
                                    ? "border-blue-300 bg-blue-50"
                                    : "border-gray-200 bg-white"
                                }`}
                              >
                                <div className="relative overflow-hidden">
                                  <div 
                                    className={`absolute inset-0 transition-all duration-500 ${
                                      isWinner
                                        ? "bg-green-100"
                                        : isUserChoice
                                        ? "bg-blue-100"
                                        : "bg-gray-100"
                                    }`}
                                    style={{ width: `${percentage}%` }}
                                  />
                                  
                                  <div className="relative px-4 py-3 flex items-center justify-between">
                                    <div className="flex-1 pr-4">
                                      <div className="flex items-center gap-2">
                                        {isWinner && <span className="text-lg">🏆</span>}
                                        {isUserChoice && !isWinner && (
                                          <span className="text-blue-600 font-bold">→</span>
                                        )}
                                        <p className={`font-medium ${
                                          isWinner ? "text-green-900 font-bold" : "text-gray-900"
                                        }`}>
                                          {option.text}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <div className="text-right">
                                        <p className={`text-2xl font-bold ${
                                          isWinner ? "text-green-700" : "text-gray-900"
                                        }`}>
                                          {percentage.toFixed(1)}%
                                        </p>
                                        <p className="text-xs text-gray-600">
                                          {voteCount} {voteCount === 1 ? "vote" : "votes"}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                
                                {voters.length > 0 && (
                                  <div className={`px-4 py-2 border-t ${
                                    isWinner
                                      ? "border-green-200 bg-green-50"
                                      : isUserChoice
                                      ? "border-blue-200 bg-blue-50"
                                      : "border-gray-200 bg-gray-50"
                                  }`}>
                                    <p className="text-xs text-gray-600 mb-1">Voters:</p>
                                    <div className="flex flex-wrap gap-1">
                                      {voters.map((voterId) => {
                                        const voterInfo = getVoterInfo(voterId);
                                        return (
                                          <span
                                            key={voterId}
                                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                              voterId === Number(userId)
                                                ? "bg-blue-200 text-blue-800"
                                                : "bg-gray-200 text-gray-700"
                                            }`}
                                          >
                                            {voterInfo.display}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Task 7: Vote 2c - Reciprocity Round 3 (Private) */}
          {vote2cConfig && (
            <div className={`bg-white rounded-2xl border-2 overflow-hidden shadow-sm transition-all duration-300 ${
              hasVoted2b ? "border-gray-200" : "border-gray-100 opacity-50"
            }`}>
              <div className="flex items-center gap-4 px-6 py-4 bg-gray-50 border-b-2 border-gray-200">
                {hasVoted2c ? (
                  <CheckCircleIcon className="w-7 h-7 text-green-600" />
                ) : (
                  <div className="w-7 h-7 rounded-full border-2 border-gray-400 flex items-center justify-center bg-white">
                    <span className="text-sm font-bold text-gray-600">7</span>
                  </div>
                )}
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-900">
                    {vote2cConfig.title}
                  </h2>
                  {!hasVoted2b && (
                    <p className="text-sm text-gray-500">Complete previous task to unlock</p>
                  )}
                  {hasVoted2c && electionStatus2c === "Open" && (
                    <p className="text-sm text-green-600 font-medium">Voted</p>
                  )}
                  {electionStatus2c === "Closed" && (
                    <p className="text-sm text-blue-600 font-medium">Closed</p>
                  )}
                  {electionStatus2c === null && hasVoted2b && (
                    <p className="text-sm text-amber-600 font-medium">Waiting to open...</p>
                  )}
                </div>
                {hasVoted2b && (
                  <button
                    onClick={() => setVote2cCollapsed(!vote2cCollapsed)}
                    className="text-sm text-gray-500 hover:text-gray-700 underline"
                  >
                    {vote2cCollapsed ? "Expand" : "Collapse"}
                  </button>
                )}
              </div>

              {hasVoted2b && !vote2cCollapsed && (
                <div className="p-8 space-y-6">
                  {/* Committee Assignment Banner */}
                  {assignedCommittee && (
                    <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                      <p className="text-sm font-semibold text-blue-900 text-center">
                        👥 Your Committee: <span className="text-lg font-bold">{assignedCommittee}</span>
                      </p>
                      <p className="text-xs text-blue-700 text-center mt-1">
                        Initiative {assignedCommittee === "Marketing" ? "A" : assignedCommittee === "Operations" ? "B" : "C"} best serves your committee
                      </p>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <p className="text-base text-gray-700 mb-3 leading-relaxed whitespace-pre-line">
                        {vote2cConfig.context}
                      </p>
                      <p className="text-lg font-bold text-gray-900 mt-4">
                        {vote2cConfig.question}
                      </p>
                    </div>

                    {electionStatus2c === null && (
                      <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-6 text-center">
                        <p className="text-lg font-semibold text-amber-900 mb-2">
                          ⏳ Waiting for Vote to Open
                        </p>
                        <p className="text-sm text-amber-700">
                          The organizer will open this vote when ready. Please wait.
                        </p>
                      </div>
                    )}

                    {!hasVoted2c && electionStatus2c === "Open" && (
                      <>
                        <div className="pt-2">
                          <p className="text-sm font-semibold text-gray-700 mb-3">Cast Your Private Vote:</p>
                          <div className="space-y-3">
                            {vote2cConfig.options.map((option) => {
                              const isCommitteeInitiative = (
                                (assignedCommittee === "Marketing" && option.text.includes("(Marketing)")) ||
                                (assignedCommittee === "Operations" && option.text.includes("(Operations)")) ||
                                (assignedCommittee === "Community" && option.text.includes("(Community)"))
                              );
                              return (
                                <button
                                  key={option.id}
                                  onClick={() => setSelectedOption2c(option.id)}
                                  className={`w-full text-left px-6 py-4 border-2 rounded-xl transition-all duration-200 font-medium ${
                                    selectedOption2c === option.id
                                      ? "border-gray-900 bg-gray-900 text-white"
                                      : isCommitteeInitiative
                                      ? "border-blue-300 bg-blue-50 text-gray-900 hover:border-blue-400"
                                      : "border-gray-200 bg-gray-50 text-gray-900 hover:border-gray-400 hover:bg-white"
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span>{option.text}</span>
                                    {isCommitteeInitiative && selectedOption2c !== option.id && (
                                      <span className="text-xs text-blue-600 font-semibold">👥 Your Committee</span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <button
                          onClick={handleVoteSubmit2c}
                          disabled={selectedOption2c === null || isSubmitting2c}
                          className="w-full bg-gray-900 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:bg-gray-800 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSubmitting2c ? "Encrypting and submitting..." : "Submit Private Vote"}
                        </button>

                        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                          <p className="text-xs text-blue-800">
                            <strong>How it works:</strong> You&apos;ll be asked to sign a message with your wallet. 
                            This signature will be encrypted and submitted to the blockchain. Only the organizer can decrypt and tally the votes to present the final results. Individual votes remain secret.
                          </p>
                        </div>
                      </>
                    )}

                    {hasVoted2c && (
                      <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                        <p className="text-sm font-semibold text-green-800 text-center">
                          ✓ Your encrypted vote has been recorded on the blockchain
                        </p>
                        <p className="text-xs text-green-700 text-center mt-1">
                          The organizer will present the results after voting closes
                        </p>
                      </div>
                    )}

                    {electionStatus2c === "Closed" && (
                      <div className="border-t-2 border-gray-200 pt-6 mt-6">
                        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                          <p className="text-sm text-blue-800 font-medium text-center">
                            🔐 Voting is closed. The organizer will present the results.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Task 8: Vote 2d - Reciprocity Round 4 (Private with Bonus) */}
          {vote2dConfig && (
            <div className={`bg-white rounded-2xl border-2 overflow-hidden shadow-sm transition-all duration-300 ${
              hasVoted2c ? "border-gray-200" : "border-gray-100 opacity-50"
            }`}>
              <div className="flex items-center gap-4 px-6 py-4 bg-gray-50 border-b-2 border-gray-200">
                {hasVoted2d ? (
                  <CheckCircleIcon className="w-7 h-7 text-green-600" />
                ) : (
                  <div className="w-7 h-7 rounded-full border-2 border-gray-400 flex items-center justify-center bg-white">
                    <span className="text-sm font-bold text-gray-600">8</span>
                  </div>
                )}
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-900">
                    {vote2dConfig.title}
                  </h2>
                  {!hasVoted2c && (
                    <p className="text-sm text-gray-500">Complete previous task to unlock</p>
                  )}
                  {hasVoted2d && electionStatus2d === "Open" && (
                    <p className="text-sm text-green-600 font-medium">Voted</p>
                  )}
                  {electionStatus2d === "Closed" && (
                    <p className="text-sm text-blue-600 font-medium">Closed</p>
                  )}
                  {electionStatus2d === null && hasVoted2c && (
                    <p className="text-sm text-amber-600 font-medium">Waiting to open...</p>
                  )}
                </div>
                {hasVoted2c && (
                  <button
                    onClick={() => setVote2dCollapsed(!vote2dCollapsed)}
                    className="text-sm text-gray-500 hover:text-gray-700 underline"
                  >
                    {vote2dCollapsed ? "Expand" : "Collapse"}
                  </button>
                )}
              </div>

              {hasVoted2c && !vote2dCollapsed && (
                <div className="p-8 space-y-6">
                  {/* Bonus Banner */}
                  <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-6">
                    <p className="text-lg font-bold text-amber-900 text-center mb-2">
                      🎁 BONUS OPPORTUNITY
                    </p>
                    <p className="text-sm text-amber-800 text-center">
                      If D (Shared Hub) reaches 50% or more votes, everyone who voted D earns a bonus!
                    </p>
                  </div>

                  {/* Committee Assignment Banner */}
                  {assignedCommittee && (
                    <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                      <p className="text-sm font-semibold text-blue-900 text-center">
                        👥 Your Committee: <span className="text-lg font-bold">{assignedCommittee}</span>
                      </p>
                      <p className="text-xs text-blue-700 text-center mt-1">
                        Initiative {assignedCommittee === "Marketing" ? "A" : assignedCommittee === "Operations" ? "B" : "C"} best serves your committee
                      </p>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <p className="text-base text-gray-700 mb-3 leading-relaxed whitespace-pre-line">
                        {vote2dConfig.context}
                      </p>
                      <p className="text-lg font-bold text-gray-900 mt-4">
                        {vote2dConfig.question}
                      </p>
                    </div>

                    {electionStatus2d === null && (
                      <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-6 text-center">
                        <p className="text-lg font-semibold text-amber-900 mb-2">
                          ⏳ Waiting for Vote to Open
                        </p>
                        <p className="text-sm text-amber-700">
                          The organizer will open this vote when ready. Please wait.
                        </p>
                      </div>
                    )}

                    {!hasVoted2d && electionStatus2d === "Open" && (
                      <>
                        <div className="pt-2">
                          <p className="text-sm font-semibold text-gray-700 mb-3">Cast Your Private Vote:</p>
                          <div className="space-y-3">
                            {vote2dConfig.options.map((option) => {
                              const isCommitteeInitiative = (
                                (assignedCommittee === "Marketing" && option.text.includes("(Marketing)")) ||
                                (assignedCommittee === "Operations" && option.text.includes("(Operations)")) ||
                                (assignedCommittee === "Community" && option.text.includes("(Community)"))
                              );
                              const isSharedHub = option.text.includes("Shared Hub");
                              return (
                                <button
                                  key={option.id}
                                  onClick={() => setSelectedOption2d(option.id)}
                                  className={`w-full text-left px-6 py-4 border-2 rounded-xl transition-all duration-200 font-medium ${
                                    selectedOption2d === option.id
                                      ? "border-gray-900 bg-gray-900 text-white"
                                      : isSharedHub
                                      ? "border-amber-300 bg-amber-50 text-gray-900 hover:border-amber-400"
                                      : isCommitteeInitiative
                                      ? "border-blue-300 bg-blue-50 text-gray-900 hover:border-blue-400"
                                      : "border-gray-200 bg-gray-50 text-gray-900 hover:border-gray-400 hover:bg-white"
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span>{option.text}</span>
                                    {isSharedHub && selectedOption2d !== option.id && (
                                      <span className="text-xs text-amber-600 font-semibold">🎁 Bonus Option</span>
                                    )}
                                    {isCommitteeInitiative && !isSharedHub && selectedOption2d !== option.id && (
                                      <span className="text-xs text-blue-600 font-semibold">👥 Your Committee</span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <button
                          onClick={handleVoteSubmit2d}
                          disabled={selectedOption2d === null || isSubmitting2d}
                          className="w-full bg-gray-900 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:bg-gray-800 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSubmitting2d ? "Encrypting and submitting..." : "Submit Private Vote"}
                        </button>

                        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                          <p className="text-xs text-blue-800">
                            <strong>How it works:</strong> You&apos;ll be asked to sign a message with your wallet. 
                            This signature will be encrypted and submitted to the blockchain. Only the organizer can decrypt and tally the votes to present the final results. Individual votes remain secret.
                          </p>
                        </div>
                      </>
                    )}

                    {hasVoted2d && (
                      <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                        <p className="text-sm font-semibold text-green-800 text-center">
                          ✓ Your encrypted vote has been recorded on the blockchain
                        </p>
                        <p className="text-xs text-green-700 text-center mt-1">
                          The organizer will present the results after voting closes
                        </p>
                      </div>
                    )}

                    {electionStatus2d === "Closed" && (
                      <div className="border-t-2 border-gray-200 pt-6 mt-6">
                        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                          <p className="text-sm text-blue-800 font-medium text-center">
                            🔐 Voting is closed. The organizer will present the results.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Task 9: Vote 3 - Merit vs Luck */}
          {vote3Config && (
            <div className={`bg-white rounded-2xl border-2 overflow-hidden shadow-sm transition-all duration-300 ${
              hasVoted2d ? "border-gray-200" : "border-gray-100 opacity-50"
            }`}>
              <div className="flex items-center gap-4 px-6 py-4 bg-gray-50 border-b-2 border-gray-200">
                {hasVoted3 ? (
                  <CheckCircleIcon className="w-7 h-7 text-green-600" />
                ) : (
                  <div className="w-7 h-7 rounded-full border-2 border-gray-400 flex items-center justify-center bg-white">
                    <span className="text-sm font-bold text-gray-600">9</span>
                  </div>
                )}
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-900">
                    {vote3Config.title}
                  </h2>
                  {!hasVoted2d && (
                    <p className="text-sm text-gray-500">Complete previous task to unlock</p>
                  )}
                  {hasVoted3 && electionStatus3 === "Open" && (
                    <p className="text-sm text-green-600 font-medium">Voted</p>
                  )}
                  {electionStatus3 === "Closed" && (
                    <p className="text-sm text-blue-600 font-medium">Closed</p>
                  )}
                  {electionStatus3 === null && hasVoted2d && (
                    <p className="text-sm text-amber-600 font-medium">Waiting to open...</p>
                  )}
                </div>
                {hasVoted2d && (
                  <button
                    onClick={() => setVote3Collapsed(!vote3Collapsed)}
                    className="text-sm text-gray-500 hover:text-gray-700 underline"
                  >
                    {vote3Collapsed ? "Expand" : "Collapse"}
                  </button>
                )}
              </div>

              {hasVoted2d && !vote3Collapsed && (
                <div className="px-6 py-6 space-y-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-base text-gray-700 mb-3 leading-relaxed whitespace-pre-line">
                        {vote3Config.context}
                      </p>
                      <p className="text-lg font-bold text-gray-900 mt-4">
                        {vote3Config.question}
                      </p>
                    </div>

                    {electionStatus3 === null && (
                      <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-6 text-center">
                        <p className="text-lg font-semibold text-amber-900 mb-2">
                          ⏳ Waiting for Vote to Open
                        </p>
                        <p className="text-sm text-amber-700">
                          The organizer will open this vote when ready. Please wait.
                        </p>
                      </div>
                    )}

                    {!hasVoted3 && electionStatus3 === "Open" && (
                      <>
                        <div className="pt-2">
                          <p className="text-sm font-semibold text-gray-700 mb-3">Cast Your Vote:</p>
                          <div className="space-y-3">
                            {vote3Config.options.map((option) => (
                              <button
                                key={option.id}
                                onClick={() => setSelectedOption3(option.id)}
                                className={`w-full text-left px-6 py-4 border-2 rounded-xl transition-all duration-200 font-medium ${
                                  selectedOption3 === option.id
                                    ? "border-gray-900 bg-gray-900 text-white"
                                    : "border-gray-200 bg-gray-50 text-gray-900 hover:border-gray-400 hover:bg-white"
                                }`}
                              >
                                {option.text}
                              </button>
                            ))}
                          </div>
                        </div>

                        <button
                          onClick={handleVoteSubmit3}
                          disabled={selectedOption3 === null || isSubmitting3}
                          className="w-full bg-gray-900 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:bg-gray-800 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSubmitting3 ? "Submitting..." : "Submit Vote"}
                        </button>

                        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                          <p className="text-xs text-blue-800">
                            <strong>Note:</strong> This vote is fully public. All participants can see who voted for each option. Open discussion is encouraged.
                          </p>
                        </div>
                      </>
                    )}

                    {hasVoted3 && (
                      <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                        <p className="text-sm font-semibold text-green-800">
                          ✓ You voted for: <span className="font-bold">{vote3Config.options.find(o => o.id === userVote3)?.text}</span>
                        </p>
                      </div>
                    )}

                    {electionStatus3 !== null && (
                      <div className="border-t-2 border-gray-200 pt-6 mt-6">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="text-lg font-bold text-gray-900">
                              {electionStatus3 === "Closed" ? "Final Results" : "Live Results"}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {totalVotes3} {totalVotes3 === 1 ? "vote" : "votes"} cast
                              {electionStatus3 === "Closed" && " • Voting closed"}
                            </p>
                          </div>
                          <button
                            onClick={handleRefreshResults3}
                            disabled={isRefreshingResults3}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 border-2 border-gray-300 rounded-lg text-sm font-medium text-gray-700 transition-all disabled:opacity-50"
                          >
                            <svg 
                              className={`w-4 h-4 ${isRefreshingResults3 ? 'animate-spin' : ''}`} 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Refresh
                          </button>
                        </div>

                        {electionStatus3 === "Closed" && (
                          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-3 mb-4">
                            <p className="text-sm text-blue-800 font-medium text-center">
                              🏁 These results are final
                            </p>
                          </div>
                        )}

                        <div className="space-y-3">
                          {vote3Config.options.map((option, index) => {
                            const voteCount = voteCounts3[index] || 0;
                            const percentage = totalVotes3 > 0 ? (voteCount / totalVotes3) * 100 : 0;
                            const isWinner = electionStatus3 === "Closed" && voteCount > 0 && voteCount === Math.max(...voteCounts3);
                            const isUserChoice = hasVoted3 && option.id === userVote3;
                            const voters = votersByChoice3[option.id] || [];

                            return (
                              <div
                                key={option.id}
                                className={`rounded-xl border-2 transition-all overflow-hidden ${
                                  isWinner
                                    ? "border-green-400 bg-green-50"
                                    : isUserChoice
                                    ? "border-blue-300 bg-blue-50"
                                    : "border-gray-200 bg-white"
                                }`}
                              >
                                <div className="relative overflow-hidden">
                                  <div 
                                    className={`absolute inset-0 transition-all duration-500 ${
                                      isWinner
                                        ? "bg-green-100"
                                        : isUserChoice
                                        ? "bg-blue-100"
                                        : "bg-gray-100"
                                    }`}
                                    style={{ width: `${percentage}%` }}
                                  />
                                  
                                  <div className="relative px-4 py-3 flex items-center justify-between">
                                    <div className="flex-1 pr-4">
                                      <div className="flex items-center gap-2">
                                        {isWinner && <span className="text-lg">🏆</span>}
                                        {isUserChoice && !isWinner && (
                                          <span className="text-blue-600 font-bold">→</span>
                                        )}
                                        <p className={`font-medium ${
                                          isWinner ? "text-green-900 font-bold" : "text-gray-900"
                                        }`}>
                                          {option.text}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <div className="text-right">
                                        <p className={`text-2xl font-bold ${
                                          isWinner ? "text-green-700" : "text-gray-900"
                                        }`}>
                                          {percentage.toFixed(1)}%
                                        </p>
                                        <p className="text-xs text-gray-600">
                                          {voteCount} {voteCount === 1 ? "vote" : "votes"}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                
                                {voters.length > 0 && (
                                  <div className={`px-4 py-2 border-t ${
                                    isWinner
                                      ? "border-green-200 bg-green-50"
                                      : isUserChoice
                                      ? "border-blue-200 bg-blue-50"
                                      : "border-gray-200 bg-gray-50"
                                  }`}>
                                    <p className="text-xs text-gray-600 mb-1">Voters:</p>
                                    <div className="flex flex-wrap gap-1">
                                      {voters.map((voterId) => (
                                        <span
                                          key={voterId}
                                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                            voterId === Number(userId)
                                              ? "bg-blue-200 text-blue-800"
                                              : "bg-gray-200 text-gray-700"
                                          }`}
                                        >
                                          #{voterId}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Completion Message */}
          {hasVoted0 && hasVoted1a && hasVoted1b && hasVoted2a && hasVoted2b && hasVoted2c && hasVoted2d && hasVoted3 && (
            <div className="text-center py-12 px-6">
              <div className="max-w-2xl mx-auto space-y-4">
                <h2 className="text-4xl md:text-5xl font-bold text-gray-900">
                  🎉 Thank You! 🎉
                </h2>
                <p className="text-xl md:text-2xl text-gray-700 font-medium">
                  You&apos;ve completed all voting exercises!
                </p>
                <p className="text-lg text-gray-600 leading-relaxed">
                  Thank you for your active participation in this workshop. We hope you enjoyed exploring the fascinating dynamics of coordination, reciprocity, and collective decision-making.
                </p>
                <p className="text-base text-gray-500 italic">
                  The organizer will announce the final results and prize winners shortly.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Voter List Modal */}
      {showVoterListModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowVoterListModal(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b-2 border-gray-200 bg-gray-50">
              <h2 className="text-xl font-bold text-gray-900">Committee Composition</h2>
              <button
                onClick={() => setShowVoterListModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 transition-colors"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1">
              {allVoters.length === 0 ? (
                <p className="text-center text-gray-500">Loading voters...</p>
              ) : (
                <div className="space-y-6">
                  {/* Group by Committee */}
                  {["Marketing", "Operations", "Community"].map((committee) => {
                    const committeeVoters = allVoters.filter((v) => v.committee === committee);
                    
                    return (
                      <div key={committee} className="bg-gray-50 rounded-xl p-4 border-2 border-gray-200">
                        <h3 className="font-bold text-lg text-gray-900 mb-3">
                          {committee} Committee ({committeeVoters.length} members)
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {committeeVoters.map((voter) => (
                            <span
                              key={voter.id}
                              className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-white border-2 border-gray-300 text-gray-800"
                            >
                              #{voter.id}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ToastContainer
        position="top-center"
        autoClose={5000}
        hideProgressBar
        newestOnTop={false}
        closeOnClick={false}
        rtl={false}
        pauseOnFocusLoss
        draggable={false}
        pauseOnHover
        limit={1}
        aria-label="Toast notifications"
        style={{ top: 58 }}
      />
    </div>
  );
}

