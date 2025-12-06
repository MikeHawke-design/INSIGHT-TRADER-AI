
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

    private coinMap: Map<string, string> = new Map();

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

        // 2. Fallback to CoinGecko
        try {
            let id = this.coinMap.get(symbol.toUpperCase());

            // If not in cache, try common map or search
            if (!id) {
                const commonMap: Record<string, string> = {
                    'BTC': 'bitcoin', 'ETH': 'ethereum', 'SOL': 'solana', 'XRP': 'ripple',
                    'ADA': 'cardano', 'DOGE': 'dogecoin', 'AVAX': 'avalanche-2', 'DOT': 'polkadot',
                    'BNB': 'binancecoin', 'USDT': 'tether', 'USDC': 'usd-coin', 'TRX': 'tron',
                    'LINK': 'chainlink', 'MATIC': 'matic-network', 'SHIB': 'shiba-inu', 'LTC': 'litecoin'
                };
                id = commonMap[symbol.toUpperCase()];
            }

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
                    let result = [];
                    if (Array.isArray(data)) result = data.slice(0, limit);
                    else if (data && Array.isArray(data.data)) result = data.data.slice(0, limit);

                    // Attempt to populate coinMap for future use if possible (FreeCryptoAPI might not give IDs)
                    return result;
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

                // Populate cache
                data.forEach((item: any) => {
                    this.coinMap.set(item.symbol.toUpperCase(), item.id);
                });

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

    async getCandles(symbol: string, timeframe: string): Promise<any[]> {
        try {
            let id = this.coinMap.get(symbol.toUpperCase());
            if (!id) {
                // Try common map if not in cache
                const commonMap: Record<string, string> = {
                    'BTC': 'bitcoin', 'ETH': 'ethereum', 'SOL': 'solana', 'XRP': 'ripple',
                    'ADA': 'cardano', 'DOGE': 'dogecoin', 'AVAX': 'avalanche-2', 'DOT': 'polkadot',
                    'BNB': 'binancecoin', 'USDT': 'tether', 'USDC': 'usd-coin', 'TRX': 'tron',
                    'LINK': 'chainlink', 'MATIC': 'matic-network', 'SHIB': 'shiba-inu', 'LTC': 'litecoin'
                };
                id = commonMap[symbol.toUpperCase()];
            }

            if (!id) return [];

            // Map timeframe to days
            // 15m/1h -> 1 day (30m candles)
            // 4h -> 30 days (4h candles)
            // 1d -> 365 days (4d candles) - CoinGecko is limited here. 
            // Better mapping:
            // 1 day (minutely/hourly data)
            // 7 days (hourly)
            // 30 days (4-hourly)
            // 90 days (daily)

            let days = '1';
            if (timeframe === '4h') days = '30';
            if (timeframe === '1d') days = '90'; // 90 days gives daily candles usually

            const response = await fetch(`https://api.coingecko.com/api/v3/coins/${id}/ohlc?vs_currency=usd&days=${days}`);
            if (response.ok) {
                return await response.json(); // Returns [time, open, high, low, close][]
            }
        } catch (e) {
            console.error(`Failed to fetch candles for ${symbol}:`, e);
        }
        return [];
    }
}

export const formatAssetDataForPrompt = (data: FreeCryptoAssetData, candles?: any[]): string => {
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

    if (candles && candles.length > 0) {
        output += `\nRecent Candle Data (OHLC) - Use this for Structure Analysis:\n`;
        output += `Time (Approx) | Open | High | Low | Close\n`;
        // Show last 15 candles
        const recentCandles = candles.slice(-15);
        recentCandles.forEach(c => {
            const date = new Date(c[0]).toLocaleTimeString();
            output += `${date} | ${c[1]} | ${c[2]} | ${c[3]} | ${c[4]}\n`;
        });
    }

    return output;
};
