/**
 * useLeverageLoop.tsx — Hook for the leverage loop feature.
 *
 * Uses the standard transaction lifecycle state machine:
 *   idle → building → simulating → optimizing → awaiting_signature → sending → confirming → success
 *
 * Supports: simulate → preview → confirm flow.
 */

import { useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";
import BN from "bn.js";
import { getConnection } from "@/lib/solana";
import { buildLeverageLoop, LeverageLoopResult } from "@/engine/leverageLoop";
import { executeLendingTransaction } from "@/engine/executor";
import { RiskMetrics } from "@/engine/risk";
import { TransactionStatus } from "./transactions/useTransactionLifecycle";

export type LoopStatus =
    | TransactionStatus
    | "previewing";

export interface LeverageLoopState {
    status: LoopStatus;
    loopResult: LeverageLoopResult | null;
    projectedRisk: RiskMetrics | null;
    error: string | null;
    txSignature: string | null;
    explorerLink: string | null;
    // Simulation metrics
    estimatedComputeUnits?: number;
    estimatedPriorityFee?: number;
}

export function useLeverageLoop(vaultId: number, positionId: number) {
    const wallet = useWallet();
    const queryClient = useQueryClient();
    const connection = getConnection();

    const [state, setState] = useState<LeverageLoopState>({
        status: "idle",
        loopResult: null,
        projectedRisk: null,
        error: null,
        txSignature: null,
        explorerLink: null,
    });

    /**
     * Step 1: Build & simulate the loop (preview mode).
     * This does NOT send the transaction — it builds the instruction set
     * and runs simulation to show projected HF.
     */
    const simulateLoop = useCallback(
        async (params: {
            initialDepositSol: number;
            borrowAmountUsdc: number;
            solPrice: number;
            currentCollateralRaw: BN;
            currentDebtRaw: BN;
        }) => {
            if (state.status !== "idle" && state.status !== "failed" && state.status !== "success") {
                console.warn("[LeverageLoop] Cannot simulate while in state:", state.status);
                return;
            }

            try {
                setState(s => ({ ...s, status: "building", error: null }));

                if (!wallet.publicKey) {
                    throw new Error("Wallet not connected");
                }

                const loopResult = await buildLeverageLoop({
                    vaultId,
                    positionId,
                    userPublicKey: wallet.publicKey,
                    connection,
                    ...params,
                });

                setState(s => ({ ...s, status: "simulating" }));

                // Use simulate-only mode via the executor to verify the loop
                await executeLendingTransaction(
                    connection,
                    wallet,
                    {
                        vaultId,
                        positionId,
                        colAmount: 0,
                        debtAmount: 0,
                        userPublicKey: wallet.publicKey,
                        preInstructions: loopResult.allInstructions,
                        simulateOnly: true,
                    },
                    {
                        onStatusChange: (status) => {
                            setState(s => ({ ...s, status }));
                        },
                        onSimulationSuccess: (units, fee) => {
                            setState(s => ({ ...s, estimatedComputeUnits: units, estimatedPriorityFee: fee }));
                        }
                    }
                );

                setState(s => ({
                    ...s,
                    status: "previewing",
                    loopResult,
                    projectedRisk: loopResult.projectedRisk,
                    error: null,
                }));
            } catch (err: any) {
                setState(s => ({
                    ...s,
                    status: "failed",
                    error: err.message || "Loop simulation failed",
                }));
            }
        },
        [state.status, wallet, connection, vaultId, positionId]
    );

    /**
     * Step 2: Confirm and execute the loop.
     * Only callable after successful simulation/preview.
     */
    const confirmLoop = useCallback(async () => {
        if (state.status !== "previewing" || !state.loopResult) {
            console.warn("[LeverageLoop] Cannot confirm without preview");
            return;
        }

        if (!wallet.publicKey) {
            setState(s => ({ ...s, status: "failed", error: "Wallet not connected" }));
            return;
        }

        try {
            const result = await executeLendingTransaction(
                connection,
                wallet,
                {
                    vaultId,
                    positionId,
                    colAmount: 0,
                    debtAmount: 0,
                    userPublicKey: wallet.publicKey,
                    preInstructions: state.loopResult.allInstructions,
                    simulateOnly: false,
                },
                {
                    onStatusChange: (status) => {
                        setState(s => ({ ...s, status }));
                    },
                    onSimulationSuccess: (units, fee) => {
                        setState(s => ({ ...s, estimatedComputeUnits: units, estimatedPriorityFee: fee }));
                    }
                }
            );

            // Invalidate position data to force fresh fetch
            queryClient.invalidateQueries({ queryKey: ['position', vaultId, positionId] });

            setState(s => ({
                ...s,
                status: "success",
                error: null,
                txSignature: result.signature,
                explorerLink: result.link,
            }));
        } catch (err: any) {
            setState(s => ({
                ...s,
                status: "failed",
                error: err.message || "Loop execution failed",
            }));
        }
    }, [state, wallet, connection, vaultId, positionId, queryClient]);

    /**
     * Reset to idle state.
     */
    const reset = useCallback(() => {
        setState({
            status: "idle",
            loopResult: null,
            projectedRisk: null,
            error: null,
            txSignature: null,
            explorerLink: null,
        });
    }, []);

    return {
        state,
        simulateLoop,
        confirmLoop,
        reset,
    };
}
