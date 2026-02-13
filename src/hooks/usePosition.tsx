import { useQuery } from "@tanstack/react-query";
import { getCurrentPosition } from "@jup-ag/lend/borrow";
import { getConnection } from "@/lib/solana";
import { safeRpcCall } from "@/lib/rpcGuard";
import { useSolPrice } from "@/hooks/useSolPrice";
import { SOL_MINT, USDC_MINT, SOL_DECIMALS, USDC_DECIMALS } from "@/engine/constants";
import { useState, useEffect, useCallback } from "react";
import BN from "bn.js";

type PositionState = {
  tick: number;
  tickId: number;
  colRaw: BN;
  finalAmount: BN;
  debtRaw: BN;
  dustDebtRaw: BN;
  isSupplyOnlyPosition: boolean;
  userLiquidationStatus: boolean;
  postLiquidationBranchId: number;
} | null;

/**
 * Polling interval constant (ms). Configurable for tuning.
 */
const POSITION_POLL_INTERVAL_MS = 30_000;

/**
 * Initial fetch delay (ms) to prevent RPC burst on page load.
 */
const INITIAL_FETCH_DELAY_MS = 800;

export function usePosition(vaultId: number, positionId: number, options?: { paused?: boolean }) {
  const isPaused = options?.paused || false;

  // ── Anti-Burst: Delay initial fetch by 800ms ─────────────────
  const [initialDelayPassed, setInitialDelayPassed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setInitialDelayPassed(true);
    }, INITIAL_FETCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  // ── Only start polling after first successful fetch ──────────
  const [firstFetchDone, setFirstFetchDone] = useState(false);

  const onPositionSuccess = useCallback(() => {
    if (!firstFetchDone) setFirstFetchDone(true);
  }, [firstFetchDone]);

  // ── Position Query ───────────────────────────────────────────
  const {
    data: position,
    isLoading: posLoading,
    error: posError,
  } = useQuery({
    queryKey: ['position', vaultId, positionId],
    queryFn: async () => {
      if (!vaultId || !positionId) return null;

      console.log("[usePosition] Fetching position…", vaultId, positionId);

      const result = await safeRpcCall(
        () =>
          getCurrentPosition({
            vaultId,
            positionId,
            connection: getConnection(),
          }),
        { context: 'getCurrentPosition' }
      );

      onPositionSuccess();
      return result;
    },
    refetchInterval: firstFetchDone ? POSITION_POLL_INTERVAL_MS : false,
    enabled: initialDelayPassed && !isPaused && !!vaultId && !!positionId,
    refetchOnWindowFocus: false,
  });

  // ── Price Query — Pyth Oracle ────────────────────────────────
  // Use centralized hook via API route (staggered ~200ms, cached)
  const { price: solPrice, loading: priceLoading, error: priceError } = useSolPrice();

  const currentSolPrice = solPrice || 0;
  const usdcPrice = 1; // Stablecoin

  // ── Formatting ───────────────────────────────────────────────
  const formatted = position
    ? {
      collateralAmount: position.colRaw.toNumber() / Math.pow(10, SOL_DECIMALS),
      debtAmount: position.debtRaw.toNumber() / Math.pow(10, USDC_DECIMALS),
      solPrice: currentSolPrice,
      collateralUSD: (position.colRaw.toNumber() / Math.pow(10, SOL_DECIMALS)) * currentSolPrice,
      debtUSD: (position.debtRaw.toNumber() / Math.pow(10, USDC_DECIMALS)) * usdcPrice,
    }
    : null;

  return {
    position: position || null,
    formatted,
    // Ensure we show loading while waiting for the stagger delay
    loading: posLoading || priceLoading || !initialDelayPassed,
    error: (posError as Error)?.message || priceError || null,
  };
}
