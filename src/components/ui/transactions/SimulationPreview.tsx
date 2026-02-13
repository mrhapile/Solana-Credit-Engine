
import React from 'react';
import { TransactionState, TransactionStatus } from '@/hooks/transactions/useTransactionLifecycle';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface SimulationPreviewProps {
    open: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    state: TransactionState;
}


export const SimulationPreview = ({ open, onConfirm, onCancel, state }: SimulationPreviewProps) => {
    const isSimulating = state.status === 'simulating' || state.status === 'building' || state.status === 'optimizing';
    const hasResults = state.estimatedComputeUnits !== undefined;

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
            <DialogContent className="sm:max-w-md bg-neutral-900 border-neutral-800 text-neutral-200">
                <DialogHeader>
                    <DialogTitle>Confirm Transaction</DialogTitle>
                    <DialogDescription className="text-neutral-400">
                        Review estimated costs before signing.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4 py-4">
                    {isSimulating ? (
                        <div className="flex flex-col items-center justify-center p-8 gap-4">
                            <span className="iconify ph--spinner-gap-bold animate-spin text-3xl text-primary"></span>
                            <span className="text-sm text-neutral-400">Simulating Transaction...</span>
                        </div>
                    ) : hasResults ? (
                        <div className="grid gap-2 text-sm">
                            <div className="flex justify-between p-2 rounded bg-neutral-800/50">
                                <span className="text-neutral-400">Compute Units</span>
                                <span className="font-mono text-neutral-200">{state.estimatedComputeUnits?.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between p-2 rounded bg-neutral-800/50">
                                <span className="text-neutral-400">Priority Fee</span>
                                <span className="font-mono text-neutral-200">{(state.estimatedPriorityFee || 0).toLocaleString()} µLamports</span>
                            </div>
                            <div className="flex justify-between p-2 rounded bg-neutral-800/50">
                                <span className="text-neutral-400">Network Fee (Est)</span>
                                <span className="font-mono text-neutral-200">~{state.estimatedNetworkFeeSol?.toFixed(6)} SOL</span>
                            </div>

                            {state.error && (
                                <div className="mt-2 p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs break-all">
                                    <span className="font-semibold block mb-1">Simulation Error:</span>
                                    {state.error}
                                </div>
                            )}
                        </div>
                    ) : null}
                </div>

                <DialogFooter className="sm:justify-between gap-2">
                    <button
                        onClick={onCancel}
                        className="w-full px-4 py-2 rounded-md hover:bg-neutral-800 text-neutral-400 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={!hasResults || !!state.error}
                        className="w-full px-4 py-2 bg-primary text-neutral-900 font-semibold rounded-md hover:bg-primary-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Sign & Send
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
