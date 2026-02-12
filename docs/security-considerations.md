
# Security Considerations

## Client-Side Trust Assumptions

1.  **RPC Integrity**: We assume the RPC node returns correct account data and simulation results.
2.  **Wallet Security**: We assume the user's wallet correctly signs the payload we built.

## Failure Modes & Handling

| Failure Mode | Detection | Handling |
| :--- | :--- | :--- |
| **Simulation Fail** | `simulation.err` is present | Abort. User sees error toast. |
| **Slippage** | Log analysis ("Slippage exceeded") | Abort. Suggest increasing slippage/retry. |
| **Insufficient Funds** | Log analysis ("0x1") | Abort. Suggest top-up. |
| **Blockhash Expired** | `BlockhashNotFound` or Timeout | User must re-sign with fresh blockhash. |
| **RPC Timeout** | `getSignatureStatus` loops indefinitely | Retry polling, then fail gracefully. |

## Compute Budget Risks

*   **Under-allocation**: Transaction fails with "Compute Budget Exceeded". We set a safe default (1.4M CU) which covers most lending ops.
*   **Over-payment**: We use a default priority fee (1000 micro-lamports). In congestion, this may be too low. Dynamic fee estimation is the next step.
