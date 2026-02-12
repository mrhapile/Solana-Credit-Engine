
# Architecture: Solana Lending Reliability Engine

## Core Modules

*   **`src/engine/builder.ts`**: Pure function to construct transaction instructions.
*   **`src/engine/simulation.ts`**: Pre-execution validation logic.
*   **`src/engine/executor.ts`**: Orchestrator for the Build-Simulate-Send-Confirm loop.
*   **`src/engine/confirmation.ts`**: Robust polling with exponential backoff.

## Data Flow

1.  **UI Component** (`DepositModal`) collects inputs.
2.  **Hook** (`useOperate`) calls `executeLendingTransaction`.
3.  **Executor** builds and simulates.
4.  **Wallet** signs.
5.  **RPC** broadcasts and confirms.
6.  **React Query** (`usePosition`) detects chain update and re-fetches state.

## State Management

*   **TanStack Query** replaces `useEffect`.
*   **Polling**: Every 10s for position, 60s for prices.
*   **Cache**: Invalidated on successful transaction to show immediate updates.
