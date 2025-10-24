"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { showSuccessToast } from "./custom-toast";

export function Header() {
  const { authenticated, logout } = usePrivy();
  const { wallets } = useWallets();
  const pathname = usePathname();
  const [copied, setCopied] = useState(false);

  const ethereumWallet = wallets.find((wallet) => wallet.walletClientType === "privy");

  const abbreviateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

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
    <header className="h-[60px] flex flex-row justify-between items-center px-4 md:px-6 border-b bg-gray-200 border-gray-300">
      <div className="flex flex-row items-center gap-2 flex-shrink-0">
        <h1 className="text-sm md:text-base font-semibold text-gray-800">
          <span className="hidden sm:inline">FtC BA: Live Voting Session</span>
          <span className="sm:hidden">FtC Workshop</span>
        </h1>
      </div>

      <nav className="flex flex-row items-center gap-6 md:gap-8">
        <Link
          href="/"
          className={`text-sm font-medium transition-colors duration-200 cursor-pointer ${
            pathname === "/" 
              ? "text-gray-900" 
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Home
        </Link>
        <Link
          href="/cheatsheet"
          className={`text-sm font-medium transition-colors duration-200 cursor-pointer ${
            pathname === "/cheatsheet" 
              ? "text-gray-900" 
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Cheatsheet
        </Link>
      </nav>

      {authenticated && ethereumWallet && (
        <div className="flex flex-row justify-end items-center gap-3 md:gap-4 flex-shrink-0">
          <button
            onClick={copyAddress}
            className="font-mono text-xs md:text-sm text-gray-700 px-3 py-1.5 bg-white/60 rounded-lg hover:bg-white/90 transition-all duration-200 cursor-pointer"
            title="Click to copy full address"
          >
            {abbreviateAddress(ethereumWallet.address)}
          </button>
          <button 
            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors duration-200 cursor-pointer" 
            onClick={logout}
          >
            Logout
          </button>
        </div>
      )}
      
      {!authenticated && <div className="w-[100px] flex-shrink-0" />}
    </header>
  );
}
