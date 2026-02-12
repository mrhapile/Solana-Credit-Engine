
# Transaction Lifecycle & Determinism

## Overview

This engine treats transactions as **pure functions of state**. For any given input (vault ID, user, amount) and blockchain state (blockhash, account existence), the transaction output is deterministic.

## Lifecycle Stages

1.  **Build (Deterministic)**
    *   Input: `LendingTransactionInput` (UI Units)
    *   Process:
        *   Normalize decimals (SOL=9, USDC=6).
        *   Check WSOL account existence (read-only).
        *   Generate ATA creation instruction if needed.
        *   Generate wrapping instructions (Transfer + Sync).
        *   Fetch core lending instructions from SDK.
        *   Append Compute Budget instructions (Priority Fee + Limit).
    *   Output: `ComputedTransaction` (Instructions + Lookup Tables).

2.  **Simulate (Validation)**
    *   Input: `ComputedTransaction` + `latestBlockhash`
    *   Process:
        *   Compile `VersionedTransaction`.
        *   Call `connection.simulateTransaction()`.
        *   Analyze logs for known errors (Slippage, Insufficient Funds).
    *   Output: `SimulationResult` (Success/Fail + Logs).

3.  **Sign & Send**
    *   Input: validated `VersionedTransaction`
    *   Process:
        *   User signs via Wallet Adapter.
        *   Send raw transaction to RPC (`maxRetries: 3`).

4.  **Confirm (Robustness)**
    *   Input: `signature`
    *   Process:
        *   Poll `getSignatureStatus` every 1s.
        *   Exponential backoff up to 5s.
        *   Timeout after 60s.

## Atomicity

All side effects (debiting user, crediting vault, updating state) happen atomically on-chain. If any instruction fails (e.g., slippage), the entire bundle reverts.
