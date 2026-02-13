import { describe, it, expect } from "vitest";
import { parsePythPriceAccount } from "@/lib/pyth";

// ─── Pyth Oracle Parser Tests ───────────────────────────────────
describe("parsePythPriceAccount", () => {
    it("returns null for buffer too small", () => {
        const buf = Buffer.alloc(100);
        expect(parsePythPriceAccount(buf)).toBeNull();
    });

    it("returns null for wrong magic number", () => {
        const buf = Buffer.alloc(300);
        buf.writeUInt32LE(0xdeadbeef, 0); // wrong magic
        expect(parsePythPriceAccount(buf)).toBeNull();
    });

    it("parses a valid V2 price account correctly", () => {
        const buf = Buffer.alloc(300);

        // Magic (0xa1b2c3d4 LE)
        buf.writeUInt32LE(0xa1b2c3d4, 0);

        // Exponent at offset 20 (e.g., -8 for 8 decimal places)
        buf.writeInt32LE(-8, 20);

        // Aggregate price at offset 208 (int64 LE)
        // Price: 15023456789 → 150.23456789 when exponent is -8
        buf.writeBigInt64LE(BigInt(15023456789), 208);

        // Confidence at offset 216 (uint64 LE)
        buf.writeBigUInt64LE(BigInt(1000000), 216);

        // Status at offset 224 (1 = Trading)
        buf.writeUInt32LE(1, 224);

        const result = parsePythPriceAccount(buf);
        expect(result).not.toBeNull();
        expect(result!.price).toBe(15023456789);
        expect(result!.exponent).toBe(-8);
        expect(result!.status).toBe(1);
        expect(result!.confidence).toBe(1000000);

        // Verify normalized price: price * 10^exponent
        const normalizedPrice = result!.price * Math.pow(10, result!.exponent);
        expect(normalizedPrice).toBeCloseTo(150.23456789, 4);
    });

    it("handles negative prices (edge case)", () => {
        const buf = Buffer.alloc(300);
        buf.writeUInt32LE(0xa1b2c3d4, 0);
        buf.writeInt32LE(-8, 20);
        buf.writeBigInt64LE(BigInt(-10000000000), 208); // Negative price
        buf.writeBigUInt64LE(BigInt(0), 216);
        buf.writeUInt32LE(1, 224);

        const result = parsePythPriceAccount(buf);
        expect(result).not.toBeNull();
        expect(result!.price).toBeLessThan(0);
    });

    it("handles zero price", () => {
        const buf = Buffer.alloc(300);
        buf.writeUInt32LE(0xa1b2c3d4, 0);
        buf.writeInt32LE(-8, 20);
        buf.writeBigInt64LE(BigInt(0), 208); // Zero price
        buf.writeBigUInt64LE(BigInt(0), 216);
        buf.writeUInt32LE(0, 224); // Not trading

        const result = parsePythPriceAccount(buf);
        expect(result).not.toBeNull();
        expect(result!.price).toBe(0);
        expect(result!.status).toBe(0);
    });
});
