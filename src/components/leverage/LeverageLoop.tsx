"use client";

import React, { useState, useMemo } from "react";
import { usePosition } from "@/hooks/usePosition";
import { useLeverageLoop } from "@/hooks/useLeverageLoop";
import { useSolPrice } from "@/hooks/useSolPrice";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Zap, AlertTriangle, CheckCircle2, ExternalLink, Activity, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { TransactionStatus } from "@/hooks/transactions/useTransactionLifecycle";

interface LeverageLoopProps {
    vaultId: number;
    positionId: number;
}

const STATUS_STEPS: Record<string, { label: string; progress: number }> = {
    "idle": { label: "Idle", progress: 0 },
    "building": { label: "Building Transaction", progress: 10 },
    "simulating": { label: "Simulating on Chain", progress: 30 },
    "optimizing": { label: "Optimizing Budget", progress: 45 },
    "previewing": { label: "Ready to Execute", progress: 50 },
    "awaiting_signature": { label: "Awaiting Signature", progress: 60 },
    "sending": { label: "Pushing to RPC", progress: 75 },
    "confirming": { label: "Confirming Finality", progress: 90 },
    "success": { label: "Transaction Finalized", progress: 100 },
    "failed": { label: "Transaction Failed", progress: 100 },
};

export function LeverageLoop({ vaultId, positionId }: LeverageLoopProps) {
    const { position } = usePosition(vaultId, positionId);
    const { price: solPrice } = useSolPrice();
    const { state, simulateLoop, confirmLoop, reset } = useLeverageLoop(vaultId, positionId);

    const [initialDeposit, setInitialDeposit] = useState("0");
    const [borrowAmount, setBorrowAmount] = useState("0");

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

    const currentStep = STATUS_STEPS[state.status] || STATUS_STEPS["idle"];

    const isError = state.status === "failed";
    const isActive = state.status !== "idle" && state.status !== "previewing" && !isError && state.status !== "success";

    const errorHeading = useMemo(() => {
        if (!state.error) return "Error";
        if (state.error.includes("User rejected")) return "Request Cancelled";
        if (state.error.includes("Slippage")) return "Slippage Error";
        if (state.error.includes("Rate limit")) return "RPC Congestion";
        return "Transaction Failed";
    }, [state.error]);

    return (
        <Card className="border-slate-800 bg-[#0B121A] relative overflow-hidden group">
            {/* Top progress line */}
            <div
                className={cn(
                    "absolute top-0 left-0 h-1 transition-all duration-500 z-10",
                    isError ? "bg-red-500" : "bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]"
                )}
                style={{ width: `${currentStep.progress}%` }}
            />

            <CardHeader className="pb-4">
                <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2 text-cyan-400">
                        <Zap className="h-5 w-5 fill-cyan-400/20" />
                        Leverage Loop
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-bold text-cyan-400 uppercase tracking-tighter">
                            Atomic Transaction
                        </span>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-6">
                {state.status === "idle" && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                    Initial SOL Deposit
                                </label>
                                <div className="relative">
                                    <Input
                                        type="number"
                                        value={initialDeposit}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInitialDeposit(e.target.value)}
                                        className="bg-slate-950/50 border-slate-800 text-slate-100 pl-8"
                                        placeholder="0.0"
                                    />
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-600">SOL</div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                    USDC Borrow Amount
                                </label>
                                <div className="relative">
                                    <Input
                                        type="number"
                                        value={borrowAmount}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBorrowAmount(e.target.value)}
                                        className="bg-slate-950/50 border-slate-800 text-slate-100 pl-10"
                                        placeholder="0.0"
                                    />
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-600">USDC</div>
                                </div>
                            </div>
                        </div>

                        <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800 flex gap-3">
                            <Info className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-slate-400 leading-relaxed">
                                This operation will execute 4 steps atomically: Deposit collateral, Borrow debt, Swap debt for more collateral, and Re-deposit.
                                <span className="text-cyan-400/80 block mt-1">Slippage protection is automatically applied via Jupiter V6.</span>
                            </p>
                        </div>
                    </div>
                )}

                {isActive && (
                    <div className="py-12 flex flex-col items-center justify-center space-y-4 animate-in fade-in zoom-in-95 duration-300">
                        <div className="relative">
                            <Loader2 className="h-10 w-10 animate-spin text-cyan-500" />
                            <Activity className="h-4 w-4 text-cyan-500/50 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                        </div>
                        <div className="space-y-1 text-center">
                            <p className="text-sm font-semibold text-slate-200 tracking-tight">{currentStep.label}</p>
                            <p className="text-[11px] text-slate-500">Communicating with Solana RPC...</p>
                        </div>
                    </div>
                )}

                {state.status === "previewing" && state.projectedRisk && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-xl bg-slate-950/50 p-4 border border-slate-800 group/item hover:border-cyan-500/30 transition-colors">
                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Projected Health Factor</p>
                                <div className="flex items-baseline gap-2">
                                    <span className={cn(
                                        "text-2xl font-black tracking-tighter",
                                        state.projectedRisk.projectedHF > 1.2 ? "text-green-400" : "text-yellow-400"
                                    )}>
                                        {state.projectedRisk.projectedHF.toFixed(2)}
                                    </span>
                                    <span className="text-[10px] text-slate-600 font-medium">/ 1.0</span>
                                </div>
                                <div className="w-full h-1 bg-slate-900 rounded-full mt-3 overflow-hidden">
                                    <div
                                        className={cn(
                                            "h-full rounded-full transition-all duration-1000",
                                            state.projectedRisk.projectedHF > 1.2 ? "bg-green-500" : "bg-yellow-500"
                                        )}
                                        style={{ width: `${Math.min(state.projectedRisk.projectedHF * 20, 100)}%` }}
                                    />
                                </div>
                            </div>

                            <div className="rounded-xl bg-slate-950/50 p-4 border border-slate-800">
                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Swap Efficiency</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-xl font-bold text-slate-100 tracking-tight">
                                        ~{state.loopResult?.estimatedSwapOutputSol.toFixed(4)}
                                    </span>
                                    <span className="text-[10px] text-slate-600 uppercase">SOL</span>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-2">Via Jupiter Routing</p>
                            </div>
                        </div>

                        <Alert className="bg-cyan-500/5 border-cyan-500/20 py-2">
                            <AlertDescription className="text-[11px] text-cyan-400 flex items-center gap-2">
                                <div className="h-1 w-1 rounded-full bg-cyan-400 animate-pulse" />
                                Review parameters before signing the atomic transaction bundle.
                            </AlertDescription>
                        </Alert>
                    </div>
                )}

                {state.status === "success" && (
                    <div className="py-8 space-y-6 animate-in slide-in-from-top-2 duration-500">
                        <div className="flex flex-col items-center justify-center space-y-3">
                            <div className="h-14 w-14 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/30">
                                <CheckCircle2 className="h-8 w-8 text-green-400" />
                            </div>
                            <div className="text-center">
                                <p className="text-lg font-bold text-slate-100 leading-none">Loop Complete</p>
                                <p className="text-[11px] text-slate-500 mt-1 uppercase tracking-widest">Atomic Execution Successful</p>
                            </div>
                        </div>

                        <div className="rounded-xl bg-slate-950/50 border border-slate-800 divide-y divide-slate-800">
                            <div className="p-3 flex justify-between items-center text-xs">
                                <span className="text-slate-500">Status</span>
                                <span className="text-green-400 font-bold flex items-center gap-1.5">
                                    <div className="h-1.5 w-1.5 rounded-full bg-green-400" />
                                    Finalized
                                </span>
                            </div>
                            <div className="p-3 flex justify-between items-center text-xs">
                                <span className="text-slate-500">Signature</span>
                                <span className="text-slate-400 font-mono text-[10px]">
                                    {state.txSignature?.slice(0, 8)}...{state.txSignature?.slice(-8)}
                                </span>
                            </div>
                            <a
                                href={state.explorerLink || "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-3 flex justify-center items-center gap-2 text-cyan-400 hover:bg-cyan-500/5 transition-colors text-xs font-bold"
                            >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Verify on Solscan
                            </a>
                        </div>
                    </div>
                )}

                {isError && (
                    <div className="p-5 rounded-xl bg-red-500/5 border border-red-500/20 space-y-3 animate-in shake-in duration-300">
                        <div className="flex items-center gap-2 text-red-500">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="text-[11px] font-black uppercase tracking-widest">{errorHeading}</span>
                        </div>
                        <p className="text-[12px] text-red-400/80 leading-relaxed font-medium">
                            {state.error || "An unexpected error occurred during execution."}
                        </p>
                        <div className="pt-2">
                            <p className="text-[10px] text-slate-500 italic">
                                Check RPC stability or adjust slippage and try again.
                            </p>
                        </div>
                    </div>
                )}
            </CardContent>

            <CardFooter className="flex gap-3 pb-8">
                {state.status === "idle" && (
                    <Button
                        onClick={handleSimulate}
                        disabled={parseFloat(initialDeposit) === 0 && parseFloat(borrowAmount) === 0}
                        className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold h-11 border-b-2 border-cyan-700 active:border-0 transition-all"
                    >
                        Simulate Loop Bundle
                    </Button>
                )}
                {state.status === "previewing" && (
                    <>
                        <Button
                            variant="outline"
                            onClick={reset}
                            className="flex-1 border-slate-800 hover:bg-slate-900 text-slate-400 font-bold h-11"
                        >
                            Reset
                        </Button>
                        <Button
                            onClick={confirmLoop}
                            className="flex-[2] bg-cyan-600 hover:bg-cyan-500 text-white font-black italic tracking-tight h-11 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                        >
                            EXECUTE ATOMIC LOOP
                        </Button>
                    </>
                )}
                {(state.status === "success" || isError) && (
                    <Button
                        variant="outline"
                        onClick={reset}
                        className="w-full border-slate-800 hover:bg-slate-900 text-slate-400 font-bold h-11"
                    >
                        Back to Terminal
                    </Button>
                )}
            </CardFooter>
        </Card>
    );
}
