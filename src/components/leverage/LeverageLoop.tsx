"use client";

import React, { useState, useMemo, useEffect } from "react";
import { usePosition } from "@/hooks/usePosition";
import { useLeverageLoop, LoopStatus } from "@/hooks/useLeverageLoop";
import { useSolPrice } from "@/hooks/useSolPrice";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Loader2, AlertTriangle, CheckCircle2, ArrowRight, Terminal, ShieldAlert, Cpu, Activity, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeverageLoopProps {
    vaultId: number;
    positionId: number;
}

const PIPELINE_STEPS = [
    { id: "deposit", label: "Deposit SOL" },
    { id: "borrow", label: "Borrow USDC" },
    { id: "swap", label: "Swap -> SOL" },
    { id: "redeposit", label: "Re-Deposit" }
];

export function LeverageLoop({ vaultId, positionId }: LeverageLoopProps) {
    const { position } = usePosition(vaultId, positionId);
    const { price: solPrice } = useSolPrice();
    const { state, simulateLoop, confirmLoop, reset } = useLeverageLoop(vaultId, positionId);
    const { connected } = useWallet();

    const [initialDeposit, setInitialDeposit] = useState("0");
    const [borrowAmount, setBorrowAmount] = useState("0");

    // Reset inputs on success/reset
    useEffect(() => {
        if (state.status === "idle") {
            setInitialDeposit("0");
            setBorrowAmount("0");
        }
    }, [state.status]);

    const handleSimulate = () => {
        if (!position || !solPrice) return;
        simulateLoop({
            initialDepositSol: parseFloat(initialDeposit) || 0,
            borrowAmountUsdc: parseFloat(borrowAmount) || 0,
            solPrice,
            currentCollateralRaw: position.colRaw,
            currentDebtRaw: position.debtRaw,
        });
    };

    // ─── Status Logic ──────────────────────────────────────────────
    const isProcessing = ["building", "simulating", "optimizing", "sending", "confirming"].includes(state.status);
    const isError = state.status === "failed";
    const isSuccess = state.status === "success";
    const isPreview = state.status === "previewing";

    // ─── Visual Badges ─────────────────────────────────────────────
    const statusBadge = useMemo(() => {
        if (isError) return { label: "EXECUTION FAILED", color: "text-[#FF3B5C] border-[#FF3B5C]/30 bg-[#FF3B5C]/10" };
        if (isSuccess) return { label: "TRANSACTION CONFIRMED", color: "text-[#00D26A] border-[#00D26A]/30 bg-[#00D26A]/10" };
        if (isProcessing) return { label: "EXECUTING PIPELINE...", color: "text-[#FFB020] border-[#FFB020]/30 bg-[#FFB020]/10 animate-pulse" };
        if (isPreview) return { label: "SIMULATION READY", color: "text-[#00E0FF] border-[#00E0FF]/30 bg-[#00E0FF]/10" };
        return { label: "SYSTEM IDLE", color: "text-slate-500 border-slate-800 bg-slate-900" };
    }, [isError, isSuccess, isProcessing, isPreview]);

    // ─── Risk Calculation ──────────────────────────────────────────
    const currentHF = state.projectedRisk?.projectedHF || 0;
    const riskLevel = currentHF > 1.5 ? "SAFE" : currentHF > 1.1 ? "MODERATE" : "CRITICAL";
    const riskColor = currentHF > 1.5 ? "bg-[#00D26A]" : currentHF > 1.1 ? "bg-[#FFB020]" : "bg-[#FF3B5C]";

    // Gradient for Risk Bar (Green -> Yellow -> Red)
    // We mask it with a container height
    const riskHeight = Math.min(Math.max((currentHF - 1) * 100, 10), 100);

    return (
        <div className="w-full rounded-xl border border-[#1E293B] bg-[#0B0F14] overflow-hidden shadow-2xl relative font-sans">
            {/* ─── 1. Header Strip ────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E293B] bg-[#0F141C]">
                <div>
                    <div className="flex items-center gap-2">
                        <Terminal className="h-5 w-5 text-[#00E0FF]" />
                        <h2 className="text-lg font-bold text-slate-100 tracking-tight">LEVERAGE LOOP</h2>
                    </div>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5 uppercase tracking-wider">
                        Atomic 4-step execution pipeline
                    </p>
                </div>
                <div className={cn("px-3 py-1 rounded border text-[10px] font-mono font-bold tracking-widest", statusBadge.color)}>
                    {statusBadge.label}
                </div>
            </div>

            {/* ─── 2. Execution Pipeline Visual ───────────────────────────────────── */}
            <div className="relative px-6 py-8 border-b border-[#1E293B] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0B0F14] to-[#0B0F14]">
                <div className="grid grid-cols-4 gap-2 relative z-10">
                    {PIPELINE_STEPS.map((step, idx) => {
                        const isActive = isProcessing || isSuccess || isPreview;
                        // Simple logic for visualization: Highlight all if active, or pulse if processing
                        const isStepActive = isActive && !isError;

                        return (
                            <div
                                key={step.id}
                                className={cn(
                                    "relative h-12 flex items-center justify-center rounded border transition-all duration-500",
                                    isStepActive
                                        ? "border-[#00E0FF]/40 bg-[#00E0FF]/5 text-[#00E0FF] shadow-[0_0_15px_rgba(0,224,255,0.1)]"
                                        : "border-[#1E293B] bg-[#0F141C] text-slate-600"
                                )}
                            >
                                <span className="text-[10px] font-mono font-bold uppercase tracking-widest z-10">
                                    {step.label}
                                </span>
                                {/* Connecting Arrow (Except last) */}
                                {idx < 3 && (
                                    <div className="absolute -right-3 top-1/2 -translate-y-1/2 text-slate-700 z-0">
                                        <ArrowRight className="h-3 w-3" />
                                    </div>
                                )}
                                {/* Active Scan Line */}
                                {isProcessing && (
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#00E0FF]/10 to-transparent animate-[shimmer_2s_infinite]" />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 min-h-[200px]">
                {/* ─── 3. Left Control Panel (Inputs) ────────────────────────────── */}
                <div className="md:col-span-7 p-6 border-r border-[#1E293B] space-y-6">
                    <div className="space-y-4">
                        {/* Deposit Input */}
                        <div className="space-y-2">
                            <label className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                <span>Initial Deposit</span>
                                <span className="text-slate-400">SOL</span>
                            </label>
                            <div className="relative group">
                                <input
                                    type="number"
                                    value={initialDeposit}
                                    onChange={(e) => setInitialDeposit(e.target.value)}
                                    disabled={state.status !== "idle"}
                                    className="w-full bg-[#0F141C] border border-[#1E293B] text-slate-100 text-sm font-mono p-3 pl-4 rounded focus:outline-none focus:border-[#00E0FF] transition-colors disabled:opacity-50"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        {/* Borrow Input */}
                        <div className="space-y-2">
                            <label className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                <span>Borrow Target</span>
                                <span className="text-slate-400">USDC</span>
                            </label>
                            <div className="relative group">
                                <input
                                    type="number"
                                    value={borrowAmount}
                                    onChange={(e) => setBorrowAmount(e.target.value)}
                                    disabled={state.status !== "idle"}
                                    className="w-full bg-[#0F141C] border border-[#1E293B] text-slate-100 text-sm font-mono p-3 pl-4 rounded focus:outline-none focus:border-[#00E0FF] transition-colors disabled:opacity-50"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Simulation Result Stats (Only visible when previewing/success) */}
                    {(isPreview || isSuccess) && state.projectedRisk && (
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#1E293B]">
                            <div>
                                <div className="text-[9px] text-slate-500 uppercase font-bold tracking-widest mb-1">Projected HF</div>
                                <div className={cn("text-2xl font-mono font-bold tracking-tighter", currentHF > 1.2 ? "text-[#00D26A]" : "text-[#FFB020]")}>
                                    {currentHF.toFixed(2)}
                                </div>
                            </div>
                            <div>
                                <div className="text-[9px] text-slate-500 uppercase font-bold tracking-widest mb-1">Est. Swap Output</div>
                                <div className="text-xl font-mono font-bold text-slate-200 tracking-tighter">
                                    ~{state.loopResult?.estimatedSwapOutputSol.toFixed(3)} SOL
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ─── 4. Right Control Panel (Risk & Metrics) ────────────────────── */}
                <div className="md:col-span-5 p-6 bg-[#0B0F14] relative flex flex-col justify-between">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-[#1E293B]">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Est. Compute</span>
                            <span className="text-[10px] font-mono text-slate-200">
                                {state.estimatedComputeUnits ? `${(state.estimatedComputeUnits / 1000).toFixed(0)}k Units` : "---"}
                            </span>
                        </div>
                        <div className="flex items-center justify-between pb-2 border-b border-[#1E293B]">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Priority Fee</span>
                            <span className="text-[10px] font-mono text-slate-200">
                                {state.estimatedPriorityFee ? `${state.estimatedPriorityFee} lamports` : "---"}
                            </span>
                        </div>
                        <div className="flex items-center justify-between pb-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Slippage</span>
                            <span className="text-[10px] font-mono text-[#00E0FF]">Dynamic (Auto)</span>
                        </div>
                    </div>

                    {/* Vertical Risk Bar Visual */}
                    <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-[#0F141C] border-l border-[#1E293B]">
                        <div
                            className={cn("absolute bottom-0 w-full transition-all duration-700", riskColor)}
                            style={{ height: `${riskHeight}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* ─── 5. Error Display ──────────────────────────────────────────────── */}
            {isError && (
                <div className="px-6 py-3 bg-[#FF3B5C]/5 border-t border-b border-[#FF3B5C]/20 flex items-start gap-3">
                    <ShieldAlert className="h-4 w-4 text-[#FF3B5C] mt-0.5" />
                    <div className="font-mono text-[10px] text-[#FF3B5C]">
                        <p className="font-bold">&gt; EXECUTION ERROR: {state.error?.includes("User") ? "USER_REJECTED" : "RPC_FAILURE"}</p>
                        <p className="opacity-80">&gt; REASON: {state.error}</p>
                    </div>
                    <button
                        onClick={reset}
                        className="ml-auto text-[10px] px-2 py-1 bg-[#FF3B5C]/10 hover:bg-[#FF3B5C]/20 text-[#FF3B5C] border border-[#FF3B5C]/30 rounded uppercase tracking-wider transition-colors"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* ─── 6. Action Button Area ─────────────────────────────────────────── */}
            <div className="p-6 bg-[#0F141C] border-t border-[#1E293B]">
                {!connected ? (
                    <div className="w-full h-12 flex items-center justify-center bg-[#1E293B] border border-dashed border-slate-700 rounded text-slate-500 text-xs font-mono uppercase tracking-widest">
                        Connect Wallet to Arm Engine
                    </div>
                ) : (
                    <>
                        {/* IDLE STATE */}
                        {state.status === "idle" && (
                            <button
                                onClick={handleSimulate}
                                disabled={parseFloat(initialDeposit) === 0 && parseFloat(borrowAmount) === 0}
                                className="w-full h-12 bg-[#00E0FF] hover:bg-[#00C2E0] text-[#0B0F14] font-bold font-mono text-sm uppercase tracking-widest rounded shadow-[0_0_20px_rgba(0,224,255,0.2)] hover:shadow-[0_0_30px_rgba(0,224,255,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none relative overflow-hidden group"
                            >
                                <span className="relative z-10 flex items-center justify-center gap-2">
                                    <Cpu className="h-4 w-4" /> Simulate Atomic Loop
                                </span>
                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                            </button>
                        )}

                        {/* PREVIEW STATE */}
                        {state.status === "previewing" && (
                            <div className="flex gap-4">
                                <button
                                    onClick={reset}
                                    className="flex-1 h-12 bg-transparent border border-[#1E293B] text-slate-400 hover:text-slate-200 hover:border-slate-600 font-mono text-xs uppercase tracking-widest rounded transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmLoop}
                                    className="flex-[3] h-12 bg-[#34D399] hover:bg-[#10B981] text-[#064E3B] font-bold font-mono text-sm uppercase tracking-widest rounded shadow-[0_0_20px_rgba(52,211,153,0.3)] hover:shadow-[0_0_30px_rgba(52,211,153,0.5)] transition-all flex items-center justify-center gap-2 animate-pulse"
                                >
                                    <Zap className="h-4 w-4" /> Execute Transaction
                                </button>
                            </div>
                        )}

                        {/* SUCCESS STATE */}
                        {state.status === "success" && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-center gap-2 text-[#00D26A] py-2">
                                    <CheckCircle2 className="h-5 w-5" />
                                    <span className="font-mono text-xs font-bold uppercase tracking-widest">Transaction Finalized on Solana</span>
                                </div>
                                <button
                                    onClick={reset}
                                    className="w-full h-12 bg-transparent border border-[#1E293B] text-slate-400 hover:text-slate-200 hover:border-slate-600 font-mono text-xs uppercase tracking-widest rounded transition-all"
                                >
                                    Reset Engine
                                </button>
                            </div>
                        )}

                        {/* PROCESSING STATE */}
                        {isProcessing && (
                            <div className="w-full h-12 bg-[#1E293B] border border-[#334155] rounded flex items-center justify-center gap-3">
                                <Loader2 className="h-4 w-4 text-[#FFB020] animate-spin" />
                                <span className="text-[#FFB020] font-mono text-xs font-bold uppercase tracking-widest animate-pulse">
                                    {state.status === "building" ? "Building Instructions..." :
                                        state.status === "simulating" ? "Simulating Risk..." :
                                            state.status === "sending" ? "Pushing to Network..." :
                                                "Confirming Finality..."}
                                </span>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
