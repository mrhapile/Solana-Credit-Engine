
import { PublicKey, TransactionInstruction, VersionedTransaction, AddressLookupTableAccount } from "@solana/web3.js";
import BN from "bn.js";

export interface LendingTransactionInput {
    vaultId: number;
    positionId: number;
    colAmount: number; // In natural units (e.g., 1.5 SOL), not lamports
    debtAmount: number; // In natural units (e.g., 100 USDC)
    userPublicKey: PublicKey;
    solPrice?: number; // Optional prompt for simulation
    slippageBps?: number; // Basis points
    priorityFeeMicroLamports?: number;
    computeUnits?: number;
    preInstructions?: TransactionInstruction[];
}

export interface ComputedTransaction {
    instructions: TransactionInstruction[];
    computeBudgetInstructions: TransactionInstruction[];
    lookupTables: AddressLookupTableAccount[];
    metadata: {
        expectedColLamports: BN;
        expectedDebtLamports: BN;
        computeUnits: number;
        priorityFeeMicroLamports: number;
    };
}

export enum TxFailureType {
    SimulationFailure = "SimulationFailure",
    InsufficientFunds = "InsufficientFunds",
    SlippageExceeded = "SlippageExceeded",
    RPCError = "RPCError",
    BlockhashExpired = "BlockhashExpired",
    Unknown = "Unknown",
}

export interface SimulationResult {
    success: boolean;
    failureType?: TxFailureType;
    logs: string[];
    unitsConsumed?: number;
    error?: string;
}
