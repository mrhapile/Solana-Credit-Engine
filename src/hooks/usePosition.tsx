import { useQuery } from "@tanstack/react-query";
import { getCurrentPosition } from "@jup-ag/lend/borrow";
import { getConnection } from "@/lib/solana";
import { safeRpcCall } from "@/lib/rpcGuard";
import { fetchTokenPrices } from "@/lib/prices";
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

  // ── Req 1: Delay initial fetch by 800ms ──────────────────────
  const [initialDelayPassed, setInitialDelayPassed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setInitialDelayPassed(true);
    }, INITIAL_FETCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  // ── Req 6: Only start polling after first successful fetch ───
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

      // Wrap the SDK call in safeRpcCall for spacing + 429 guard
      const result = await safeRpcCall(
        () =>
          getCurrentPosition({
            vaultId,
            positionId,
            connection: getConnection(), // defaults to "processed"
          }),
        { context: 'getCurrentPosition' }
      );

      // Mark first fetch done for polling gate
      onPositionSuccess();
      return result;
    },
    // Polling only begins AFTER the first fetch succeeds
    refetchInterval: firstFetchDone ? POSITION_POLL_INTERVAL_MS : false,
    // Don't fire until delay has elapsed AND query isn't paused
    enabled: initialDelayPassed && !isPaused && !!vaultId && !!positionId,
    refetchOnWindowFocus: false,
  });

  // ── Price Query ──────────────────────────────────────────────
  const {
    data: prices,
    isLoading: priceLoading,
  } = useQuery({
    queryKey: ['prices', SOL_MINT, USDC_MINT],
    queryFn: () => fetchTokenPrices([SOL_MINT, USDC_MINT]),
    refetchInterval: 60_000,
    staleTime: 30_000,
    // Delay price fetch too to spread load
    enabled: initialDelayPassed,
  });

  const solPrice = prices?.[SOL_MINT] || 0;
  const usdcPrice = prices?.[USDC_MINT] || 1;

  // ── Formatting ───────────────────────────────────────────────
  const formatted = position
    ? {
      collateralAmount: position.colRaw.toNumber() / Math.pow(10, SOL_DECIMALS),
      debtAmount: position.debtRaw.toNumber() / Math.pow(10, USDC_DECIMALS),
      solPrice,
      collateralUSD: (position.colRaw.toNumber() / Math.pow(10, SOL_DECIMALS)) * solPrice,
      debtUSD: (position.debtRaw.toNumber() / Math.pow(10, USDC_DECIMALS)) * usdcPrice,
    }
    : null;

  return {
    position: position || null,
    formatted,
    loading: posLoading || priceLoading,
    error: (posError as Error)?.message || null,
  };
}
