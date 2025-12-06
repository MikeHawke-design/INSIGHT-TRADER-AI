import { FreeCryptoAssetData } from '../types';

const BASE_URL = 'https://api.twelvedata.com';

export class TwelveDataApi {
    private apiKey?: string;

    constructor(apiKey?: string) {
        this.apiKey = apiKey;
    }



    // TwelveData doesn't have a simple "Top Assets" endpoint for free.
    // We will use a hardcoded list of major assets to fetch data for.
    // This list can be expanded or passed in.
    async getAssetDataBatch(symbols: string[]): Promise<FreeCryptoAssetData[]> {
        if (!this.apiKey) {
            console.warn("TwelveData API key missing.");
            return [];
        }

        // TwelveData allows batch requests for price, but for detailed data we might need individual calls or use /complex_data (premium).
        // However, /price endpoint supports batching: symbol=BTC/USD,ETH/USD
        // /quote endpoint also supports batching and gives change, volume etc.

        // Let's use /quote for batching (limit 8 per request on free plan usually, but let's try).
        // Actually, free plan limit is 8 requests per minute, but maybe batching works for multiple symbols?
        // Documentation says: symbol can be comma separated.

        // We will chunk the symbols to avoid URL length issues or limits.
        const chunks = [];
        const chunkSize = 8; // Conservative chunk size for free plan batching
        for (let i = 0; i < symbols.length; i += chunkSize) {
            chunks.push(symbols.slice(i, i + chunkSize));
        }

        let allData: FreeCryptoAssetData[] = [];

        for (const chunk of chunks) {
            try {
                const symbolString = chunk.join(',');
                const response = await fetch(`${BASE_URL}/quote?symbol=${symbolString}&apikey=${this.apiKey}`);

                if (!response.ok) continue;

                const data = await response.json();

                // If single result, it's an object. If multiple, it's an object with keys as symbols? 
                // TwelveData response format for batch: { "BTC/USD": { ... }, "ETH/USD": { ... } }
                // Or if single: { symbol: "BTC/USD", ... }

                let items: any[] = [];
                if (data.symbol) {
                    items = [data];
                } else {
                    items = Object.values(data);
                }

                const mapped = items.map((item: any) => {
                    if (!item.symbol) return null;
                    return {
                        symbol: item.symbol,
                        price: parseFloat(item.close) || parseFloat(item.previous_close) || 0, // Quote gives open, high, low, close, volume, etc.
                        change_24h: parseFloat(item.percent_change) || 0,
                        market_cap: 0, // TwelveData quote doesn't always give market cap easily
                        volume: parseFloat(item.volume) || 0
                    };
                }).filter(i => i !== null) as FreeCryptoAssetData[];

                allData = [...allData, ...mapped];

            } catch (e) {
                console.error("TwelveData batch fetch failed", e);
            }

            // Respect rate limits (800/day is ~1 per minute if continuous, but burst is allowed).
            // We should add a small delay.
            await new Promise(r => setTimeout(r, 1000));
        }

        return allData;
    }

    async getCandles(symbol: string, interval: string): Promise<any[]> {
        if (!this.apiKey) return [];

        // Map interval
        // 15m -> 15min
        // 1h -> 1h
        // 4h -> 4h
        // 1d -> 1day
        let apiInterval = interval;
        if (interval === '15m') apiInterval = '15min';
        if (interval === '1d') apiInterval = '1day';

        try {
            const response = await fetch(`${BASE_URL}/time_series?symbol=${symbol}&interval=${apiInterval}&apikey=${this.apiKey}&outputsize=30&format=JSON`);
            if (response.ok) {
                const data = await response.json();
                if (data.values && Array.isArray(data.values)) {
                    // TwelveData returns: { values: [ { datetime, open, high, low, close, volume }, ... ] }
                    // We need to map to array of arrays: [time, open, high, low, close] (timestamp as number or string)
                    return data.values.map((c: any) => [
                        c.datetime,
                        parseFloat(c.open),
                        parseFloat(c.high),
                        parseFloat(c.low),
                        parseFloat(c.close),
                        parseFloat(c.volume || 0)
                    ]).reverse(); // TwelveData returns newest first, we usually want oldest first or consistent. 
                    // Actually our prompt formatter expects array. Let's keep it consistent.
                }
            }
        } catch (e) {
            console.error(`Failed to fetch candles for ${symbol}:`, e);
        }
        return [];
    }
}
