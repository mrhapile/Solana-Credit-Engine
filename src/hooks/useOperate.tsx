import { useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { getConnection } from "@/lib/solana";
import { TransactionInstruction, Connection } from "@solana/web3.js";
import { executeLendingTransaction, EngineError } from "@/engine/executor";
import { toast } from "sonner";
import { TxFailureType, LendingTransactionInput } from "@/engine/types";
import { useTransactionLifecycle, TransactionStatus } from "@/hooks/transactions/useTransactionLifecycle";

export function useOperate(vaultId: number, positionId: number) {
  const wallet = useWallet();
  const lifecycle = useTransactionLifecycle();

  const operate = useCallback(
    async (
      colAmount: number, // In UI units
      debtAmount: number, // In UI units
      preInstructions: TransactionInstruction[] = [],
      postInstructions: TransactionInstruction[] = [],
      simulateOnly: boolean = false
    ) => {
      if (!wallet.publicKey) {
        toast.error("Wallet Not Connected");
        return;
      }

      // Reset state for new operation
      lifecycle.reset();
      lifecycle.setStatus('building');

      try {
        const connection = getConnection();
        const input: LendingTransactionInput = {
          vaultId,
          positionId,
          colAmount,
          debtAmount,
          userPublicKey: wallet.publicKey,
          preInstructions,
          postInstructions,
          simulateOnly,
        };

        // We wrap the executor to hook into lifecycle events via callbacks if we modify executor.ts
        // OR we just rely on the fact executor is async and linear.
        // To support "Awaiting Signature" we need to split execution OR pass callbacks.
        // For Phase 2 Requirement: "UI must react to state transitions."
        // We will refactor executor to accept onStatusChange callback.

        const result = await executeLendingTransaction(
          connection,
          wallet,
          input,
          {
            onStatusChange: (status) => lifecycle.setStatus(status),
            onSimulationSuccess: (units, fee) => lifecycle.setSimulationResults(units, fee, (units * fee) / 1e9),
            onTxSent: (sig, link) => lifecycle.setSignature(sig, link)
          }
        );

        if (simulateOnly) {
          // If simulate only, we don't want to set 'success' status really, we want to stay in 'optimizing' or similar?
          // Actually, the component expects to see the stats.
          // Status 'idle' or 'building' might hide the preview? No, preview checks for 'hasResults'.
          // Let's set status back to idle? Or keep it 'optimizing'?
          // The modal uses `hasResults` to show data.
          // We should NOT set 'success' because that implies on-chain success in explorer.

          // We just stay in a 'ready' state? Or 'optimizing'?
          // The preview modal uses `hasResults`.
          // Let's set status to 'idle' but keep results? No.
          // `status` is used for showing spinner.
          // We can set status to 'simulating' -> NO, that shows spinner.
          // Set to 'building' -> No.
          // We need a status that means "Ready to Sign".
          // 'awaiting_signature' is arguably correct if we are about to ask?
          // But here we stop.
          // Let's just create a new specific status or rely on 'idle' + results.
          // However, if we reset on modal open, we lose results.
          lifecycle.setStatus('idle'); // We are done simulating.
          return "simulation";
        }

        lifecycle.setSuccess(
          0, // We can't easily get confirmed units without parsing tx details again or wait
          0  // For now 0
        );

        return result.signature;

      } catch (error: any) {
        console.error("Operation failed:", error);

        let message = "Transaction failed";
        let logs: string[] = [];

        if (error instanceof EngineError) {
          message = error.message;
          logs = error.logs;
        } else if (error instanceof Error) {
          message = error.message;
        }

        lifecycle.setError(message, logs);

        // Toast specific errors
        if (error?.type === TxFailureType.SimulationFailure) {
          toast.error("Simulation Failed", { description: message });
        } else {
          toast.error("Transaction Error", { description: message });
        }

        throw error;
      }
    },
    [vaultId, positionId, wallet, lifecycle]
  );

  const simulate = useCallback(
    async (colAmount: number, debtAmount: number, preInstructions: TransactionInstruction[] = [], postInstructions: TransactionInstruction[] = []) => {
      return operate(colAmount, debtAmount, preInstructions, postInstructions, true);
    },
    [operate]
  );

  return { operate, simulate, ...lifecycle };
}
