"use client";

import Image from "next/image";
import Link from "next/link";
import { WalletMultiButton } from "../providers/solana-provider";
import { useWallet } from "@solana/wallet-adapter-react";

export const NavBar = () => {
  return (
    <div className="flex h-12.5 w-full items-center justify-between border-b border-neutral-850 px-2.5 xl:h-13 xl:px-5">
      <Link className="flex h-9 items-center pr-1.5 xs:pr-2 sm:pr-2.5" href="/">
        <Image
          alt="Jupiter"
          loading="lazy"
          width="22"
          height="22"
          decoding="async"
          src="/logos/brand-logo.webp"
        />
        <div className="relative ml-2.5 text-sm font-semibold text-neutral-100 max-[1550px]:hidden">
          Jupiter
        </div>
      </Link>
      <div className="items-center text-center! flex! justify-center! h-8! min-w-8!  rounded-full! border! border-transparent!  text-neutral-200! hover:border-neutral-800!  hover:text-neutral-50! focus-visible:outline! focus-visible:outline-primary! md:h-9! md:min-w-9!">
        <WalletMultiButton />
      </div>
    </div>
  );
};
