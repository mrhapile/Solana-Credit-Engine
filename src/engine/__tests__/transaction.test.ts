import { describe, it, expect, vi, beforeEach } from "vitest";
import { createVersionedTransaction } from "@/engine/transaction";
import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import { ComputedTransaction } from "@/engine/types";
import BN from "bn.js";

describe("createVersionedTransaction", () => {
    const payer = new PublicKey("11111111111111111111111111111111");

    const mockComputed: ComputedTransaction = {
        instructions: [
            {
                keys: [],
                programId: new PublicKey("11111111111111111111111111111111"),
                data: Buffer.from([]),
            },
        ],
        computeBudgetInstructions: [],
        lookupTables: [],
        metadata: {
            expectedColLamports: new BN(0),
            expectedDebtLamports: new BN(0),
            computeUnits: 200000,
            priorityFeeMicroLamports: 1000,
        },
    };

    it("returns a VersionedTransaction", async () => {
        const connection = {
            getLatestBlockhash: vi.fn(async () => ({
                blockhash: "GfVcyD4kkTrj4bY6HfA2c9ePsVm9gNPEDFuMKFMRn1gJ",
                lastValidBlockHeight: 100000,
            })),
        } as any;

        const tx = await createVersionedTransaction(connection, mockComputed, payer);
        expect(tx).toBeInstanceOf(VersionedTransaction);
    });

    it("fetches blockhash with confirmed commitment", async () => {
        const getLatestBlockhash = vi.fn(async () => ({
            blockhash: "GfVcyD4kkTrj4bY6HfA2c9ePsVm9gNPEDFuMKFMRn1gJ",
            lastValidBlockHeight: 100000,
        }));

        const connection = { getLatestBlockhash } as any;

        await createVersionedTransaction(connection, mockComputed, payer);
        expect(getLatestBlockhash).toHaveBeenCalledWith("confirmed");
    });
});
