
import { useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { getConnection } from "@/lib/solana";
import { TransactionInstruction } from "@solana/web3.js";
import { executeLendingTransaction } from "@/engine/executor";
import { toast } from "sonner";
import { TxFailureType } from "@/engine/types";

export function useOperate(vaultId: number, positionId: number) {
  const wallet = useWallet();

  const operate = useCallback(
    async (
      colAmount: number, // In UI units (e.g. 1.5 SOL)
      debtAmount: number, // In UI units (e.g. 100 USDC)
      preInstructions: TransactionInstruction[] = []
    ) => {
      if (!wallet.publicKey) {
        throw new Error("Wallet not connected");
      }

      console.log("Initiating operation:", { colAmount, debtAmount });

      try {
        const result = await executeLendingTransaction(
          getConnection(),
          wallet,
          {
            vaultId,
            positionId,
            colAmount,
            debtAmount,
            userPublicKey: wallet.publicKey,
            preInstructions,
            // In production, fetch these dynamically
            // priorityFeeMicroLamports: fetchedPriorityFee
          }
        );

        return result.signature;
      } catch (error: any) {
        console.error("Operation failed:", error);

        // Map engine errors to user-friendly toasts if needed, 
        // though executeLendingTransaction throws structured errors.
        if (error.type === TxFailureType.SimulationFailure) {
          toast.error("Transaction Simulation Failed", {
            description: "The transaction is likely to fail. Please check your inputs or try again later.",
          });
        }

        throw error;
      }
    },
    [vaultId, positionId, wallet]
  );

  return { operate };
}
