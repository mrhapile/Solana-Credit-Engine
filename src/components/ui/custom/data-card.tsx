interface DataCardProps {
  suppliedAmount: number;
  suppliedToken: string;
  suppliedAPY: number;
  borrowedAmount: number;
  borrowedToken: string;
  borrowedAPY: number;
  solPrice?: number;
}

const calculateMetrics = (
  supply: number,
  borrow: number,
  supplyAPY: number,
  borrowAPY: number,
  price: number
) => {
  const maxLiquidationRatio = 0.8;
  const totalCollateralValue = supply * price;

  const netYield =
    totalCollateralValue > 0
      ? supplyAPY - (borrowAPY * borrow) / totalCollateralValue
      : 0;

  const priceAtLiquidation =
    supply > 0 && maxLiquidationRatio > 0
      ? borrow / (supply * maxLiquidationRatio)
      : 0;

  const priceDropPercent =
    priceAtLiquidation > 0 && price > 0
      ? ((price - priceAtLiquidation) / price) * 100
      : 0;

  const utilizationRatio =
    totalCollateralValue > 0
      ? Math.min((borrow / totalCollateralValue) * 100, 100)
      : 0;

  return {
    netYield,
    priceAtLiquidation,
    priceDropPercent,
    utilizationRatio,
    totalCollateralValue,
  };
};

const determineRiskLevel = (utilization: number) => {
  const thresholds = {
    critical: 80,
    high: 60,
    medium: 30,
  };

  if (utilization >= thresholds.critical) {
    return {
      label: "Liquidated",
      textColor: "text-red-500",
      background: "bg-red-400/20",
      progress: "bg-red-500",
    };
  }

  if (utilization >= thresholds.high) {
    return {
      label: "Risky",
      textColor: "text-orange-400",
      background: "bg-orange-400/20",
      progress: "bg-orange-500",
    };
  }

  if (utilization >= thresholds.medium) {
    return {
      label: "Moderate",
      textColor: "text-yellow-400",
      background: "bg-yellow-400/20",
      progress: "bg-yellow-400",
    };
  }

  return {
    label: "Safe",
    textColor: "text-emerald-400",
    background: "bg-emerald-400/20",
    progress: "bg-emerald-500",
  };
};

export const DataCard = ({
  suppliedAmount,
  suppliedToken,
  suppliedAPY,
  borrowedAmount,
  borrowedToken,
  borrowedAPY,
  solPrice = 142.5,
}: DataCardProps) => {
  const metrics = calculateMetrics(
    suppliedAmount,
    borrowedAmount,
    suppliedAPY,
    borrowedAPY,
    solPrice
  );

  const riskInfo = determineRiskLevel(metrics.utilizationRatio);

  return (
    <div className="relative flex flex-col justify-between gap-2 overflow-hidden rounded-xl border border-neutral-850 p-4">
      <div className="flex w-full items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm text-neutral-400">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="outline-none cursor-pointer text-neutral-400 underline decoration-neutral-600 decoration-dashed decoration-from-font underline-offset-4 text-sm"
              aria-haspopup="dialog"
              aria-expanded="false"
              aria-controls="radix-:rr:"
              data-state="closed"
              tabIndex={-1}
            >
              Position PNL (7D)
            </button>

            <button
              type="button"
              className="inline-flex items-center gap-1 text-neutral-400 hover:text-neutral-200 text-sm"
            >
              <span className="iconify inline-block shrink-0 ph--arrows-left-right-bold" />
            </button>
          </div>
          <span className="iconify ph--currency-dollar-bold" />
        </span>

        <div className="flex items-baseline gap-1.5">
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded="false"
            aria-controls="radix-:r12:"
            data-state="closed"
            className="outline-none"
            tabIndex={-1}
          >
            <div className="flex items-center gap-1">
              <span
                className="relative inline-flex items-center rounded-sm text-sm underline decoration-dashed decoration-from-font underline-offset-4 text-rose"
                data-num="-0.6083109151472285"
              >
                <span translate="no">-$0.60831</span>
              </span>
            </div>
          </button>
          <span className="text-sm text-neutral-400">(-16.23%)</span>
        </div>
      </div>

      <div className="flex w-full items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm text-neutral-400">
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded="false"
            aria-controls="radix-:rs:"
            data-state="closed"
            className="outline-none"
            tabIndex={-1}
          >
            <span className="underline decoration-neutral-600 decoration-dashed decoration-from-font underline-offset-4">
              Net APY
            </span>
          </button>
          <span className="iconify ph--percent" />
        </span>
        <span
          className={`text-sm ${
            metrics.netYield >= 0 ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {metrics.netYield >= 0 ? "+" : ""}
          {metrics.netYield.toFixed(2)}%
        </span>
      </div>

      <div className="flex w-full items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm text-neutral-400">
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded="false"
            aria-controls="radix-:rt:"
            data-state="closed"
            className="outline-none"
            tabIndex={-1}
          >
            <span className="underline decoration-neutral-600 decoration-dashed decoration-from-font underline-offset-4">
              Liq. Price/Offset
            </span>
          </button>
          <span className="iconify ph--align-left" />
        </span>

        <span className="text-sm text-neutral-200">
          <span className="relative inline-flex items-center rounded-sm">
            <span translate="no">
              {metrics.priceAtLiquidation.toFixed(2)} {borrowedToken}
            </span>
          </span>{" "}
          / {metrics.priceDropPercent.toFixed(2)}%
        </span>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex w-full items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm text-neutral-400">
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded="false"
              aria-controls="radix-:ru:"
              data-state="closed"
              className="outline-none"
              tabIndex={-1}
            >
              <span className="underline decoration-neutral-600 decoration-dashed decoration-from-font underline-offset-4">
                Position Health
              </span>
            </button>
            <span className="iconify ph--shield-check" />
          </span>

          <span className="flex items-center gap-2 text-neutral-200">
            <span className={`${riskInfo.textColor} text-sm`}>
              {riskInfo.label}
            </span>
            <span className="text-sm">
              {metrics.utilizationRatio.toFixed(2)}%
            </span>
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={metrics.utilizationRatio}
            aria-valuetext={`${metrics.utilizationRatio.toFixed(2)}%`}
            data-state="loading"
            data-value={metrics.utilizationRatio}
            data-max="100"
            className={`relative h-1.5 w-full overflow-hidden rounded-xl ${riskInfo.background}`}
            style={{ transform: "translateY(0px)" }}
          >
            <div
              data-state="loading"
              data-value={metrics.utilizationRatio}
              data-max="100"
              className={`h-full w-full transition-all duration-300 ${riskInfo.progress}`}
              style={{ width: `${Math.min(metrics.utilizationRatio, 100)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>{metrics.utilizationRatio.toFixed(2)}%</span>
            <span>Max: L.T. 80%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
