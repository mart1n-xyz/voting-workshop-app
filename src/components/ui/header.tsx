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
    <header className="h-[60px] flex flex-row justify-between items-center px-4 md:px-6 bg-gray-100 relative overflow-hidden">
      {/* Dot-dash lines background */}
      <div className="absolute inset-0 w-full h-full pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute w-full h-[2px]"
            style={{
              top: `${i * 12.5}%`,
              left: i % 2 === 0 ? '0' : '10.5px',
              backgroundImage: 'repeating-linear-gradient(90deg, #D1D5DB 0px, #D1D5DB 3px, transparent 3px, transparent 7px, #D1D5DB 7px, #D1D5DB 17px, transparent 17px, transparent 21px)',
            }}
          />
        ))}
      </div>
      
      <div className="hidden sm:flex flex-row items-center gap-2 flex-shrink-0 relative z-10">
        <h1 className="text-sm md:text-base font-semibold text-gray-800 inline-block">
          <span className="bg-gray-100 px-2 py-0.5">FtC BA: Live Voting Session</span>
        </h1>
      </div>

      <nav className="flex flex-row items-center gap-3 sm:gap-4 md:gap-6 relative z-10">
        <Link
          href="/"
          className={`text-sm font-medium transition-colors duration-200 cursor-pointer bg-gray-100 px-2 py-1 ${
            pathname === "/" 
              ? "text-gray-900" 
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Home
        </Link>
        <Link
          href="/prizes"
          className={`text-sm font-medium transition-colors duration-200 cursor-pointer bg-gray-100 px-2 py-1 ${
            pathname === "/prizes" 
              ? "text-gray-900" 
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Prizes
        </Link>
        <Link
          href="/cheatsheet"
          className={`text-sm font-medium transition-colors duration-200 cursor-pointer bg-gray-100 px-2 py-1 ${
            pathname === "/cheatsheet" 
              ? "text-gray-900" 
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Cheatsheet
        </Link>
      </nav>

      {authenticated && ethereumWallet && (
        <div className="flex flex-row justify-end items-center gap-2 md:gap-4 flex-shrink-0 relative z-10">
          <button
            onClick={copyAddress}
            className="hidden sm:block font-mono text-xs text-gray-700 px-2 py-1.5 bg-white/60 rounded-lg hover:bg-white/90 transition-all duration-200 cursor-pointer"
            title="Click to copy full address"
          >
            {abbreviateAddress(ethereumWallet.address)}
          </button>
          <button 
            className="text-xs sm:text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors duration-200 cursor-pointer bg-gray-100 px-2 py-1" 
            onClick={logout}
          >
            Logout
          </button>
        </div>
      )}
      
      {!authenticated && <div className="hidden sm:block w-[100px] flex-shrink-0 relative z-10" />}
    </header>
  );
}
