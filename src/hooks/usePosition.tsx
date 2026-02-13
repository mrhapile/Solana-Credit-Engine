import { useQuery } from "@tanstack/react-query";
import { getCurrentPosition } from "@jup-ag/lend/borrow";
import { getConnection } from "@/lib/solana";
import { fetchTokenPrices } from "@/lib/prices"; // Assuming this exists as per previous code
import { SOL_MINT, USDC_MINT, SOL_DECIMALS, USDC_DECIMALS } from "@/engine/constants";


// I'll import BN
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

export function usePosition(vaultId: number, positionId: number, options?: { paused?: boolean }) {
  const isPaused = options?.paused || false;

  // Position Query
  const {
    data: position,
    isLoading: posLoading,
    error: posError
  } = useQuery({
    queryKey: ['position', vaultId, positionId],
    queryFn: async () => {
      if (!vaultId || !positionId) return null;
      console.log("Fetching position...", vaultId, positionId);
      return await getCurrentPosition({
        vaultId,
        positionId,
        connection: getConnection(),
      });
    },
    refetchInterval: 30000, // Reduced polling (30s)
    enabled: !isPaused && !!vaultId && !!positionId,
    refetchOnWindowFocus: false, // Additional optimization
  });

  // Price Query (Reuse cache key across app)
  const {
    data: prices,
    isLoading: priceLoading
  } = useQuery({
    queryKey: ['prices', SOL_MINT, USDC_MINT],
    queryFn: async () => {
      return await fetchTokenPrices([SOL_MINT, USDC_MINT]);
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const solPrice = prices?.[SOL_MINT] || 0;
  const usdcPrice = prices?.[USDC_MINT] || 1;

  // Formatting Logic
  const formatted = position
    ? {
      collateralAmount: position.colRaw.toNumber() / Math.pow(10, SOL_DECIMALS), // SOL
      debtAmount: position.debtRaw.toNumber() / Math.pow(10, USDC_DECIMALS), // USDC
      solPrice,
      collateralUSD: (position.colRaw.toNumber() / Math.pow(10, SOL_DECIMALS)) * solPrice,
      debtUSD: (position.debtRaw.toNumber() / Math.pow(10, USDC_DECIMALS)) * usdcPrice,
    }
    : null;

  return {
    position: position || null,
    formatted,
    loading: posLoading || priceLoading,
    error: (posError as Error)?.message || null
  };
}
