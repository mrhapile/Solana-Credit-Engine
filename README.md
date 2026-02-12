
# Solana Lending Transaction Reliability Engine

> A deterministic, simulation-first lending interface built on the Jupiter SDK. Refactored for robust transaction handling, safety checks, and observability.

## Overview

This project implements a production-grade transaction engine for Solana lending protocols. Unlike standard UI implementations, this engine prioritizes **determinism**, **safety**, and **observability**.

It features a pure-function transaction builder, pre-execution simulation with error mapping, and a robust confirmation loop with exponential backoff.

![Architecture](https://github.com/user-attachments/assets/52834e9d-62a8-4dcf-8f0d-254926bfb0d0) 
*(Note: Video links from original repo preserved below)*

## Core Engineering Features

### 1. Deterministic Transaction Builder (`src/engine/builder.ts`)
- **Pure Function Logic**: Transaction construction is separated from network side-effects.
- **Dynamic Normalization**: Handles token decimals and ATA creation logic deterministically.
- **Compute Budgeting**: Automatic priority fee and compute unit allocation.

### 2. Pre-Execution Simulation (`src/engine/simulation.ts`)
- **Safety Check**: Every transaction is simulated against the latest blockhash before user signing.
- **Error Classification**: Maps opaque program errors (e.g., `0x1`) to human-readable states (Insufficient Funds, Slippage).
- **Zero-Waste**: Prevents users from paying gas for failed transactions.

### 3. Robust Confirmation Engine (`src/engine/confirmation.ts`)
- **Polled Finality**: Does not rely on WebSocket instability.
- **Exponential Backoff**: Handles network congestion gracefully.
- **Idempotency**: Designed to safely handle retries.

### 4. Real-Time Observability
- **TanStack Query**: Replaced legacy `useEffect` chains with robust, cached polling.
- **Live Pricing**: Integrated Jupiter Price API for real-time LTV calculations.

## Architecture

See [docs/architecture.md](docs/architecture.md) for a detailed breakdown of the data flow and state management.

## Getting Started

```bash
npm install
npm run dev
```

Run the unit tests for the deterministic builder:

```bash
npm test
```

## Documentation

- [Transaction Lifecycle](docs/transaction-lifecycle.md)
- [Security Considerations](docs/security-considerations.md)
- [Architecture](docs/architecture.md)

## Tech Stack

- **Engine**: TypeScript, `@solana/web3.js`
- **State**: TanStack Query (React Query)
- **Protocol**: Jupiter Lending SDK (`@jup-ag/lend`)
- **Testing**: Vitest
