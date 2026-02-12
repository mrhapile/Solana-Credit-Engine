"use client";

import { usePosition } from "@/hooks/usePosition";

import { CustomCard } from "./ui/custom/card";
import { DataCard } from "./ui/custom/data-card";

const CardContainer = ({
  vaultId,
  positionId,
}: {
  vaultId: number;
  positionId: number;
}) => {
  const {
    formatted: positionData,
    loading,
    error,
  } = usePosition(vaultId, positionId);

  if (loading) {
    return (
      <div className="grid gap-5 lg:grid-cols-3 sm:grid-cols-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-[#19242e] bg-[#0B121A] h-[195px] animate-pulse">
            <div className="border-b border-neutral-850 p-4 h-[45px]" />
            <div className="border-b border-neutral-850 p-4 h-[85px]" />
            <div className="p-4 grid grid-cols-2 gap-4 h-[63px]">
              <div className="bg-[#0d1520] rounded-lg" />
              <div className="bg-[#0d1520] rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-red-500 border border-red-500/20 bg-red-500/10 rounded-xl">
        Failed to load position: {error}
      </div>
    );
  }

  if (!positionData) {
    return (
      <div className="p-6 text-yellow-500 border border-yellow-500/20 bg-yellow-500/10 rounded-xl">
        No position found for this ID.
      </div>
    );
  }

  const data = positionData;

  const collateralAmountFormatted =
    data.collateralAmount >= 1
      ? data.collateralAmount.toFixed(2)
      : data.collateralAmount.toFixed(6);
  const collateralUSDFormatted = `$${data.collateralUSD.toFixed(2)}`;
  const debtAmountFormatted = data.debtAmount.toFixed(2);
  const debtUSDFormatted = `$${data.debtUSD.toFixed(2)}`;

  return (
    <div className="grid gap-5 lg:grid-cols-3 sm:grid-cols-2">
      <CustomCard
        title="Supplied Collateral"
        tokenSymbol="SOL"
        tokenAmount={data.collateralAmount}
        tokenAmountFormatted={collateralAmountFormatted}
        usdValue={data.collateralUSD}
        usdValueFormatted={collateralUSDFormatted}
        tokenIcon="https://cdn.instadapp.io/icons/jupiter/tokens/sol.png"
        tokenName="Wrapped SOL"
        apyFormatted="7.2%"
        type="collateral"
        borrowed={data.debtAmount}
        supplied={data.collateralAmount}
        suppliedUsd={data.collateralUSD}
        solPrice={data.solPrice}
        vaultId={vaultId}
        positionId={positionId}
      />
      <CustomCard
        title="Borrowed Debt"
        tokenSymbol="USDC"
        tokenAmount={data.debtAmount}
        tokenAmountFormatted={debtAmountFormatted}
        usdValue={data.debtUSD}
        usdValueFormatted={debtUSDFormatted}
        tokenIcon="https://cdn.instadapp.io/icons/jupiter/tokens/usdc.png"
        tokenName="USD Coin"
        apyFormatted="5.1%"
        type="debt"
        borrowed={data.debtAmount}
        supplied={data.collateralAmount}
        suppliedUsd={data.collateralUSD}
        solPrice={data.solPrice}
        vaultId={vaultId}
        positionId={positionId}
      />
      <DataCard
        suppliedAmount={data.collateralAmount || 0}
        suppliedToken="SOL"
        suppliedAPY={7.2}
        borrowedAmount={data.debtAmount || 0}
        borrowedToken="USDC"
        borrowedAPY={5.1}
        solPrice={data.solPrice}
      />
    </div>
  );
};

export default CardContainer;
