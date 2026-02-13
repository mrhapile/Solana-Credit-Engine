"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { useOperate } from "@/hooks/useOperate";
import { SimulationPreview } from "@/components/ui/transactions/SimulationPreview";
import { TransactionExplorer } from "@/components/ui/transactions/TransactionExplorer";
import { calculateProjectedRisk, getRiskColor, RiskMetrics } from "@/engine/risk";
import { SOL_DECIMALS, USDC_DECIMALS, SOL_MINT, USDC_MINT, LIQUIDATION_THRESHOLDS } from "@/engine/constants";
import { usePosition } from "@/hooks/usePosition";
import { useSolPrice } from "@/hooks/useSolPrice";
import { getConnection, getMintDecimals } from "@/lib/solana"; // Assuming getMintDecimals

interface BorrowModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vaultId: number;
  positionId: number;
  tokenIcon?: string;
  tokenAlt?: string;
  tokenSymbol?: string;
  tokenBalance?: string;
  tokenBalanceFiat?: string;
  borrowedAmount?: string;
  borrowedAmountFiat?: string;
  suppliedAmount?: string;
  suppliedAmountFiat?: string;
}

export const BorrowModal = ({
  open,
  onOpenChange,
  vaultId,
  positionId,
  tokenIcon = "https://cdn.instadapp.io/icons/jupiter/tokens/usdc.png",
  tokenAlt = "USDC",
  tokenSymbol = "USDC",
  tokenBalance = "0.00 USDC",
  borrowedAmount = "0.00 USDC",
  borrowedAmountFiat = "$0.00",
  suppliedAmount = "14.14 SOL", // Visual prop only
  suppliedAmountFiat = "$1,770.02",
}: BorrowModalProps) => {
  const [borrowAmount, setBorrowAmount] = useState("");
  // const [riskPercentage, setRiskPercentage] = useState(0); // Derived from metrics

  const queryClient = useQueryClient();
  const { connected, publicKey } = useWallet();
  const { operate, simulate, state: txState, reset: txReset } = useOperate(vaultId, positionId);

  const isProcessing =
    txState.status === 'building' ||
    txState.status === 'simulating' ||
    txState.status === 'optimizing' ||
    txState.status === 'sending' ||
    txState.status === 'confirming' ||
    txState.status === 'awaiting_signature';

  // Pause polling if transaction is active
  const { position } = usePosition(vaultId, positionId, { paused: isProcessing });
  const { price: solPrice, loading: priceLoading } = useSolPrice();

  const [decimals, setDecimals] = useState(6); // Default USDC assumption
  const [showPreview, setShowPreview] = useState(false);

  // Fetch mint decimals for BORROW asset (USDC usually)
  useEffect(() => {
    (async () => {
      try {
        const conn = getConnection();
        // Assuming borrowing USDC_MINT for now as per defaults
        const mintDecimals = await getMintDecimals(conn, new PublicKey(USDC_MINT));
        setDecimals(mintDecimals);
      } catch (e) { console.error(e); }
    })();
  }, []);

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) {
      setTimeout(() => {
        setBorrowAmount("");
        txReset();
        setShowPreview(false);
      }, 300);
    }
  };

  // Calculate Risk Metrics
  const riskMetrics = React.useMemo(() => {
    if (!position || !solPrice) return null;

    const amount = parseFloat(borrowAmount);
    return calculateProjectedRisk({
      currentCollateralAmount: position.colRaw,
      currentDebtAmount: position.debtRaw,
      collateralDecimals: SOL_DECIMALS, // Assuming collateral is always SOL for this vault
      debtDecimals: decimals,
      collateralPrice: solPrice,
      debtPrice: 1, // USDC
      liquidationThreshold: LIQUIDATION_THRESHOLDS[SOL_MINT] || 0.8,
      operation: 'borrow',
      amount: isNaN(amount) ? 0 : amount
    });
  }, [position, solPrice, borrowAmount, decimals]);

  // Derived LTV % for slider
  // If we have position data, we can be accurate.
  // suppliedAmountFiat prop is a fallback proxy, but we prefer `position`.
  const currentCollateralVal = position && solPrice ? (position.colRaw.toNumber() / 1e9) * solPrice : 0;

  // Slider controls LTV (Debt / Collateral).
  // We want to update borrowAmount based on LTV.
  // TargetDebt = CollateralVal * (LTV/100).
  // BorrowAmount = TargetDebt - CurrentDebt.

  const handlePercentage = (percent: number) => {
    const cappedPercent = Math.min(80, percent); // Cap at 80 for safety (LT)

    if (!currentCollateralVal || currentCollateralVal <= 0) return;

    // Calculate Target Debt Value
    const targetDebtVal = currentCollateralVal * (cappedPercent / 100);

    // Current Debt Value
    const currentDebtVal = position ? (position.debtRaw.toNumber() / Math.pow(10, decimals)) : 0;

    // Amount to borrow = Target - Current
    const amountToBorrow = Math.max(0, targetDebtVal - currentDebtVal);

    setBorrowAmount(amountToBorrow.toFixed(2));
  };

  // Current LTV for Slider display
  const sliderValue = riskMetrics ? Math.min(100, riskMetrics.projectedLTV * 100) : 0;

  const handleBorrowAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setBorrowAmount(value);
  };

  const getRiskStatus = () => {
    if (!riskMetrics) return { text: "-", color: "text-neutral-500", bgColor: "bg-neutral-800", progressColor: "bg-neutral-500", strokeColor: "stroke-neutral-500" };
    switch (riskMetrics.riskLevel) {
      case "safe":
        return { text: "Safe", color: "text-emerald-400", bgColor: "bg-emerald-400/20", progressColor: "bg-emerald-500", strokeColor: "stroke-emerald-500" };
      case "moderate":
        return { text: "Moderate", color: "text-yellow-400", bgColor: "bg-yellow-400/20", progressColor: "bg-yellow-500", strokeColor: "stroke-yellow-500" };
      case "high":
        return { text: "High Risk", color: "text-orange-500", bgColor: "bg-orange-500/20", progressColor: "bg-orange-500", strokeColor: "stroke-orange-500" };
      case "liquidation":
        return { text: "Liquidation Risk", color: "text-red-500", bgColor: "bg-red-500/20", progressColor: "bg-red-500", strokeColor: "stroke-red-500" };
    }
  };

  const riskStatus = getRiskStatus();
  const liquidationPriceStr = riskMetrics ? `$${riskMetrics.liquidationPrice.toFixed(2)}` : "$0.00";
  const dropPercentageStr = riskMetrics ? `${riskMetrics.percentDropToLiquidation.toFixed(1)}%` : "0%";

  const calculateFiatValue = () => {
    if (!borrowAmount || parseFloat(borrowAmount) <= 0) return "$0.00";
    return `$${parseFloat(borrowAmount).toFixed(2)}`;
  };

  const handleInitialClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!connected || !publicKey) {
      toast.error("Wallet Not Connected");
      return;
    }
    const amount = parseFloat(borrowAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Invalid Amount");
      return;
    }
    triggerSimulation();
  };

  const triggerSimulation = async () => {
    const amount = parseFloat(borrowAmount);
    // Borrow: col=0, debt=amount
    await simulate(0, amount);
    setShowPreview(true);
  };

  const handleConfirmBorrow = async () => {
    const amount = parseFloat(borrowAmount);
    await operate(0, amount);
    queryClient.invalidateQueries({ queryKey: ['position', vaultId, positionId] });
    setShowPreview(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-md bg-[#0B121A] border border-[#19242e] text-neutral-200 p-0"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Borrow</DialogTitle>
        <h2 className="text-base font-semibold leading-none text-neutral-200 flex items-center justify-between border-b border-b-neutral-850 p-4">
          <span className="capitalize">Borrow</span>
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

        <form className="flex flex-col gap-4" onSubmit={handleInitialClick}>

          <div className="flex flex-col gap-2 p-4">
            {/* Supply/Borrow Info */}
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
                  <span className="text-sm/5 text-neutral-200">Borrow</span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-xs text-neutral-400">
                      <span className="iconify ph--wallet-light"></span>
                      <span className="relative inline-flex items-center rounded-sm">
                        <span translate="no">{tokenBalance}</span>
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  {/* Token Icon */}
                  <div className="flex w-fit shrink-0 items-center justify-between gap-2.5 rounded-xl border border-neutral-850 bg-neutral-850 p-3">
                    <Image
                      className="h-6 w-6"
                      height={32}
                      width={32}
                      alt={tokenAlt}
                      src={tokenIcon}
                    />
                    <span className="text-sm/5 font-semibold">
                      {tokenSymbol}
                    </span>
                  </div>
                  {/* Input */}
                  <div className="ml-auto flex flex-col text-right">
                    <input
                      inputMode="decimal"
                      autoComplete="off"
                      name="amount"
                      data-lpignore="true"
                      placeholder="0.00"
                      className="size-full w-full bg-transparent text-right text-3xl! font-semibold outline-none placeholder:text-neutral-600 disabled:cursor-not-allowed disabled:text-neutral-500 disabled:opacity-100"
                      type="text"
                      value={borrowAmount}
                      onChange={handleBorrowAmountChange}
                    />
                    <span className="text-sm/5 text-neutral-400">
                      <span className="relative inline-flex items-center rounded-sm text-neutral-600">
                        <span translate="no">{calculateFiatValue()}</span>
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-y border-neutral-850 p-4">
            {/* Slider & Risk */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between font-semibold">
                {/* Current Projected LTV display instead of just "Status" */}
                <span className="text-xs text-neutral-400">Current LTV: {(riskMetrics ? riskMetrics.currentLTV * 100 : 0).toFixed(1)}%</span>
                <div className="flex items-center gap-2">
                  <span className={riskStatus.color}>{riskStatus.text}</span>
                  <span className="text-neutral-200">{sliderValue.toFixed(1)}% LTV</span>
                </div>
              </div>

              <div className="relative flex w-full flex-col items-center gap-2">
                <div className="w-full">
                  <Slider
                    value={sliderValue}
                    onChange={handlePercentage}
                    riskStatus={riskStatus}
                    className="z-10"
                  />
                  {/* Ticks */}
                  <div
                    className="relative mb-4 w-full"
                    style={{ transform: "translateY(-18px)" }}
                  >
                    {[0, 25, 50, 75].map((tick) => (
                      <div
                        key={tick}
                        className="absolute top-0 text-center"
                        style={{ left: `${tick}%`, transform: "translateX(-50%)" }}
                      >
                        <button
                          type="button"
                          className="flex flex-col items-center gap-2"
                          onClick={() => handlePercentage(tick)}
                        >
                          <div className={`h-4 w-[3px] rounded-2xl ${tick === 0 ? 'bg-emerald scale-125' : 'bg-neutral-750'}`}></div>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <span className="ml-auto text-xs text-neutral-500">
                  Liquidation at 80% LTV
                </span>
              </div>

              {/* Projection Details */}
              {riskMetrics && (
                <div className="grid grid-cols-2 gap-4 mt-2 text-xs border-t border-neutral-800 pt-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-neutral-500">Health Factor</span>
                    <div className="flex items-center gap-1">
                      <span className="text-neutral-400">{riskMetrics.currentHF === Infinity ? "∞" : riskMetrics.currentHF.toFixed(2)}</span>
                      <span className="iconify ph--arrow-right text-neutral-600"></span>
                      <span className={`font-semibold ${riskMetrics.projectedHF < 1.1 ? 'text-my-red' : 'text-neutral-200'}`}>
                        {riskMetrics.projectedHF === Infinity ? "∞" : riskMetrics.projectedHF.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 text-right">
                    <span className="text-neutral-500">Liq. Price (SOL)</span>
                    <span className="font-mono text-neutral-200">{liquidationPriceStr}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4 p-4 pt-0">
            {(txState.status !== 'idle' && txState.status !== 'building') && (
              <TransactionExplorer state={txState} />
            )}

            <div className="flex w-full items-start gap-2 text-xs text-neutral-500">
              <span className="iconify ph--question-bold" style={{ height: "1lh", width: "1lh" }}></span>
              <span>
                Based on current market conditions.
                Liquidation occurs if SOL drops to <span className="text-neutral-300">{liquidationPriceStr}</span> ({dropPercentageStr} drop).
              </span>
            </div>
            <button
              disabled={!borrowAmount || parseFloat(borrowAmount) <= 0 || !connected || isProcessing}
              className="inline-flex items-center justify-center gap-1.5 font-medium transition-colors focus:outline-none focus:ring-1 disabled:pointer-events-none disabled:opacity-50 bg-primary text-neutral-950 hover:bg-primary-300 focus:ring-primary-300 px-6 py-3 text-sm rounded-xl"
              type="submit"
            >
              <span className="contents truncate">
                {!connected ? "Connect Wallet" : txState.status === 'idle' || txState.status === 'success' ? "Borrow" : "Processing..."}
              </span>
            </button>
          </div>
        </form>

        <SimulationPreview
          open={showPreview}
          state={txState}
          onConfirm={handleConfirmBorrow}
          onCancel={() => setShowPreview(false)}
        />

      </DialogContent>
    </Dialog>
  );
};
