"use client";

import { usePrivy } from "@privy-io/react-auth";
import { ToastContainer } from "react-toastify";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { FullScreenLoader } from "@/components/ui/fullscreen-loader";
import { Header } from "@/components/ui/header";
import CreateAWallet from "@/components/sections/create-a-wallet";
import UserObject from "@/components/sections/user-object";
import FundWallet from "@/components/sections/fund-wallet";
import LinkAccounts from "@/components/sections/link-accounts";
import UnlinkAccounts from "@/components/sections/unlink-accounts";
import WalletActions from "@/components/sections/wallet-actions";
import SessionSigners from "@/components/sections/session-signers";
import WalletManagement from "@/components/sections/wallet-management";
import MFA from "@/components/sections/mfa";

function Cheatsheet() {
  const { ready, authenticated, logout } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (ready && !authenticated) {
      router.push("/");
    }
  }, [ready, authenticated, router]);

  if (!ready) {
    return <FullScreenLoader />;
  }

  if (!authenticated) {
    return <FullScreenLoader />;
  }

  return (
    <div className="bg-[#E0E7FF66] md:max-h-[100vh] md:overflow-hidden">
      <Header />
      <section className="w-full flex flex-col md:flex-row md:h-[calc(100vh-60px)]">
        <div className="flex-grow overflow-y-auto h-full p-4 pl-8">
          <button className="button" onClick={logout}>
            Logout
          </button>

          <div>
            <CreateAWallet />
            <FundWallet />
            <LinkAccounts />
            <UnlinkAccounts />
            <WalletActions />
            <SessionSigners />
            <WalletManagement />
            <MFA />
          </div>
        </div>
        <UserObject />
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
        style={{ top: 58 }}
      />
    </div>
  );
}

export default Cheatsheet;

