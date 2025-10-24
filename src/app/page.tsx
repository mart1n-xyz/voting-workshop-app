"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { ToastContainer } from "react-toastify";
import { useState } from "react";
import { Header } from "@/components/ui/header";
import { FullScreenLoader } from "@/components/ui/fullscreen-loader";
import { showSuccessToast } from "@/components/ui/custom-toast";

function Home() {
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const [copied, setCopied] = useState(false);

  if (!ready) {
    return <FullScreenLoader />;
  }

  if (!authenticated) {
    return (
      <>
        <section className="w-full flex flex-row justify-center items-center h-screen bg-gray-100">
          <div className="flex flex-col items-center justify-center w-full h-full space-y-8">
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
              <button className="bg-gray-900 text-white border-2 border-gray-900 px-8 py-4 rounded-full text-lg font-medium transition-all duration-300 hover:bg-transparent hover:text-gray-900">
                Get Started
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
