"use client";

import { usePosition } from "@/hooks/usePosition";
import { CustomCard } from "./ui/custom/card";
import { DataCard } from "./ui/custom/data-card";
import { LeverageLoop } from "./leverage/LeverageLoop";

const CardContainer = ({
  vaultId,
  positionId,
}: {
  vaultId: number;
  positionId: number;
}) => {
  const {
    formatted: data,
    loading,
    error,
  } = usePosition(vaultId, positionId);

  if (loading) {
    return (
      <div className="grid gap-5 lg:grid-cols-3 sm:grid-cols-2">
        {/* Supplied Collateral Skeleton */}
        <div className="overflow-hidden rounded-2xl border border-neutral-850 bg-[#0B121A] h-[210px] animate-pulse">
          <div className="border-b border-neutral-850 p-4 h-[50px] flex items-center justify-between">
            <div className="w-24 h-4 bg-white/5 rounded" />
            <div className="w-10 h-4 bg-white/5 rounded" />
          </div>
          <div className="p-4 space-y-3">
            <div className="w-1/2 h-8 bg-white/5 rounded" />
            <div className="w-1/3 h-4 bg-white/5 rounded" />
          </div>
          <div className="p-4 grid grid-cols-2 gap-4 border-t border-white/5">
            <div className="h-4 bg-white/5 rounded" />
            <div className="h-4 bg-white/5 rounded" />
          </div>
        </div>
        {/* Borrowed Debt Skeleton */}
        <div className="overflow-hidden rounded-2xl border border-neutral-850 bg-[#0B121A] h-[210px] animate-pulse">
          <div className="border-b border-neutral-850 p-4 h-[50px] flex items-center justify-between">
            <div className="w-24 h-4 bg-white/5 rounded" />
            <div className="w-10 h-4 bg-white/5 rounded" />
          </div>
          <div className="p-4 space-y-3">
            <div className="w-1/2 h-8 bg-white/5 rounded" />
            <div className="w-1/3 h-4 bg-white/5 rounded" />
          </div>
          <div className="p-4 grid grid-cols-2 gap-4 border-t border-white/5">
            <div className="h-4 bg-white/5 rounded" />
            <div className="h-4 bg-white/5 rounded" />
          </div>
        </div>
        {/* Data Card Skeleton */}
        <div className="overflow-hidden rounded-2xl border border-neutral-850 bg-[#0B121A] h-[210px] animate-pulse">
          <div className="p-4 space-y-4">
            <div className="flex justify-between"><div className="w-20 h-4 bg-white/5 rounded" /><div className="w-16 h-4 bg-white/5 rounded" /></div>
            <div className="flex justify-between"><div className="w-24 h-4 bg-white/5 rounded" /><div className="w-12 h-4 bg-white/5 rounded" /></div>
            <div className="flex justify-between"><div className="w-28 h-4 bg-white/5 rounded" /><div className="w-20 h-4 bg-white/5 rounded" /></div>
            <div className="pt-2">
              <div className="w-full h-1.5 bg-white/5 rounded-full" />
            </div>
          </div>
        </div>
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

  if (!data) {
    return (
      <div className="p-6 text-yellow-500 border border-yellow-500/20 bg-yellow-500/10 rounded-xl">
        No position found for this ID.
      </div>
    );
  }

  const collateralAmountFormatted =
    data.collateralAmount >= 1
      ? data.collateralAmount.toFixed(2)
      : data.collateralAmount.toFixed(6);
  const collateralUSDFormatted = `$${data.collateralUSD.toFixed(2)}`;
  const debtAmountFormatted = data.debtAmount.toFixed(2);
  const debtUSDFormatted = `$${data.debtUSD.toFixed(2)}`;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 slide-in-from-bottom-2">
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

      <div className="mx-auto max-w-2xl w-full">
        <LeverageLoop vaultId={vaultId} positionId={positionId} />
      </div>
    </div>
  );
};

export default CardContainer;
