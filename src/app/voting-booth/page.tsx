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
import { getVoteConfig, VOTING_CONTRACT_ADDRESS } from "@/config/votesConfig";

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
      { internalType: "address", name: "userAddress", type: "address" }
    ],
    name: "hasUserVoted",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
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
  
  // Vote 0 state
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [userVote, setUserVote] = useState<number | null>(null);
  
  const vote0Config = getVoteConfig("vote0");

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
          
          // Check if user has voted in vote 0
          if (vote0Config) {
            const voted = await publicClient.readContract({
              address: VOTING_CONTRACT_ADDRESS,
              abi: VOTING_WORKSHOP_ABI,
              functionName: "hasUserVoted",
              args: [BigInt(vote0Config.electionId), walletAddress as `0x${string}`],
            });
            
            setHasVoted(voted);
            
            // If voted, get their vote choice
            if (voted) {
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
              
              const choice = await publicClient.readContract({
                address: VOTING_CONTRACT_ADDRESS,
                abi: publicVotesABI,
                functionName: "publicVotes",
                args: [BigInt(vote0Config.electionId), id],
              });
              
              setUserVote(Number(choice));
            }
          }
          
          setLoading(false);
        }
      } catch (error) {
        console.error("Error checking registration:", error);
        router.push("/");
      }
    }

    checkRegistrationAndVotes();
  }, [ready, authenticated, user, router, vote0Config]);

  const handleVoteSubmit = async () => {
    if (selectedOption === null || !vote0Config) {
      showErrorToast("Please select an option");
      return;
    }

    setIsSubmitting(true);

    try {
      // Encode the castPublicVote function call
      const data = encodeFunctionData({
        abi: VOTING_WORKSHOP_ABI,
        functionName: "castPublicVote",
        args: [BigInt(vote0Config.electionId), BigInt(selectedOption)],
      });

      // Send the transaction
      await sendTransaction({
        to: VOTING_CONTRACT_ADDRESS,
        data: data,
        value: BigInt(0),
      });

      showSuccessToast("Vote submitted successfully!");
      setHasVoted(true);
      setUserVote(selectedOption);
    } catch (error: any) {
      console.error("Vote submission error:", error);
      showErrorToast(error?.message || "Failed to submit vote. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!ready || loading) {
    return <FullScreenLoader />;
  }

  if (!authenticated) {
    router.push("/");
    return <FullScreenLoader />;
  }

  if (isSubmitting) {
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
              {task1Complete && (
                <button
                  onClick={() => setTask1Complete(false)}
                  className="text-sm text-gray-500 hover:text-gray-700 underline"
                >
                  Expand
                </button>
              )}
            </div>

            {!task1Complete && (
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

                <button
                  onClick={() => setTask1Complete(true)}
                  className="w-full bg-gray-900 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:bg-gray-800 hover:shadow-lg"
                >
                  Done! ✓
                </button>
              </div>
            )}
          </div>

          {/* Task 2: Vote 0 - Training Ground */}
          <div className={`bg-white rounded-2xl border-2 overflow-hidden shadow-sm transition-all duration-300 ${
            task1Complete ? "border-gray-200" : "border-gray-100 opacity-50"
          }`}>
            <div className="flex items-center gap-4 px-6 py-4 bg-gray-50 border-b-2 border-gray-200">
              {hasVoted ? (
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
                {hasVoted && (
                  <p className="text-sm text-green-600 font-medium">Voted</p>
                )}
              </div>
            </div>

            {task1Complete && (
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

                  {hasVoted ? (
                    <div className="space-y-4">
                      <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6 text-center">
                        <p className="text-lg font-semibold text-green-800 mb-2">
                          ✓ You voted!
                        </p>
                        <p className="text-gray-700">
                          Your choice: <strong>{vote0Config.options.find(o => o.id === userVote)?.text}</strong>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3">
                        {vote0Config.options.map((option) => (
                          <button
                            key={option.id}
                            onClick={() => setSelectedOption(option.id)}
                            className={`w-full text-left px-6 py-4 border-2 rounded-xl transition-all duration-200 font-medium ${
                              selectedOption === option.id
                                ? "border-gray-900 bg-gray-900 text-white"
                                : "border-gray-200 bg-gray-50 text-gray-900 hover:border-gray-400 hover:bg-white"
                            }`}
                          >
                            {option.text}
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={handleVoteSubmit}
                        disabled={selectedOption === null || isSubmitting}
                        className="w-full bg-gray-900 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 hover:bg-gray-800 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? "Submitting..." : "Submit Vote"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Task 3 Preview (Locked) */}
          <div className="bg-white rounded-2xl border-2 border-gray-100 overflow-hidden shadow-sm opacity-50">
            <div className="flex items-center gap-4 px-6 py-4 bg-gray-50">
              <div className="w-7 h-7 rounded-full border-2 border-gray-300 flex items-center justify-center bg-white">
                <span className="text-sm font-bold text-gray-400">3</span>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-400">
                  Locked
                </h2>
                <p className="text-sm text-gray-400">Complete previous tasks to unlock</p>
              </div>
            </div>
          </div>
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

