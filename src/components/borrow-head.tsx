import { ChevronLeft, Globe } from "lucide-react";
import Image from "next/image";
import { RadialProgressIcon } from "./icons/radial-progression";

export const HomeBorowHead = () => {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex items-center gap-4">
        <a href="/lend/borrow">
          <ChevronLeft className="size-5 text-neutral-200" />
        </a>
        <div className="flex items-center -space-x-4">
          <Image
            className="z-10 size-9 sm:size-10"
            height="32"
            width="32"
            alt="Wrapped SOL"
            src="https://cdn.instadapp.io/icons/jupiter/tokens/sol.png"
          />
          <Image
            className="size-9 sm:size-10"
            height="32"
            width="32"
            alt="USD Coin"
            src="https://cdn.instadapp.io/icons/jupiter/tokens/usdc.png"
          />
        </div>
        <div className="flex flex-col sm:gap-1">
          <div className="flex items-center gap-1 text-xl">
            <h2 className="text-xl font-semibold text-neutral-200 sm:text-2xl">
              SOL/USDC
            </h2>
            <span className="text-sm text-neutral-500 sm:text-base">#1</span>
          </div>
          <span className="text-xs text-neutral-500">
            Supply SOL to Borrow USDC
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="outline-none flex size-7 items-center justify-center rounded-full border border-neutral-800 text-neutral-400 data-[state=open]:border-primary data-[state=open]:text-primary"
            aria-haspopup="dialog"
            aria-expanded="false"
            aria-controls="radix-:ri:"
            data-state="closed"
            tabIndex={-1}
          >
            <Globe className="size-4" />
          </span>
          <span
            className="outline-none flex cursor-pointer items-center size-7"
            aria-haspopup="dialog"
            aria-expanded="false"
            aria-controls="radix-:rj:"
            data-state="closed"
            tabIndex={-1}
          >
            <div
              className="recharts-responsive-container cursor-pointer"
              style={{
                width: "100%",
                height: "100%",
                minWidth: "0px",
              }}
            >
              <div
                className="recharts-wrapper"
                style={{
                  position: "relative",
                  cursor: "default",
                  width: "100%",
                  height: "100%",
                  maxHeight: "28px",
                  maxWidth: "28px",
                }}
              >
                <RadialProgressIcon />
              </div>
            </div>
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between rounded-xl border p-4 lg:ml-auto lg:justify-normal lg:gap-8 lg:border-0 lg:p-0">
        <div className="flex flex-col gap-1 lg:flex-row lg:items-center lg:gap-3">
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded="false"
            aria-controls="radix-:rk:"
            data-state="closed"
            className="outline-none"
          >
            <span className="text-xs text-neutral-500 underline decoration-neutral-600 decoration-dashed decoration-from-font underline-offset-4">
              LTV
            </span>
          </button>
          <span className="font-semibold text-neutral-200">75%</span>
        </div>
        <div className="flex flex-col items-center gap-1 lg:flex-row lg:gap-3">
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded="false"
            aria-controls="radix-:rl:"
            data-state="closed"
            className="outline-none"
            tabIndex={-1}
          >
            <span className="text-xs text-neutral-500 underline decoration-neutral-600 decoration-dashed decoration-from-font underline-offset-4">
              Liq. Threshold
            </span>
          </button>
          <span className="font-semibold text-neutral-200">80%</span>
        </div>
        <div className="flex flex-col items-end gap-1 lg:flex-row lg:items-center lg:gap-3">
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded="false"
            aria-controls="radix-:rm:"
            data-state="closed"
            className="outline-none"
            tabIndex={-1}
          >
            <span className="text-xs text-neutral-500 underline decoration-neutral-600 decoration-dashed decoration-from-font underline-offset-4">
              Liq. Penalty
            </span>
          </button>
          <span className="font-semibold text-neutral-200">1%</span>
        </div>
      </div>
    </div>
  );
};
