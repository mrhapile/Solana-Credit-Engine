"use client";

import Image from "next/image";
import React, { useState } from "react";
import { DepositModal } from "@/components/ui/modals/supply/deposit";
import { WithdrawModal } from "@/components/ui/modals/supply/withdraw";
import { BorrowModal } from "@/components/ui/modals/borrow/borrow";
import { RepayModal } from "@/components/ui/modals/borrow/repay";

interface CustomCardProps {
  title: string;
  tokenSymbol: string;
  tokenAmount: number;
  tokenAmountFormatted: string;
  usdValue: number;
  usdValueFormatted: string;
  tokenIcon: string;
  tokenName: string;
  apyFormatted: string;
  type: "collateral" | "debt";
  borrowed: number;
  supplied: number;
  suppliedUsd: number;
  solPrice: number;
  vaultId: number;
  positionId: number;
}

export const CustomCard = ({
  title,
  tokenSymbol,
  tokenAmountFormatted,
  usdValueFormatted,
  tokenIcon,
  tokenName,
  apyFormatted,
  type,
  borrowed,
  supplied,
  suppliedUsd,
  vaultId,
  positionId,
}: CustomCardProps) => {
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [borrowOpen, setBorrowOpen] = useState(false);
  const [repayOpen, setRepayOpen] = useState(false);

  const apyColorClass =
    type === "collateral" ? "text-emerald-400" : "text-orange-400";

  const isSupplyCard = type === "collateral";

  const borrowedAmountFormatted = `${borrowed.toFixed(2)} USDC`;
  const borrowedAmountFiat = `$${borrowed.toFixed(2)}`;

  const amountDisplay = `${tokenAmountFormatted} ${tokenSymbol}`;

  return (
    <div className="overflow-hidden rounded-2xl border border-[#19242e] bg-[#0B121A]">
      <div className="flex items-center justify-between border-b border-neutral-850 p-4">
        <span className="text-xs font-medium text-neutral-200">{title}</span>
      </div>
      <div className="flex items-center justify-between border-b border-neutral-850 p-4">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <Image
            className="size-9 sm:size-10"
            height={32}
            width={32}
            alt={tokenName}
            src={tokenIcon}
          />
          <div className="flex flex-col">
            <span className="text-lg font-semibold text-neutral-200 sm:text-xl">
              <span className="relative items-center rounded-sm inline-block">
                <span translate="no">{amountDisplay}</span>
              </span>
            </span>
            <span className="relative inline-flex items-center rounded-sm text-xs text-neutral-400">
              <span translate="no">{usdValueFormatted}</span>
            </span>
          </div>
        </div>
        <div className="flex flex-col text-right">
          <div className="flex items-center gap-1.5 text-lg font-medium sm:text-xl">
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded="false"
              aria-controls="radix-:rn:"
              data-state="closed"
              className="outline-none"
            >
              <div className="flex items-center gap-1">
                {type === "collateral" && (
                  <div className="flex items-center -space-x-1.5 empty:hidden">
                    <Image
                      className="size-4"
                      height={32}
                      width={32}
                      alt={tokenName}
                      src={tokenIcon}
                    />
                  </div>
                )}
                <span
                  className={`flex underline decoration-dashed decoration-from-font underline-offset-4 ${apyColorClass}`}
                >
                  {apyFormatted}
                </span>
              </div>
            </button>
          </div>
          <button
            type="button"
            className="outline-none inline-flex items-center gap-1 hover:text-neutral-200 ml-auto text-xs text-neutral-400"
            aria-haspopup="dialog"
            aria-expanded="false"
            aria-controls="radix-:ro:"
            data-state="closed"
          >
            <span className="uppercase"> apy</span>
            <span className="iconify inline-block shrink-0 ph--arrows-left-right-bold"></span>
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 p-4 sm:gap-4">
        {isSupplyCard ? (
          <>
            <button
              type="button"
              onClick={() => setDepositOpen(true)}
              className="inline-flex cursor-pointer items-center justify-center gap-1.5 font-medium transition-colors focus:outline-none focus:ring-1 disabled:pointer-events-none disabled:opacity-50 bg-primary text-neutral-950 hover:bg-primary-300 focus:ring-primary-300 px-4 py-2.5 text-xs rounded-lg"
            >
              <span className="inline-flex empty:hidden"></span>
              <span className="contents truncate">Deposit</span>
              <span className="inline-flex empty:hidden"></span>
            </button>
            <button
              type="button"
              onClick={() => setWithdrawOpen(true)}
              className="inline-flex cursor-pointer items-center justify-center gap-1.5 font-medium transition-colors focus:outline-none focus:ring-1 disabled:pointer-events-none disabled:opacity-50 bg-primary/5 text-primary-200 hover:bg-primary/20 focus:ring-primary/10 px-4 py-2.5 text-xs rounded-lg"
            >
              <span className="inline-flex empty:hidden"></span>
              <span className="contents truncate">Withdraw</span>
              <span className="inline-flex empty:hidden"></span>
            </button>
            <DepositModal
              open={depositOpen}
              onOpenChange={setDepositOpen}
              vaultId={vaultId}
              positionId={positionId}
              tokenIcon={tokenIcon}
              tokenAlt={tokenName}
              tokenSymbol={tokenSymbol}
              tokenBalance={amountDisplay}
              tokenBalanceFiat={usdValueFormatted}
              borrowedAmount={borrowedAmountFormatted}
              borrowedAmountFiat={borrowedAmountFiat}
            />
            <WithdrawModal
              open={withdrawOpen}
              onOpenChange={setWithdrawOpen}
              vaultId={vaultId}
              positionId={positionId}
              tokenIcon={tokenIcon}
              tokenAlt={tokenName}
              tokenSymbol={tokenSymbol}
              suppliedAmount={amountDisplay}
              suppliedAmountFiat={usdValueFormatted}
              borrowedAmount={borrowedAmountFormatted}
              borrowedAmountFiat={borrowedAmountFiat}
            />
          </>
        ) : (
          <>
            <button
              className="inline-flex cursor-pointer items-center justify-center gap-1.5 font-medium transition-colors focus:outline-none focus:ring-1 disabled:pointer-events-none disabled:opacity-50 bg-primary text-neutral-950 hover:bg-primary-300 focus:ring-primary-300 px-4 py-2.5 text-xs rounded-lg"
              onClick={() => setBorrowOpen(true)}
            >
              <span className="inline-flex empty:hidden"></span>
              <span className="contents truncate">Borrow</span>
              <span className="inline-flex empty:hidden"></span>
            </button>
            <button
              className="inline-flex cursor-pointer items-center justify-center gap-1.5 font-medium transition-colors focus:outline-none focus:ring-1 disabled:pointer-events-none disabled:opacity-50 bg-primary/5 text-primary-200 hover:bg-primary/20 focus:ring-primary/10 px-4 py-2.5 text-xs rounded-lg"
              onClick={() => setRepayOpen(true)}
            >
              <span className="inline-flex empty:hidden"></span>
              <span className="contents truncate">Repay</span>
              <span className="inline-flex empty:hidden"></span>
            </button>
            <BorrowModal
              open={borrowOpen}
              onOpenChange={setBorrowOpen}
              vaultId={vaultId}
              positionId={positionId}
              tokenIcon={tokenIcon}
              tokenAlt={tokenName}
              tokenSymbol={tokenSymbol}
              tokenBalance="0.00" // Wallet balance not available in props
              tokenBalanceFiat="$0.00"
              borrowedAmount={borrowedAmountFormatted}
              borrowedAmountFiat={borrowedAmountFiat}
              suppliedAmount={`${supplied.toFixed(2)} SOL`}
              suppliedAmountFiat={`$${suppliedUsd.toFixed(2)}`}
            />
            <RepayModal
              open={repayOpen}
              onOpenChange={setRepayOpen}
              vaultId={vaultId}
              positionId={positionId}
              tokenIcon={tokenIcon}
              tokenAlt={tokenName}
              tokenSymbol={tokenSymbol}
              tokenBalance="0.00" // Wallet balance not available in props
              tokenBalanceFiat="$0.00"
              borrowedAmount={borrowedAmountFormatted}
            />
          </>
        )}
      </div>
    </div>
  );
};
