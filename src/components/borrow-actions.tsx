import React from "react";

export const BorrowActions = () => {
  return (
    <div className="flex flex-col gap-4">
      <nav className="flex items-center gap-2">
        <div className="group relative overflow-hidden">
          <div className="hideScrollbar overflow-x-auto overflow-y-hidden flex items-center gap-2">
            <a className="flex items-center cursor-pointer justify-center gap-2 rounded-3xl px-4 py-2.5 text-sm hover:bg-primary/5 hover:text-primary bg-primary/5 text-primary-200">
              Actions
            </a>
            <a className="flex items-center cursor-pointer justify-center gap-2 rounded-3xl px-4 py-2.5 text-sm text-neutral-500 hover:bg-primary/5 hover:text-primary">
              Stats
            </a>
            <a className="flex items-center cursor-pointer justify-center gap-2 rounded-3xl px-4 py-2.5 text-sm text-neutral-500 hover:bg-primary/5 hover:text-primary">
              History
            </a>
          </div>
        </div>
      </nav>
      <div className="grid gap-3 sm:grid-cols-3">
        <a className="flex cursor-pointer flex-col gap-1.5 rounded-xl p-4 ring-1 ring-neutral-800 transition-colors hover:bg-primary/5 hover:ring-primary">
          <h3 className="text-sm/5">Deposit &amp; Borrow</h3>
          <p className="text-xs text-neutral-500">
            Deposit collateral &amp; borrow asset in a single txn.
          </p>
        </a>
        <a className="flex cursor-pointer flex-col gap-1.5 rounded-xl p-4 ring-1 ring-neutral-800 transition-colors hover:bg-primary/5 hover:ring-primary">
          <h3 className="text-sm/5">Repay &amp; Withdraw</h3>
          <p className="text-xs text-neutral-500">
            Repay debt &amp; withdraw collateral in a single txn.
          </p>
        </a>
        <a className="flex cursor-pointer flex-col gap-1.5 rounded-xl p-4 ring-1 ring-neutral-800 transition-colors hover:bg-primary/5 hover:ring-primary">
          <h3 className="text-sm/5">Leverage</h3>
          <p className="text-xs text-neutral-500">
            Increase your leverage by borrowing, swapping the borrowed token to
            match your collateral and redepositing it.
          </p>
        </a>
        <a className="flex cursor-pointer flex-col gap-1.5 rounded-xl p-4 ring-1 ring-neutral-800 transition-colors hover:bg-primary/5 hover:ring-primary">
          <h3 className="text-sm/5">Deleverage</h3>
          <p className="text-xs text-neutral-500">
            Utilise your deposited collateral to pay down your debt. This
            reduces your leverage and liquidation risk.
          </p>
        </a>
      </div>
    </div>
  );
};
