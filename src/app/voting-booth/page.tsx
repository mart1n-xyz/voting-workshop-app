"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Header } from "@/components/ui/header";
import { FullScreenLoader } from "@/components/ui/fullscreen-loader";
import { createPublicClient, http } from "viem";
import { statusNetworkSepolia } from "viem/chains";
import { CheckCircleIcon } from "@heroicons/react/24/solid";

const CONTRACT_ADDRESS = "0x0918E5b67187400548571D372D381C4bB4B9B27b";

const VOTING_WORKSHOP_ABI = [
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "addressToId",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export default function VotingBooth() {
  const { ready, authenticated, user } = usePrivy();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [task1Complete, setTask1Complete] = useState(false);

  useEffect(() => {
    async function checkRegistration() {
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
          address: CONTRACT_ADDRESS,
          abi: VOTING_WORKSHOP_ABI,
          functionName: "addressToId",
          args: [walletAddress as `0x${string}`],
        });

        if (id === BigInt(0)) {
          // User is not registered, redirect to home
          router.push("/");
        } else {
          setUserId(id.toString());
          setLoading(false);
        }
      } catch (error) {
        console.error("Error checking registration:", error);
        router.push("/");
      }
    }

    checkRegistration();
  }, [ready, authenticated, user, router]);

  if (!ready || loading) {
    return <FullScreenLoader />;
  }

  if (!authenticated) {
    router.push("/");
    return <FullScreenLoader />;
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

          {/* Task 2: First Vote */}
          <div className={`bg-white rounded-2xl border-2 overflow-hidden shadow-sm transition-all duration-300 ${
            task1Complete ? "border-gray-200" : "border-gray-100 opacity-50"
          }`}>
            <div className="flex items-center gap-4 px-6 py-4 bg-gray-50 border-b-2 border-gray-200">
              <div className="w-7 h-7 rounded-full border-2 border-gray-400 flex items-center justify-center bg-white">
                <span className="text-sm font-bold text-gray-600">2</span>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900">
                  First Vote
                </h2>
                {!task1Complete && (
                  <p className="text-sm text-gray-500">Complete previous task to unlock</p>
                )}
              </div>
            </div>

            {task1Complete && (
              <div className="p-8 space-y-6">
                <div className="space-y-4">
                  <p className="text-lg text-gray-700">
                    <strong>Question:</strong> What is your preferred blockchain network for development?
                  </p>

                  <div className="space-y-3">
                    {["Ethereum", "Polygon", "Arbitrum", "Optimism", "Status Network"].map((option) => (
                      <button
                        key={option}
                        className="w-full text-left px-6 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl hover:border-gray-900 hover:bg-white transition-all duration-200 font-medium text-gray-900"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  disabled
                  className="w-full bg-gray-300 text-gray-500 px-8 py-4 rounded-xl text-lg font-semibold cursor-not-allowed"
                >
                  Submit Vote (Coming Soon)
                </button>
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
    </div>
  );
}

