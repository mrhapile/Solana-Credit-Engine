# Contributing to Solana Credit Engine

Thank you for your interest in contributing to the Solana Credit Engine. As an engineering-first project, we maintain high standards for code quality, testing, and architectural integrity.

## Development Workflow

1.  **Fork the repository** and create your branch from `main`.
2.  **Install dependencies**: `npm install`.
3.  **Run development server**: `npm run dev`.
4.  **Ensure type safety**: `npm run type-check`.
5.  **Run tests**: `npm test`.
6.  **Verify coverage**: `npm run test:coverage` (Target: >70% for engine and lib).

## Architectural Guidelines

-   **Engine Isolation**: Core logic resides in `src/engine`. It must remain pure and decoupled from React hooks wherever possible.
-   **RPC Hygiene**: All RPC calls must go through the `RPC Guard` to handle rate limits and transient failures.
-   **Safety First**: Use `BN.js` for all on-chain amount calculations. Avoid floating-point math for raw lamport values.
-   **Documentation**: Every new feature requires a technical explanation in the `docs/` folder or an update to the README.

## Pull Request Process

-   Include unit tests for any logic changes.
-   Ensure CI passes on your PR.
-   Update the documentation if you are changing user-facing features or architectural patterns.
