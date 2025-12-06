
import { FreeCryptoAssetData } from '../types';

const BASE_URL = 'https://api.freecryptoapi.com/v1';

export class FreeCryptoApi {
    private apiKey?: string;

    constructor(apiKey?: string) {
        this.apiKey = apiKey;
    }

    private getHeaders(): HeadersInit {
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
        };
        if (this.apiKey) {
            headers['Authorization'] = `Bearer ${this.apiKey}`;
        }
        return headers;
    }

    async getAssetData(symbol: string): Promise<FreeCryptoAssetData | null> {
        // 1. Try FreeCryptoAPI if key is present
        if (this.apiKey) {
            try {
                const response = await fetch(`${BASE_URL}/getData?symbol=${symbol}`, {
                    headers: this.getHeaders(),
                });
                if (response.ok) {
                    return await response.json();
                }
            } catch (error) {
                console.warn(`FreeCryptoAPI failed for ${symbol}, trying fallback...`);
            }
        }

        // 2. Fallback to CoinGecko (Search by symbol to get ID, then fetch)
        // Note: This is inefficient for single lookups without ID. 
        // For this demo, we'll try to map common symbols or just return null if not found easily.
        // A better approach is to rely on getTopAssets which returns everything we need.
        try {
            // Quick map for major coins to avoid search overhead
            const commonMap: Record<string, string> = {
                'BTC': 'bitcoin', 'ETH': 'ethereum', 'SOL': 'solana', 'XRP': 'ripple',
                'ADA': 'cardano', 'DOGE': 'dogecoin', 'AVAX': 'avalanche-2', 'DOT': 'polkadot'
            };

            const id = commonMap[symbol.toUpperCase()];
            if (id) {
                const response = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${id}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.length > 0) {
                        const item = data[0];
                        return {
                            symbol: item.symbol.toUpperCase(),
                            price: item.current_price,
                            change_24h: item.price_change_percentage_24h,
                            market_cap: item.market_cap,
                            volume: item.total_volume
                        };
                    }
                }
            }
        } catch (e) {
            console.error("CoinGecko fallback failed:", e);
        }

        return null;
    }

    async getTopAssets(limit: number = 50): Promise<FreeCryptoAssetData[]> {
        // 1. Try FreeCryptoAPI
        if (this.apiKey) {
            try {
                const response = await fetch(`${BASE_URL}/getTop`, {
                    headers: this.getHeaders(),
                });
                if (response.ok) {
                    const data = await response.json();
                    if (Array.isArray(data)) return data.slice(0, limit);
                    if (data && Array.isArray(data.data)) return data.data.slice(0, limit);
                }
            } catch (error) {
                console.warn("FreeCryptoAPI getTop failed, trying fallback...", error);
            }
        }

        // 2. Fallback to CoinGecko
        try {
            console.log("Fetching top assets from CoinGecko...");
            const response = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false`);
            if (response.ok) {
                const data = await response.json();
                return data.map((item: any) => ({
                    symbol: item.symbol.toUpperCase(),
                    price: item.current_price,
                    change_24h: item.price_change_percentage_24h,
                    market_cap: item.market_cap,
                    volume: item.total_volume
                    // Technicals not available in this endpoint
                }));
            }
        } catch (error) {
            console.error("CoinGecko fallback failed:", error);
        }

        return [];
    }

    async getTechnicalAnalysis(symbol: string): Promise<any | null> {
        if (!this.apiKey) return null; // No fallback for technicals
        try {
            const response = await fetch(`${BASE_URL}/getTechnicalAnalysis?symbol=${symbol}`, {
                headers: this.getHeaders(),
            });
            if (response.ok) return await response.json();
        } catch (error) {
            return null;
        }
        return null;
    }
}

export const formatAssetDataForPrompt = (data: FreeCryptoAssetData): string => {
    let output = `Symbol: ${data.symbol}\n`;
    output += `Price: $${data.price}\n`;
    output += `24h Change: ${data.change_24h}%\n`;
    output += `Volume: $${data.volume}\n`;
    output += `Market Cap: $${data.market_cap}\n`;

    if (data.technical) {
        output += `Technical Indicators:\n`;
        output += `  RSI: ${data.technical.rsi}\n`;
        output += `  Signal: ${data.technical.signal}\n`;
    }
    return output;
};
