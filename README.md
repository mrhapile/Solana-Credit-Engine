# Solana Credit Engine

## 1. Overview

The Solana Credit Engine is a production-grade transaction orchestration and risk simulation layer built for high-frequency DeFi lending protocols. It acts as a safety middleware between the user interface and the on-chain Solana program, solving the critical problem of opaque transaction failures and silent liquidation risks common in naive dApps.

Unlike basic UI wrappers, this engine enforces a **simulation-first architecture**: no transaction is ever signed without a successful pre-flight simulation that validates solvency, compute budget, and slippage tolerance. It integrates directly with on-chain Pyth oracles for real-time risk assessment and employs an atomic leverage loop strategy to execute complex multi-instruction borrowing workflows in a single slot. The system is hardened against RPC instability through a custom spacing guard and exponential backoff strategies, ensuring institutional-grade reliability even during network congestion.

-------------------------------------------------------------------

## 2. System Architecture

The system is composed of four distinct engineering modules designed for reliability and correctness.

### 2.1 Transaction Engine
The execution pipeline follows a strict, deterministic state machine: `Build → Simulate → Optimize → Sign → Send → Confirm`.
- **Simulation**: Every transaction is simulated against the current block state before user approval. This catches errors (e.g., "Slippage Exceeded", "LTV Too High") without wasting gas or user time.
- **Optimization**: Post-simulation, the engine calculates the exact Compute Unit (CU) consumption + 10% buffer and injects a dynamic `SetComputeUnitLimit` instruction.
- **Priority Fees**: To ensure inclusion during congestion, the engine samples recent priority fees from the last 20 blocks and attaches a `SetComputeUnitPrice` instruction (capped at a reasonable maximum).
- **RPC Guard**: A centralized `safeRpcCall` wrapper forces a minimum 200ms spacing between non-cached read operations to prevent rate-limit bans.

### 2.2 Risk Engine
The risk module is the source of truth for user solvency, operating entirely on `BN.js` big integers to prevent floating-point precision errors.
- **Health Factor (HF)**: Calculated as `(Collateral Value * Liquidation Threshold) / Debt Value`. An HF < 1.0 indicates immediate liquidation risk.
- **Liquidation Price**: The precise asset price at which `HF = 1.0`. `Liquidation Price = Debt Quote Value / (Collateral Amount * Liquidation Threshold)`.
- **Client-Side Safety**: While the protocol enforces these rules on-chain, the client-side engine mirrors this logic to provide instant "What-If" feedback during the leverage loop construction (e.g., "If I borrow 10 more SOL, what is my new liquidation price?").

### 2.3 Oracle Integration
The engine bypasses slow REST APIs in favor of direct on-chain reads from **Pyth Network** price accounts.
- **Zero-Dependency Parsing**: We implement a custom `parsePythPriceAccount` utility using `DataView` (removing Node.js `Buffer` dependencies) to read raw price, confidence, and exponent data directly from account info.
- **Staleness Protection**: Prices older than 60 slots are rejected.
- **Server-Side API Route**: To protect the client from `429` bursts and CORS issues, a specialized Next.js API route (`/api/price`) proxies and caches oracle fetching with a `stale-while-revalidate` strategy.
- **Commitment**: Readings use `processed` commitment for the fastest possible UI feedback loop, while transactions use `confirmed` for safety.

### 2.4 RPC Stability Model
Reliability is enforced through a strict "governance" layer over the `Connection` object:
- **Burst Mitigation**: "Staggered Hydration" delays high-frequency calls (like fetching positions) by 200-800ms on initial load to prevent `429 Too Many Requests` errors.
- **Retry Logic**: The internal `web3.js` retry logic is disabled (`disableRetryOnRateLimit: true`) in favor of our custom handler that surfacing human-readable "Network Congestion" states to the UI rather than silent failures.
- **Polling**: Position data is polled every 30 seconds using smart cache invalidation (TanStack Query) to keep data fresh without overloading the customized RPC endpoint.

-------------------------------------------------------------------

## 3. Feature Set

- **Deposit / Withdraw**: Standard collateral management with max-amount validation and decimal-aware input parsing.
- **Borrow / Repay**: Debt management with real-time LTV checks.
- **Atomic Leverage Loop**: A specialized instruction builder that composes `Flash Loan` (conceptually) or `Loop` logic: *Borrow USDC → Swap to SOL → Supply SOL* in a single atomic transaction.
- **Simulation Preview**: A dedicated UI state that shows "Expected Output" and "Projected Health Factor" derived from the simulation result logs before the user is asked to sign.
- **Transaction Explorer**: Parsing of simulation logs to provide deep links to Solscan for successful or failed transactions.
- **Real-Time Risk Projection**: Visual "Risk Meters" that change color (Green → Orange → Red) based on the projected post-transaction Health Factor.
- **Wallet Integration**: A fully memoized and stable wallet adapter implementation that prevents re-initialization loops and supports Phantom, Solflare, and Backpack checks effectively.

-------------------------------------------------------------------

## 4. Security Model

- **Simulation Before Signing**: The most critical security feature. Malicious or buggy payloads are detected during the invisible simulation step. If the simulation fails or predicts a revert, the user is never prompted to sign.
- **No Blind Wallet Popups**: Transactions are only proposed to the wallet after passing internal validation checks.
- **RPC Error Handling**: Errors are categorized into "Retryable" (Network) vs "Fatal" (Logic/Slippage) to guide the user correctly.
- **Confirmation Strategy**: The engine waits for `confirmed` commitment (approx. 400-800ms) before declaring success, ensuring the state has propagated to the majority of validators.
- **Non-Custodial**: The engine holds no keys. It only constructs standard SPL instruction payloads for the user's wallet to approve.

-------------------------------------------------------------------

## 5. Performance Optimizations

- **Commitment Downgrade**: Application read-path uses `processed` commitment to reduce latency by ~400ms compared to `confirmed`.
- **Decimal Cache**: Token decimals are fetched once and cached in a JS Map to avoid redundant `getMintAccount` calls.
- **Price Cache**: Oracle prices are cached server-side (30s TTL) and client-side (TanStack Query) to eliminate duplicate fetch requests.
- **Priority Fee Cache**: Priority fee estimates are cached for 60 seconds. We do not re-calculate fees for every simulation if a recent estimate exists.
- **React Query Discipline**: `refetchOnWindowFocus` is disabled to prevent accidental RPC spam when users tab-switch.

-------------------------------------------------------------------

## 6. Testing Strategy

The repository adheres to strict engineering testing standards:

- **Vitest Framework**: Used for unit and integration testing.
- **Coverage Metrics**: The core engine logic (`src/engine/`) maintains >90% test coverage.
- **Deterministic Timer Control**: Tests use "fake timers" to fast-forward through polling intervals and debounce windows, ensuring flaky-free CI execution.
- **Mocking Strategy**: External RPC calls are mocked using dependency injection patterns, allowing us to test "Network Offline" and "Rate Limit" scenarios deterministically.
