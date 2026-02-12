
export interface PriceData {
    [mint: string]: number;
}

const PRICE_API = "https://api.jup.ag/price/v2?ids=";

export async function fetchTokenPrices(mints: string[]): Promise<PriceData> {
    if (mints.length === 0) return {};

    try {
        const response = await fetch(`${PRICE_API}${mints.join(",")}`);
        const json = await response.json();

        // Validate response structure
        if (!json.data) return {};

        const prices: PriceData = {};
        for (const mint of mints) {
            if (json.data[mint]) {
                prices[mint] = parseFloat(json.data[mint].price);
            }
        }
        return prices;
    } catch (error) {
        console.error("Failed to fetch prices:", error);
        return {};
    }
}
