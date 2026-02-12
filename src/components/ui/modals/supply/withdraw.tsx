"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useOperate } from "@/hooks/useOperate";
import { createCloseAccountInstruction, getAssociatedTokenAddressSync, NATIVE_MINT } from "@solana/spl-token";

interface WithdrawModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vaultId: number;
  positionId: number;
  tokenIcon?: string;
  tokenAlt?: string;
  tokenSymbol?: string;
  suppliedAmount?: string;
  suppliedAmountFiat?: string;
  borrowedAmount?: string;
  borrowedAmountFiat?: string;
}

export const WithdrawModal = ({
  open,
  onOpenChange,
  vaultId,
  positionId,
  tokenIcon = "https://cdn.instadapp.io/icons/jupiter/tokens/sol.png",
  tokenAlt = "SOL",
  tokenSymbol = "SOL",
  suppliedAmount = "14.14 SOL",
  suppliedAmountFiat = "$1,769.27",
  borrowedAmount = "0.00 USDC",
  borrowedAmountFiat = "$0.00",
}: WithdrawModalProps) => {
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [riskPercentage, setRiskPercentage] = useState(0);
  const { connected, publicKey } = useWallet();
  const { operate } = useOperate(vaultId, positionId);

  const handleHalf = () => {
    const balance = parseFloat(suppliedAmount.split(" ")[0]);
    setWithdrawAmount((balance / 2).toFixed(8));
    setRiskPercentage(0);
  };

  const handleMax = () => {
    const balance = suppliedAmount.split(" ")[0];
    setWithdrawAmount(balance);
    setRiskPercentage(0);
  };

  const handleWithdrawAmountChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;
    setWithdrawAmount(value);
    setRiskPercentage(0);
  };

  const getRiskStatus = () => {
    if (riskPercentage < 50)
      return {
        text: "Safe",
        color: "text-emerald-400",
        bgColor: "bg-emerald-400/20",
        progressColor: "bg-emerald",
      };
    if (riskPercentage < 80)
      return {
        text: "Risky",
        color: "text-orange-400",
        bgColor: "bg-orange-400/20",
        progressColor: "bg-orange-500",
      };
    return {
      text: "Very Risky",
      color: "text-red-400",
      bgColor: "bg-red-400/20",
      progressColor: "bg-red-500",
    };
  };

  const riskStatus = getRiskStatus();
  const liquidationPrice = "0.00 USDC";
  const dropPercentage = "100%";

  const calculateFiatValue = () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) return "$0.00";
    const tokenValue = parseFloat(
      suppliedAmountFiat.replace("$", "").replace(",", "")
    );
    const tokenAmount = parseFloat(suppliedAmount.split(" ")[0]);
    const withdrawValue =
      (parseFloat(withdrawAmount) / tokenAmount) * tokenValue;
    return `$${withdrawValue.toFixed(5)}`;
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!connected || !publicKey) {
      toast.error("Wallet Not Connected", {
        description:
          "Please connect your wallet to proceed with the withdrawal.",
      });
      return;
    }

    const amount = parseFloat(withdrawAmount);

    if (isNaN(amount)) {
      toast.error("Invalid Amount", {
        description: "Please enter a valid withdrawal amount.",
      });
      return;
    }

    if (amount <= 0) {
      toast.error("Invalid Amount", {
        description: "Withdrawal amount must be greater than 0.",
      });
      return;
    }

    const availableBalance = parseFloat(suppliedAmount.split(" ")[0]);
    if (amount > availableBalance) {
      toast.error("Insufficient Collateral", {
        description: `You cannot withdraw more than your supplied collateral of ${availableBalance} ${tokenSymbol}.`,
      });
      return;
    }

    try {
      toast.info("Processing Withdrawal", {
        description: "Please confirm the transaction in your wallet...",
      });

      const wsolAccount = getAssociatedTokenAddressSync(NATIVE_MINT, publicKey);
      const postInstructions = [];

      postInstructions.push(
        createCloseAccountInstruction(
          wsolAccount,
          publicKey, // destination for sol to reach
          publicKey // authority
        )
      );

      const amountInLamports = Math.floor(amount * 1e9);

      // For Withdraw: col_amount < 0, debt_amount = 0
      const txid = await operate(-amountInLamports, 0, postInstructions);

      toast.success("Withdrawal Successful!", {
        description: `Successfully withdrew ${amount.toFixed(
          6
        )} ${tokenSymbol}. Transaction: ${txid}`,
        duration: 5000,
      });
      setWithdrawAmount("");
      onOpenChange(false);
    } catch (error) {
      toast.error("Transaction Failed", {
        description:
          error instanceof Error
            ? error.message
            : "Something went wrong while processing your withdrawal. Please try again.",
      });
      console.error("Withdraw error:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md bg-[#0B121A] border border-[#19242e] text-neutral-200 p-0"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Withdraw</DialogTitle>
        <h2 className="text-base font-semibold leading-none text-neutral-200 flex items-center justify-between border-b border-b-neutral-850 p-4">
          <span className="capitalize">Withdraw</span>
          <DialogClose className="flex items-center justify-center rounded-lg p-2 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-primary">
            <svg
              width="16"
              height="16"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M2.0336 16.2126L8.2336 10.0126L2.0336 3.81263C1.7961 3.57903 1.66172 3.25951 1.66016 2.92669C1.65938 2.59309 1.79141 2.27357 2.02734 2.03763C2.26328 1.80247 2.5828 1.67045 2.9164 1.67201C3.25 1.67357 3.56874 1.80795 3.80234 2.04623L9.99994 8.24623L16.1999 2.04623C16.4335 1.80795 16.7523 1.67357 17.0859 1.67201C17.4187 1.67045 17.739 1.80248 17.9749 2.03763C18.2109 2.27357 18.3429 2.59309 18.3413 2.92669C18.3406 3.25951 18.2062 3.57903 17.9687 3.81263L11.7663 10.0126L17.9663 16.2126C18.2038 16.4462 18.3382 16.7658 18.3397 17.0986C18.3405 17.4322 18.2085 17.7517 17.9725 17.9876C17.7366 18.2228 17.4171 18.3548 17.0835 18.3533C16.7499 18.3517 16.4311 18.2173 16.1975 17.979L9.99994 11.779L3.79994 17.979C3.31088 18.4611 2.52494 18.4579 2.039 17.9736C1.55384 17.4884 1.54994 16.7025 2.03119 16.2126L2.0336 16.2126Z"
                fill="currentColor"
              ></path>
            </svg>
          </DialogClose>
        </h2>

        <form className="flex flex-col gap-4" onSubmit={handleWithdraw}>
          <div className="flex flex-col gap-2 p-4">
            <div className="grid grid-cols-2 rounded-xl border border-neutral-850 bg-neutral-925/75 p-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-neutral-400">Supplied</span>
                <div className="flex flex-col text-lg">
                  <span className="font-semibold text-neutral-200">
                    <span className="relative inline-flex items-center rounded-sm">
                      <span translate="no">{suppliedAmount}</span>
                    </span>
                  </span>
                  <span className="relative inline-flex items-center rounded-sm text-xs text-neutral-500">
                    <span translate="no">{suppliedAmountFiat}</span>
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-neutral-400">Borrowed</span>
                <div className="flex flex-col text-lg">
                  <span className="font-semibold text-neutral-200">
                    <span className="relative inline-flex items-center rounded-sm">
                      <span translate="no">{borrowedAmount}</span>
                    </span>
                  </span>
                  <span className="relative inline-flex items-center rounded-sm text-xs text-neutral-500">
                    <span translate="no">{borrowedAmountFiat}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col overflow-hidden rounded-xl border border-neutral-800 focus-within:shadow-swap-input-dark focus-within:ring-1 focus-within:ring-primary/50">
              <div className="flex flex-col gap-3 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm/5 text-neutral-200">Withdraw</span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-xs text-neutral-400">
                      <span className="iconify ph--wallet-light"></span>
                      <span className="relative inline-flex items-center rounded-sm">
                        <span translate="no">{suppliedAmount}</span>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleHalf}
                      className="rounded-md bg-neutral-800 px-2 py-1 text-[10px] font-medium leading-4 text-neutral-400 hover:text-primary hover:ring-1 hover:ring-primary"
                    >
                      HALF
                    </button>
                    <button
                      type="button"
                      onClick={handleMax}
                      className="rounded-md bg-neutral-800 px-2 py-1 text-[10px] font-medium leading-4 text-neutral-400 hover:text-primary hover:ring-1 hover:ring-primary"
                    >
                      MAX
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex w-fit shrink-0 items-center justify-between gap-2.5 rounded-xl border border-neutral-850 bg-neutral-850 p-3">
                    <Image
                      src={tokenIcon}
                      alt={tokenAlt}
                      width={24}
                      height={24}
                      className="h-6 w-6"
                    />
                    <span className="text-sm/5 font-semibold">
                      {tokenSymbol}
                    </span>
                  </div>
                  <div className="ml-auto flex flex-col text-right">
                    <input
                      inputMode="decimal"
                      autoComplete="off"
                      name="amount"
                      data-lpignore="true"
                      placeholder="0.00"
                      value={withdrawAmount}
                      onChange={handleWithdrawAmountChange}
                      className="size-full w-full bg-transparent text-right text-3xl! font-semibold outline-none placeholder:text-neutral-600 disabled:cursor-not-allowed disabled:text-neutral-500 disabled:opacity-100"
                      type="text"
                    />
                    <span className="text-sm/5 text-neutral-400">
                      <span className="relative inline-flex items-center rounded-sm">
                        <span translate="no">{calculateFiatValue()}</span>
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-y border-neutral-850 p-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between font-semibold">
                <span className="text-neutral-200">{riskPercentage}%</span>
                <span className={riskStatus.color}>{riskStatus.text}</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div
                  role="progressbar"
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={riskPercentage}
                  aria-valuetext={`${riskPercentage}%`}
                  data-state="loading"
                  data-value={riskPercentage}
                  data-max={100}
                  className={`relative h-1.5 w-full overflow-hidden rounded-xl ${riskStatus.bgColor}`}
                  style={{ transform: "translateY(0px)" }}
                >
                  <div
                    data-state="loading"
                    data-value={riskPercentage}
                    data-max={100}
                    className={`h-full w-full ${riskStatus.progressColor}`}
                    style={{
                      transform: `translateX(-${100 - riskPercentage}%)`,
                    }}
                  />
                </div>
                <span className="ml-auto text-xs text-neutral-500">
                  Max: L.T. 80%
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 p-4 pt-0">
            <div className="flex w-full items-start gap-2 text-xs text-neutral-500">
              <span
                className="iconify ph--question-bold"
                style={{ height: "1lh", width: "1lh" }}
              ></span>
              <span>
                If {tokenSymbol} reaches{" "}
                <span className="relative inline-flex items-center rounded-sm">
                  <span translate="no">{liquidationPrice}</span>
                </span>{" "}
                (drops by {dropPercentage}%), your position may be partially
                liquidated
              </span>
            </div>
            {!connected && (
              <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-xs text-yellow-400">
                <span
                  className="iconify ph--warning"
                  style={{ height: "1lh", width: "1lh" }}
                ></span>
                <p>
                  Please connect your wallet to proceed with the withdrawal.
                </p>
              </div>
            )}
            <button
              type="submit"
              disabled={
                !withdrawAmount || parseFloat(withdrawAmount) <= 0 || !connected
              }
              className="inline-flex items-center justify-center gap-1.5 font-medium transition-colors focus:outline-none focus:ring-1 disabled:pointer-events-none disabled:opacity-50 bg-primary text-neutral-950 hover:bg-primary-300 focus:ring-primary-300 px-6 py-3 text-sm rounded-xl"
            >
              <span className="pointer-events-auto inline-flex empty:hidden"></span>
              <span className="contents truncate">
                {!connected ? "Connect Wallet" : "Withdraw"}
              </span>
              <span className="pointer-events-auto inline-flex empty:hidden"></span>
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
