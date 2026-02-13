import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";

export interface SolPriceState {
    price: number | null;
    confidence: number | null;
    source: string | null;
    loading: boolean;
    error: string | null;
}

/**
 * Hook to fetch SOL price via our server-side API route.
 * Prevents direct client RPC calls and hydration mismatches.
 */
export function useSolPrice() {
    // Stagger price fetch to avoid contesting with position fetch
    const [enabled, setEnabled] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setEnabled(true), 200);
        return () => clearTimeout(timer);
    }, []);

    const { data, isLoading, error } = useQuery({
        queryKey: ["sol-price"],
        queryFn: async () => {
            const res = await fetch("/api/price");
            if (!res.ok) throw new Error("Failed to fetch price");
            return res.json() as Promise<{ price: number; confidence: number; source: string }>;
        },
        staleTime: 30_000, // 30s cache
        refetchOnWindowFocus: false,
        refetchOnMount: false, // Prevent extra fetch on hydration if data exists
        retry: 1,
        enabled: enabled,
    });

    // Ensure we report loading even during the initial delay
    const isActuallyLoading = isLoading || !enabled;

    return {
        price: data?.price || null,
        confidence: data?.confidence || null,
        source: data?.source || null,
        loading: isActuallyLoading,
        error: error ? (error as Error).message : null,
        state: { // Backwards compatibility if needed
            price: data?.price || null,
            loading: isActuallyLoading,
            error: error ? (error as Error).message : null,
        }
    };
}
