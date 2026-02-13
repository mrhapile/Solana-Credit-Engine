
import React from 'react';
import { TransactionState } from '@/hooks/transactions/useTransactionLifecycle';

interface TransactionExplorerProps {
    state: TransactionState;
}

export const TransactionExplorer: React.FC<TransactionExplorerProps> = ({ state }) => {
    if (!state.explorerLink) return null;

    const isPending =
        state.status === 'sending' ||
        state.status === 'confirming';

    const isSuccess = state.status === 'success';

    return (
        <div className="mt-4 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {isPending && <span className="iconify ph--spinner-gap-bold animate-spin text-primary"></span>}
                    {isSuccess && <span className="iconify ph--check-circle-bold text-emerald-400"></span>}
                    <span className="text-sm font-medium text-neutral-200">
                        {isPending ? 'Confirming Transaction...' : isSuccess ? 'Transaction Confirmed' : 'Transaction Sent'}
                    </span>
                </div>
                <a
                    href={state.explorerLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:text-primary-400 flex items-center gap-1"
                >
                    View on Solscan <span className="iconify ph--arrow-square-out"></span>
                </a>
            </div>

            {state.status === 'success' && (
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-neutral-400 border-t border-neutral-800 pt-2">
                    {/* Actual consumed units not available without re-fetching tx, so we might show estimated or omit */}
                    {/* Requirement: "Display finalized compute units consumed" -> Requires fetching execution result */}
                </div>
            )}
        </div>
    );
};
