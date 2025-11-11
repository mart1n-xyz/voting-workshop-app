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
import { getVoteConfig, VOTING_CONTRACT_ADDRESS, getAssignedDistrict } from "@/config/votesConfig";
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
  {
    inputs: [{ internalType: "uint256", name: "electionId", type: "uint256" }],
    name: "getVoteCount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export default function VotingBooth() {
  const { ready, authenticated, user } = usePrivy();
  const { sendTransaction } = useSendTransaction();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [userAddress, setUserAddress] = useState<string | null>(null);
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
  
  const vote0Config = getVoteConfig("vote0");
  const vote1aConfig = getVoteConfig("vote1a");
  const vote1bConfig = getVoteConfig("vote1b");
  
  // Vote 1b state (private vote)
  const [selectedOption1b, setSelectedOption1b] = useState<number | null>(null);
  const [hasVoted1b, setHasVoted1b] = useState(false);
  const [electionStatus1b, setElectionStatus1b] = useState<"Open" | "Closed" | null>(null);
  const [totalVotes1b, setTotalVotes1b] = useState(0);
  
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

      // Get total vote count (private votes don't show individual results)
      const voteCount = await publicClient.readContract({
        address: VOTING_CONTRACT_ADDRESS,
        abi: VOTING_WORKSHOP_ABI,
        functionName: "getVoteCount",
        args: [BigInt(vote1bConfig.electionId)],
      });

      setTotalVotes1b(Number(voteCount));
    } catch (error) {
      console.error("Error fetching status for vote 1b:", error);
      // If election doesn't exist yet, auto-collapse on load
      if (autoCollapseOnLoad) {
        setVote1bCollapsed(true);
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
          setUserAddress(walletAddress);
          
          // Assign district for vote 1a
          const district = getAssignedDistrict(walletAddress);
          setAssignedDistrict(district);
          
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
          
          setLoading(false);
        }
      } catch (error) {
        console.error("Error checking registration:", error);
        router.push("/");
      }
    }

    checkRegistrationAndVotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authenticated, user, router, vote0Config, vote1aConfig, vote1bConfig]);

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

  if (!ready || loading) {
    return <FullScreenLoader />;
  }

  if (!authenticated) {
    router.push("/");
    return <FullScreenLoader />;
  }

  if (isSubmitting0 || isSubmitting1a) {
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
                    <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
                      <p className="text-sm font-semibold text-purple-900 text-center">
                        📍 You live in: <span className="text-lg font-bold">District {assignedDistrict}</span>
                      </p>
                      <p className="text-xs text-purple-700 text-center mt-1">
                        You'll benefit if funds are allocated to your district
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
                                      ? "border-purple-300 bg-purple-50 text-gray-900 hover:border-purple-400"
                                      : "border-gray-200 bg-gray-50 text-gray-900 hover:border-gray-400 hover:bg-white"
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span>{option.text}</span>
                                    {isHomeDistrict && selectedOption1a !== option.id && (
                                      <span className="text-xs text-purple-600 font-semibold">🏠 Your District</span>
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
                                    : isHomeDistrict
                                    ? "border-purple-200 bg-purple-50"
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
                                        : isHomeDistrict
                                        ? "bg-purple-100"
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
                                      : isHomeDistrict
                                      ? "border-purple-200 bg-purple-50"
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
        </div>
      </main>
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

