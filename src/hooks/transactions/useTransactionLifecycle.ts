
import { useState, useCallback } from 'react';

export type TransactionStatus =
    | 'idle'
    | 'building'
    | 'simulating'
    | 'optimizing'
    | 'awaiting_signature'
    | 'sending'
    | 'confirming'
    | 'success'
    | 'failed';

export interface TransactionState {
    status: TransactionStatus;
    error?: string;
    logs?: string[];
    signature?: string;
    explorerLink?: string;
    // Simulation Metrics
    estimatedComputeUnits?: number;
    estimatedPriorityFee?: number;
    estimatedNetworkFeeSol?: number;
    // Confirmation Metrics
    confirmedComputeUnits?: number;
    confirmedPriorityFee?: number;
}

export function useTransactionLifecycle() {
    const [state, setState] = useState<TransactionState>({
        status: 'idle',
    });

    const setStatus = useCallback((status: TransactionStatus) => {
        setState(prev => ({ ...prev, status }));
    }, []);

    const setError = useCallback((error: string, logs?: string[]) => {
        setState(prev => ({ ...prev, status: 'failed', error, logs }));
    }, []);

    const setSimulationResults = useCallback((units: number, priorityFee: number, networkFee: number) => {
        setState(prev => ({
            ...prev,
            estimatedComputeUnits: units,
            estimatedPriorityFee: priorityFee,
            estimatedNetworkFeeSol: networkFee
        }));
    }, []);

    const setSignature = useCallback((signature: string, link: string) => {
        setState(prev => ({ ...prev, signature, explorerLink: link }));
    }, []);

    const setSuccess = useCallback((confirmedUnits?: number, confirmedFee?: number) => {
        setState(prev => ({
            ...prev,
            status: 'success',
            confirmedComputeUnits: confirmedUnits,
            confirmedPriorityFee: confirmedFee
        }));
    }, []);

    const reset = useCallback(() => {
        setState({ status: 'idle' });
    }, []);

    return {
        state,
        setStatus,
        setError,
        setSimulationResults,
        setSignature,
        setSuccess,
        reset
    };
}
