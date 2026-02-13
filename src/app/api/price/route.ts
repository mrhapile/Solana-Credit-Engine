import { NextResponse } from "next/server";
import { getSolPrice } from "@/lib/pyth";

export const runtime = "nodejs";

export async function GET() {
    try {
        const result = await getSolPrice();

        return NextResponse.json({
            price: result.price,
            confidence: result.confidence,
            source: result.source,
            timestamp: Date.now()
        }, {
            status: 200,
            headers: {
                "Cache-Control": "public, s-maxage=30, stale-while-revalidate=59"
            }
        });
    } catch (error: any) {
        console.error("Price API Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch price" },
            { status: 500 }
        );
    }
}
