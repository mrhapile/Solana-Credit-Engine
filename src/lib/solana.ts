
import { Connection } from '@solana/web3.js';

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;

if (!RPC_URL) {
    throw new Error(
        "NEXT_PUBLIC_SOLANA_RPC_URL is not defined. Add it to .env.local"
    );
}

// Log RPC URL initialization (masked)
console.log("Initializing RPC Connection to:", RPC_URL.replace(/(\?|&)(api-key|key)=[^&]*/, "$1key=***"));

export function getConnection() {
    return new Connection(RPC_URL!, {
        commitment: "confirmed",
        // Disable automatic fetch helper that might strip params? No, default is fine.
        // Some libraries like Anchor might need a provider, but we are passing connection directly.
    });
}
