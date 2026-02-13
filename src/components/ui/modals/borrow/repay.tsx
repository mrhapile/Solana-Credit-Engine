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
import { toast } from "sonner";
import { useOperate } from "@/hooks/useOperate";
import { SimulationPreview } from "@/components/ui/transactions/SimulationPreview";
import { TransactionExplorer } from "@/components/ui/transactions/TransactionExplorer";
import { calculateProjectedRisk, getRiskColor, RiskMetrics } from "@/engine/risk";
import { SOL_DECIMALS, USDC_DECIMALS, SOL_MINT, USDC_MINT, LIQUIDATION_THRESHOLDS } from "@/engine/constants";
import { usePosition } from "@/hooks/usePosition";
import { useSolPrice } from "@/hooks/useSolPrice";
import { getConnection, getMintDecimals } from "@/lib/solana";

interface RepayModalProps {
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
}

export const RepayModal = ({
  open,
  onOpenChange,
  vaultId,
  positionId,
  tokenIcon = "https://cdn.instadapp.io/icons/jupiter/tokens/usdc.png",
  tokenAlt = "USDC",
  tokenSymbol = "USDC",
  tokenBalance = "100.00 USDC", // Available to repay
  tokenBalanceFiat = "$100.00",
  borrowedAmount = "50.00 USDC", // Debt to repay
  borrowedAmountFiat = "$50.00",
}: RepayModalProps) => {
  const [repayAmount, setRepayAmount] = useState("");
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

  const [decimals, setDecimals] = useState(6); // Default USDC
  const [showPreview, setShowPreview] = useState(false);

  // Fetch mint decimals for REPAY asset (USDC usually)
  useEffect(() => {
    (async () => {
      try {
        const conn = getConnection();
        const mintDecimals = await getMintDecimals(conn, new PublicKey(USDC_MINT));
        setDecimals(mintDecimals);
      } catch (e) { console.error(e); }
    })();
  }, []);

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) {
      setTimeout(() => {
        setRepayAmount("");
        txReset();
        setShowPreview(false);
      }, 300);
    }
  };

  const handleHalf = () => {
    // We can repay up to Debt Amount or Wallet Balance, whichever is smaller?
    // Usually "Half" means half of debt? Or half of wallet balance?
    // Let's assume Half of Debt for now based on previous code relying on `borrowedAmount`.
    const debt = parseFloat(borrowedAmount.split(" ")[0]);
    setRepayAmount((debt / 2).toFixed(decimals));
  };

  const handleMax = () => {
    const debt = parseFloat(borrowedAmount.split(" ")[0]);
    setRepayAmount(debt.toFixed(decimals));
  };

  const handleRepayAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setRepayAmount(value);
  };

  const calculateFiatValue = () => {
    if (!repayAmount || parseFloat(repayAmount) <= 0) return "$0.00";
    return `$${parseFloat(repayAmount).toFixed(2)}`;
  };

  // Calculate Risk Metrics
  const riskMetrics = React.useMemo(() => {
    if (!position || !solPrice) return null;

    const amount = parseFloat(repayAmount);
    return calculateProjectedRisk({
      currentCollateralAmount: position.colRaw,
      currentDebtAmount: position.debtRaw,
      collateralDecimals: SOL_DECIMALS, // Collateral is SOL
      debtDecimals: decimals, // Repay asset
      collateralPrice: solPrice,
      debtPrice: 1, // USDC
      liquidationThreshold: LIQUIDATION_THRESHOLDS[SOL_MINT] || 0.8,
      operation: 'repay',
      amount: isNaN(amount) ? 0 : amount
    });
  }, [position, solPrice, repayAmount, decimals]);

  const displayRiskPercentage = riskMetrics ? Math.min(100, Math.round((1 / riskMetrics.projectedHF) * 100)) : 0;

  const getRiskStatus = () => {
    if (!riskMetrics) return { text: "-", color: "text-neutral-500", bgColor: "bg-neutral-800", progressColor: "bg-neutral-500" };
    switch (riskMetrics.riskLevel) {
      case "safe": return { text: "Safe", color: "text-emerald-400", bgColor: "bg-emerald-400/20", progressColor: "bg-emerald-400" };
      case "moderate": return { text: "Moderate", color: "text-yellow-400", bgColor: "bg-yellow-400/20", progressColor: "bg-yellow-400" };
      case "high": return { text: "High Risk", color: "text-orange-500", bgColor: "bg-orange-500/20", progressColor: "bg-orange-500" };
      case "liquidation": return { text: "Liquidation Risk", color: "text-red-500", bgColor: "bg-red-500/20", progressColor: "bg-red-500" };
    }
  };

  const riskStatus = getRiskStatus();
  const liquidationPriceStr = riskMetrics ? `$${riskMetrics.liquidationPrice.toFixed(2)}` : "$0.00";

  const handleInitialClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!connected || !publicKey) {
      toast.error("Wallet Not Connected");
      return;
    }
    const amount = parseFloat(repayAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Invalid Amount");
      return;
    }
    // Check if repay > borrowed
    const borrowedAmountNum = parseFloat(borrowedAmount.split(" ")[0]);
    if (amount > borrowedAmountNum) {
      toast.error("Amount Exceeds Borrowed Debt");
      return;
    }

    triggerSimulation();
  };

  const triggerSimulation = async () => {
    const amount = parseFloat(repayAmount);
    // Repay: col=0, debt=-amount
    await simulate(0, -amount);
    setShowPreview(true);
  };

  const handleConfirmRepay = async () => {
    const amount = parseFloat(repayAmount);
    await operate(0, -amount);
    queryClient.invalidateQueries({ queryKey: ['position', vaultId, positionId] });
    setShowPreview(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-md bg-[#0B121A] border border-[#19242e] text-neutral-200 p-0"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Repay</DialogTitle>
        <h2 className="text-base font-semibold leading-none text-neutral-200 flex items-center justify-between border-b border-b-neutral-850 p-4">
          <span className="capitalize">Repay</span>
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
            {/* Info Block */}
            <div className="grid grid-cols-2 rounded-xl border border-neutral-850 bg-neutral-925/75 p-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-neutral-400">Wallet Balance</span>
                <div className="flex flex-col text-lg">
                  <span className="font-semibold text-neutral-200">
                    <span className="relative inline-flex items-center rounded-sm">
                      <span translate="no">{tokenBalance}</span>
                    </span>
                  </span>
                  <span className="relative inline-flex items-center rounded-sm text-xs text-neutral-500">
                    <span translate="no">{tokenBalanceFiat}</span>
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
                  <span className="text-sm/5 text-neutral-200">Repay</span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-xs text-neutral-400">
                      <span className="iconify ph--wallet-light"></span>
                      <span className="relative inline-flex items-center rounded-sm">
                        <span translate="no">{tokenBalance}</span>
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
                      value={repayAmount}
                      onChange={handleRepayAmountChange}
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
            {/* Risk Section */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between font-semibold">
                <span className="text-neutral-200">{displayRiskPercentage}% Risk</span>
                <span className={riskStatus.color}>{riskStatus.text}</span>
              </div>

              {/* Projection Details */}
              {riskMetrics && (
                <div className="grid grid-cols-2 gap-4 mt-2 text-xs border-t border-neutral-800 pt-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-neutral-500">Health Factor</span>
                    <div className="flex items-center gap-1">
                      <span className="text-neutral-400">{riskMetrics.currentHF === Infinity ? "∞" : riskMetrics.currentHF.toFixed(2)}</span>
                      <span className="iconify ph--arrow-right text-neutral-600"></span>
                      <span className={`font-semibold ${riskMetrics.projectedHF > riskMetrics.currentHF ? 'text-emerald-400' : 'text-neutral-200'}`}>
                        {riskMetrics.projectedHF === Infinity ? "∞" : riskMetrics.projectedHF.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 text-right">
                    <span className="text-neutral-500">LTV</span>
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-neutral-400">{(riskMetrics.currentLTV * 100).toFixed(1)}%</span>
                      <span className="iconify ph--arrow-right text-neutral-600"></span>
                      <span className="font-semibold text-neutral-200">{(riskMetrics.projectedLTV * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4 p-4 pt-0">
            {/* Explorer & Transaction Status */}
            {(txState.status !== 'idle' && txState.status !== 'building') && (
              <TransactionExplorer state={txState} />
            )}

            {!connected && (
              <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-xs text-yellow-400">
                <span
                  className="iconify ph--warning"
                  style={{ height: "1lh", width: "1lh" }}
                ></span>
                <p>Please connect your wallet to proceed with the repayment.</p>
              </div>
            )}
            <button
              type="submit"
              disabled={
                !repayAmount || parseFloat(repayAmount) <= 0 || !connected || isProcessing
              }
              className="inline-flex items-center justify-center gap-1.5 font-medium transition-colors focus:outline-none focus:ring-1 disabled:pointer-events-none disabled:opacity-50 bg-primary text-neutral-950 hover:bg-primary-300 focus:ring-primary-300 px-6 py-3 text-sm rounded-xl"
            >
              <span className="contents truncate">
                {!connected ? "Connect Wallet" : txState.status === 'idle' || txState.status === 'success' ? "Repay" : "Processing..."}
              </span>
            </button>
          </div>
        </form>

        <SimulationPreview
          open={showPreview}
          state={txState}
          onConfirm={handleConfirmRepay}
          onCancel={() => setShowPreview(false)}
        />

      </DialogContent>
    </Dialog>
  );
};
