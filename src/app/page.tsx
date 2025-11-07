"use client";

import { usePrivy, useWallets, useSendTransaction } from "@privy-io/react-auth";
import { ToastContainer } from "react-toastify";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/ui/header";
import { FullScreenLoader } from "@/components/ui/fullscreen-loader";
import { showSuccessToast, showErrorToast } from "@/components/ui/custom-toast";
import { createPublicClient, http, encodeFunctionData } from "viem";
import { statusNetworkSepolia } from "viem/chains";
import { VOTING_CONTRACT_ADDRESS } from "@/config/votesConfig";

const VOTING_WORKSHOP_ABI = [
  {
    inputs: [],
    name: "register",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "addressToId",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

function Home() {
  const { ready, authenticated, login, user } = usePrivy();
  const { wallets } = useWallets();
  const { sendTransaction } = useSendTransaction();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isCheckingRegistration, setIsCheckingRegistration] = useState(true);

  // Check if user is already registered
  useEffect(() => {
    async function checkRegistration() {
      if (!ready || !authenticated || !user) {
        setIsCheckingRegistration(false);
        return;
      }

      try {
        const walletAddress = user.wallet?.address;
        if (!walletAddress) {
          setIsCheckingRegistration(false);
          return;
        }

        const publicClient = createPublicClient({
          chain: statusNetworkSepolia,
          transport: http("https://public.sepolia.rpc.status.network"),
        });

        const id = await publicClient.readContract({
          address: VOTING_CONTRACT_ADDRESS,
          abi: VOTING_WORKSHOP_ABI,
          functionName: "addressToId",
          args: [walletAddress as `0x${string}`],
        });

        if (id !== BigInt(0)) {
          // User is already registered, redirect to voting booth
          router.push("/voting-booth");
        } else {
          setIsCheckingRegistration(false);
        }
      } catch (error) {
        console.error("Error checking registration:", error);
        setIsCheckingRegistration(false);
      }
    }

    checkRegistration();
  }, [ready, authenticated, user, router]);

  const handleRegister = async () => {
    if (!ethereumWallet?.address) {
      showErrorToast("No wallet found");
      return;
    }

    setIsRegistering(true);

    try {
      // Encode the register function call
      const data = encodeFunctionData({
        abi: VOTING_WORKSHOP_ABI,
        functionName: "register",
      });

      // Send the transaction
      const txHash = await sendTransaction({
        to: VOTING_CONTRACT_ADDRESS,
        data: data,
        value: BigInt(0),
      });

      showSuccessToast("Registration successful! Redirecting...");
      
      // Wait a bit for the transaction to be processed
      setTimeout(() => {
        router.push("/voting-booth");
      }, 2000);
    } catch (error: any) {
      console.error("Registration error:", error);
      showErrorToast(error?.message || "Registration failed. Please try again.");
      setIsRegistering(false);
    }
  };

  if (!ready || (authenticated && isCheckingRegistration)) {
    return <FullScreenLoader />;
  }

  if (isRegistering) {
    return <FullScreenLoader message="Registering..." />;
  }

  if (!authenticated) {
    return (
      <>
        <section className="w-full flex flex-row justify-center items-center h-screen bg-gray-100 relative overflow-hidden">
          {/* Dot-dash lines background */}
          <div className="absolute inset-0 w-full h-full pointer-events-none">
            {[...Array(120)].map((_, i) => (
              <div
                key={i}
                className="absolute w-full h-[2px]"
                style={{
                  top: `${i * 0.833}%`,
                  left: i % 2 === 0 ? '0' : '10.5px',
                  backgroundImage: 'repeating-linear-gradient(90deg, #D1D5DB 0px, #D1D5DB 3px, transparent 3px, transparent 7px, #D1D5DB 7px, #D1D5DB 17px, transparent 17px, transparent 21px)',
                }}
              />
            ))}
          </div>
          
          <div className="flex flex-col items-center justify-center w-full h-full space-y-8 relative z-10">
            <div className="flex h-10 items-center justify-center rounded-full border-2 border-gray-400 px-6 text-base text-gray-700 font-medium bg-white/50">
              FtC BA Workshop
            </div>
            <div className="text-center text-gray-900 text-6xl md:text-7xl font-bold leading-tight">
              Live Voting Session
            </div>
            
            <button
              className="bg-gray-900 text-white border-2 border-gray-900 px-8 py-4 rounded-full text-lg font-medium transition-all duration-300 hover:bg-transparent hover:text-gray-900 mt-8"
              onClick={() => {
                login();
                setTimeout(() => {
                  (document.querySelector('input[type="email"]') as HTMLInputElement)?.focus();
                }, 150);
              }}
            >
              Login
            </button>
          </div>
        </section>
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
        />
      </>
    );
  }

  const ethereumWallet = wallets.find((wallet) => wallet.walletClientType === "privy");

  const copyAddress = async () => {
    if (ethereumWallet?.address) {
      try {
        await navigator.clipboard.writeText(ethereumWallet.address);
        setCopied(true);
        showSuccessToast("Address copied to clipboard!");
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy:", err);
      }
    }
  };

  return (
    <>
      <div className="bg-gray-100 min-h-screen">
        <Header />
        <main className="flex items-center justify-center px-6 py-16 min-h-[calc(100vh-60px)]">
          <div className="max-w-3xl w-full text-center space-y-20">
            <div className="space-y-4">
              <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight">
                Welcome to the<br />
                Live Voting Session
              </h1>
              <p className="text-xl md:text-2xl text-gray-600 font-light">
                @FtC BA by{" "}
                <a 
                  href="https://logos.co" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-600 underline hover:opacity-80 transition-opacity"
                >
                  Logos
                </a>
                {" "}and{" "}
                <a 
                  href="https://free.technology" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-600 underline hover:opacity-80 transition-opacity"
                >
                  IFT
                </a>
              </p>
            </div>
            
            <div className="space-y-6 text-lg text-gray-700">
              <div className="space-y-3">
                <p className="text-xl">
                  Throughout this session you'll be using this single-use Privy wallet:
                </p>
                
                {ethereumWallet ? (
                  <button
                    onClick={copyAddress}
                    className="font-mono text-sm md:text-base text-gray-900 break-all px-4 py-2 bg-white/40 backdrop-blur-sm rounded-xl hover:bg-white/60 transition-all cursor-pointer w-full"
                    title="Click to copy address"
                  >
                    {ethereumWallet.address}
                  </button>
                ) : (
                  <p className="text-sm text-gray-500">
                    Loading wallet...
                  </p>
                )}
              </div>
              
              <p className="text-lg text-gray-600">
                The workshop runs on{" "}
                <a 
                  href="https://status.network" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="font-semibold text-gray-900 underline hover:opacity-80 transition-opacity"
                >
                  Status Network
                </a>
                {" "}(Sepolia), a gasless chain by IFT.
              </p>
            </div>

            <div className="pt-8">
              <button 
                onClick={handleRegister}
                disabled={isRegistering || !ethereumWallet}
                className="bg-gray-900 text-white border-2 border-gray-900 px-8 py-4 rounded-full text-lg font-medium transition-all duration-300 hover:bg-transparent hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRegistering ? "Registering..." : "Get Your Participant ID"}
              </button>
            </div>
          </div>
        </main>
      </div>
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
    </>
  );
}

export default Home;
