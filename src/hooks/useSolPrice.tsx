
import { useState, useEffect } from "react";
import { fetchSolPrice } from "../lib/price";

export interface SolPriceState {
    price: number | null;
    loading: boolean;
    error: string | null;
}

export function useSolPrice() {
    const [state, setState] = useState<SolPriceState>({
        price: null,
        loading: true,
        error: null,
    });

    useEffect(() => {
        let mounted = true;
        // Initial fetch
        const loadPrice = async () => {
            try {
                const { price } = await fetchSolPrice();
                if (mounted) {
                    setState({ price, loading: false, error: null });
                }
            } catch (err: any) {
                if (mounted) {
                    setState({ price: null, loading: false, error: err.message || "Failed to fetch price" });
                }
            }
        };

        loadPrice();

        const interval = setInterval(loadPrice, 60000); // refresh every minute

        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, []);

    return state;
}
