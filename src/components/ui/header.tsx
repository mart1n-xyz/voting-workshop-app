"use client";

import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Header() {
  const { authenticated, logout } = usePrivy();
  const pathname = usePathname();

  return (
    <header className="h-[60px] flex flex-row justify-between items-center px-4 md:px-6 border-b bg-white border-[#E2E3F0]">
      <div className="flex flex-row items-center gap-2 h-[26px] flex-shrink-0">
        <h1 className="text-sm md:text-lg font-semibold text-gray-900">
          <span className="hidden sm:inline">FtC Workshop: Live Voting App</span>
          <span className="sm:hidden">FtC Workshop</span>
        </h1>
      </div>

      <nav className="flex flex-row items-center gap-4 md:gap-6">
        <Link
          href="/"
          className={`text-sm md:text-base font-medium transition-colors hover:text-primary ${
            pathname === "/" ? "text-primary" : "text-gray-600"
          }`}
        >
          Home
        </Link>
        <Link
          href="/cheatsheet"
          className={`text-sm md:text-base font-medium transition-colors hover:text-primary ${
            pathname === "/cheatsheet" ? "text-primary" : "text-gray-600"
          }`}
        >
          Cheatsheet
        </Link>
      </nav>

      {authenticated && (
        <div className="flex flex-row justify-end items-center gap-4 h-9 flex-shrink-0">
          <button className="button text-sm md:text-base" onClick={logout}>
            Logout
          </button>
        </div>
      )}
      
      {!authenticated && <div className="w-[100px] flex-shrink-0" />}
    </header>
  );
}
