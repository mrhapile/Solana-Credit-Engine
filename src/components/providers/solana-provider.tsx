"use client";

import { FC, ReactNode, useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";
import "@solana/wallet-adapter-react-ui/styles.css";
import dynamic from "next/dynamic";
import { Button } from "../ui/button";

import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";

interface SolanaProviderProps {
  children: ReactNode;
}

export const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (mod) => mod.WalletMultiButton
    ),
  {
    ssr: false,
    loading: () => {
      return (
        <Button
          variant={"outline"}
          className="cursor-pointer flex h-8 min-w-8 items-center justify-center rounded-full border border-transparent focus-visible:outline focus-visible:outline-primary md:h-9 md:min-w-9 bg-[#c7f2841a] px-3 text-xs font-semibold text-[#c7f284] hover:border-[#c7f284] hover:bg-[#c7f2841a] hover:text-[#c7f284]"
        >
          Select Wallet
        </Button>
      );
    },
  }
);

export const SolanaProvider: FC<SolanaProviderProps> = ({ children }) => {
  const network = WalletAdapterNetwork.Mainnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network }),
    ],
    [network]
  );

  return (
    <ConnectionProvider
      endpoint={endpoint}
      config={{
        commitment: "processed",
        disableRetryOnRateLimit: true
      }}
    >
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
