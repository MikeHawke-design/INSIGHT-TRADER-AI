/**
 * MEXC API Integration Module
 * Handles all interactions with MEXC exchange API
 */

import { Trade } from './types';

const MEXC_BASE_URL = 'https://api.mexc.com';

export interface MexcCredentials {
    apiKey: string;
    secretKey: string;
}

export interface MexcOrderRequest {
    symbol: string;
    side: 'BUY' | 'SELL';
    type: 'LIMIT' | 'MARKET';
    quantity?: string;
    price?: string;
    quoteOrderQty?: string;
    timestamp: number;
}

export interface MexcOrderResponse {
    symbol: string;
    orderId: string;
    orderListId: number;
    price: string;
    origQty: string;
    type: string;
    side: string;
    transactTime: number;
}

export interface MexcBalance {
    asset: string;
    free: string;
    locked: string;
}

export interface MexcAccountInfo {
    canTrade: boolean;
    canWithdraw: boolean;
    canDeposit: boolean;
    accountType: string;
    balances: MexcBalance[];
    permissions: string[];
}

export interface MexcTickerPrice {
    symbol: string;
    price: string;
}

/**
 * Generate HMAC SHA256 signature for MEXC API requests
 */
async function generateSignature(secretKey: string, queryString: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKey);
    const messageData = encoder.encode(queryString);

    const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, messageData);

    // Convert to hex string (lowercase as per MEXC spec)
    return Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Get account information including balances
 */
export async function getMexcAccountInfo(credentials: MexcCredentials): Promise<MexcAccountInfo> {
    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = await generateSignature(credentials.secretKey, queryString);

    const response = await fetch(
        `${MEXC_BASE_URL}/api/v3/account?${queryString}&signature=${signature}`,
        {
            method: 'GET',
            headers: {
                'X-MEXC-APIKEY': credentials.apiKey,
                'Content-Type': 'application/json'
            }
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`MEXC API error: ${response.status} - ${errorText}`);
    }

    return response.json();
}

/**
 * Get current price for a symbol
 */
export async function getMexcPrice(symbol: string = 'BTCUSDT'): Promise<number> {
    const response = await fetch(`${MEXC_BASE_URL}/api/v3/ticker/price?symbol=${symbol}`);

    if (!response.ok) {
        throw new Error(`Failed to fetch price for ${symbol}`);
    }

    const data: MexcTickerPrice = await response.json();
    return parseFloat(data.price);
}

/**
 * Get all available trading symbols
 */
export async function getMexcSymbols(): Promise<string[]> {
    const response = await fetch(`${MEXC_BASE_URL}/api/v3/exchangeInfo`);

    if (!response.ok) {
        throw new Error('Failed to fetch exchange info');
    }

    const data = await response.json();
    return data.symbols
        .filter((s: any) => s.status === 'ENABLED' && s.quoteAsset === 'USDT')
        .map((s: any) => s.symbol);
}

/**
 * Get user's authorized/default trading symbols
 * These are the symbols the user has specifically enabled for their API key
 */
export async function getUserAuthorizedSymbols(credentials: MexcCredentials): Promise<string[]> {
    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = await generateSignature(credentials.secretKey, queryString);

    const response = await fetch(
        `${MEXC_BASE_URL}/api/v3/selfSymbols?${queryString}&signature=${signature}`,
        {
            method: 'GET',
            headers: {
                'X-MEXC-APIKEY': credentials.apiKey,
                'Content-Type': 'application/json'
            }
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`MEXC API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return result.data || [];
}

/**
 * Place an order on MEXC exchange
 */
export async function placeMexcOrder(
    credentials: MexcCredentials,
    trade: Trade,
    symbol: string = 'BTCUSDT',
    quantity: string
): Promise<MexcOrderResponse> {
    const timestamp = Date.now();

    // Build order request
    const orderParams: Record<string, string> = {
        symbol: symbol,
        side: trade.direction === 'Long' ? 'BUY' : 'SELL',
        type: trade.entryType === 'Limit Order' ? 'LIMIT' : 'MARKET',
        timestamp: timestamp.toString()
    };

    // Add quantity and price based on order type
    if (orderParams.type === 'LIMIT') {
        orderParams.quantity = quantity;
        orderParams.price = trade.entry.toString();
    } else {
        // For market orders, use quantity
        orderParams.quantity = quantity;
    }

    // Create query string for signature
    const queryString = Object.keys(orderParams)
        .sort()
        .map(key => `${key}=${orderParams[key]}`)
        .join('&');

    const signature = await generateSignature(credentials.secretKey, queryString);

    // Place the main order
    const response = await fetch(
        `${MEXC_BASE_URL}/api/v3/order?${queryString}&signature=${signature}`,
        {
            method: 'POST',
            headers: {
                'X-MEXC-APIKEY': credentials.apiKey,
                'Content-Type': 'application/json'
            }
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`MEXC API error: ${response.status} - ${errorText}`);
    }

    const orderResponse: MexcOrderResponse = await response.json();

    // Note: MEXC doesn't support OCO orders in the same way as some exchanges
    // Stop loss and take profit would need to be placed as separate orders
    // This would require additional implementation for order management

    return orderResponse;
}

/**
 * Calculate position size based on risk parameters
 */
export function calculatePositionSize(
    accountBalance: number,
    riskPercentage: number,
    entryPrice: number,
    stopLossPrice: number
): number {
    const riskAmount = accountBalance * (riskPercentage / 100);
    const priceRisk = Math.abs(entryPrice - stopLossPrice);
    const positionSize = riskAmount / priceRisk;
    return positionSize;
}

/**
 * Calculate risk/reward ratio
 */
export function calculateRiskReward(
    entryPrice: number,
    stopLossPrice: number,
    takeProfitPrice: number
): number {
    const risk = Math.abs(entryPrice - stopLossPrice);
    const reward = Math.abs(takeProfitPrice - entryPrice);
    return reward / risk;
}
