import { useState, useEffect } from "react";
import { getSolPrice } from "../lib/pyth";

export interface SolPriceState {
    price: number | null;
    loading: boolean;
    error: string | null;
}

/**
 * Hook to fetch SOL price.
 * Primary source: Pyth on-chain oracle.
 * Fallback: Jupiter REST API.
 */
export function useSolPrice() {
    const [state, setState] = useState<SolPriceState>({
        price: null,
        loading: true,
        error: null,
    });

    useEffect(() => {
        let mounted = true;

        const loadPrice = async () => {
            try {
                const price = await getSolPrice();
                if (mounted) {
                    setState({ price, loading: false, error: null });
                }
            } catch (err: any) {
                if (mounted) {
                    setState({
                        price: null,
                        loading: false,
                        error: err.message || "Failed to fetch SOL price",
                    });
                }
            }
        };

        loadPrice();

        // Refresh every 30s (aligned with Pyth cache TTL)
        const interval = setInterval(loadPrice, 30_000);

        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, []);

    return state;
}
