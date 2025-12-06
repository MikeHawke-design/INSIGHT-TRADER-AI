
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
        try {
            const response = await fetch(`${BASE_URL}/getData?symbol=${symbol}`, {
                headers: this.getHeaders(),
            });

            if (!response.ok) {
                console.warn(`FreeCryptoAPI: Failed to fetch data for ${symbol}. Status: ${response.status}`);
                return null;
            }

            const data = await response.json();
            // The API might return an object or an array depending on the endpoint.
            // Based on user snippet: { "symbol": "BTC", ... }
            return data;
        } catch (error) {
            console.error(`FreeCryptoAPI Error fetching ${symbol}:`, error);
            return null;
        }
    }

    async getTopAssets(limit: number = 50): Promise<FreeCryptoAssetData[]> {
        try {
            const response = await fetch(`${BASE_URL}/getTop`, {
                headers: this.getHeaders(),
            });

            if (!response.ok) {
                console.warn(`FreeCryptoAPI: Failed to fetch top assets. Status: ${response.status}`);
                return [];
            }

            const data = await response.json();
            // Assuming data is an array of assets
            if (Array.isArray(data)) {
                return data.slice(0, limit);
            }
            // If it's wrapped in a property like { data: [...] }
            if (data && Array.isArray(data.data)) {
                return data.data.slice(0, limit);
            }

            return [];
        } catch (error) {
            console.error("FreeCryptoAPI Error fetching top assets:", error);
            return [];
        }
    }

    async getTechnicalAnalysis(symbol: string): Promise<any | null> {
        try {
            const response = await fetch(`${BASE_URL}/getTechnicalAnalysis?symbol=${symbol}`, {
                headers: this.getHeaders(),
            });

            if (!response.ok) {
                return null;
            }
            return await response.json();
        } catch (error) {
            return null;
        }
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
