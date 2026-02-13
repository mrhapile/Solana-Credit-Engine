
import { useEffect, useState } from "react";
import { getCurrentPosition } from "@jup-ag/lend/borrow";
import { getConnection } from "@/lib/solana";
import { fetchTokenPrices } from "@/lib/prices";
import { SOL_MINT, USDC_MINT, SOL_DECIMALS, USDC_DECIMALS } from "@/engine/constants";
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

export function usePosition(vaultId: number, positionId: number) {
  const [position, setPosition] = useState<PositionState>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prices, setPrices] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    async function fetchPosition() {
      try {
        if (!vaultId || !positionId) {
          throw new Error("Invalid vaultId or positionId");
        }

        setLoading(true);
        setError(null);

        // Fetch position
        const data = await getCurrentPosition({
          vaultId,
          positionId,
          connection: getConnection(),
        });

        // Fetch prices separately or together? 
        // The user's snippet in prompt only fetched position.
        // But the rest of the hook uses prices.
        // I should keep prices fetching. 
        const priceData = await fetchTokenPrices([SOL_MINT, USDC_MINT]);

        console.log("Position loaded:", data);
        setPosition(data);
        setPrices(priceData);
      } catch (err: any) {
        console.error("Position fetch error:", err);
        setError(err.message || "Failed to load position");
      } finally {
        setLoading(false);
      }
    }

    fetchPosition();

    // Set up interval for refreshing prices/position? 
    // The user requested a simple useEffect for now. I won't add polling here to keep it strictly as requested.
  }, [vaultId, positionId]);

  const solPrice = prices[SOL_MINT] || 0;
  const usdcPrice = prices[USDC_MINT] || 1;

  const formatted = position
    ? {
      collateralAmount: position.colRaw.toNumber() / Math.pow(10, SOL_DECIMALS), // SOL
      debtAmount: position.debtRaw.toNumber() / Math.pow(10, USDC_DECIMALS), // USDC
      solPrice,
      collateralUSD: (position.colRaw.toNumber() / Math.pow(10, SOL_DECIMALS)) * solPrice,
      debtUSD: (position.debtRaw.toNumber() / Math.pow(10, USDC_DECIMALS)) * usdcPrice,
    }
    : null;

  return { position, formatted, loading, error };
}
