import { Trade } from './types';

interface BlofinCredentials {
    apiKey: string;
    secretKey: string;
    passphrase: string;
}

interface BlofinOrderRequest {
    instId: string;
    marginMode: string;
    positionSide: string;
    side: 'buy' | 'sell';
    orderType: 'market' | 'limit';
    price?: string;
    size: string;
    reduceOnly?: string;
    clientOrderId?: string;
    tpTriggerPrice?: string;
    tpOrderPrice?: string;
    slTriggerPrice?: string;
    slOrderPrice?: string;
}

interface BlofinOrderResponse {
    code: string;
    msg: string;
    data: Array<{
        orderId: string;
        clientOrderId: string;
        code: string;
        msg: string;
    }>;
}

/**
 * Generate BloFin API signature for REST requests
 */
async function generateSignature(
    secretKey: string,
    method: string,
    path: string,
    timestamp: string,
    nonce: string,
    body: string = ''
): Promise<string> {
    // Create prehash string: path + method + timestamp + nonce + body
    const prehashString = `${path}${method}${timestamp}${nonce}${body}`;

    // Generate HMAC-SHA256 signature
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKey);
    const messageData = encoder.encode(prehashString);

    const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, messageData);

    // Convert to hex string
    const hexSignature = Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    // Encode hex string to base64
    return btoa(hexSignature);
}

/**
 * Place an order on BloFin exchange
 */
export async function placeBlofinOrder(
    credentials: BlofinCredentials,
    trade: Trade,
    instrument: string = 'BTC-USDT'
): Promise<BlofinOrderResponse> {
    const timestamp = Date.now().toString();
    const nonce = timestamp; // Using timestamp as nonce
    const path = '/api/v1/trade/order';
    const method = 'POST';

    // Convert trade to BloFin order format
    const orderRequest: BlofinOrderRequest = {
        instId: instrument,
        marginMode: 'cross',
        positionSide: 'net',
        side: trade.direction.toLowerCase() as 'buy' | 'sell',
        orderType: trade.entryType === 'Limit Order' ? 'limit' : 'market',
        price: trade.entryType === 'Limit Order' ? trade.entry : undefined,
        size: '0.1', // Minimum contract size - user should adjust
        reduceOnly: 'false',
        tpTriggerPrice: trade.takeProfit1,
        tpOrderPrice: '-1', // Market price for TP
        slTriggerPrice: trade.stopLoss,
        slOrderPrice: '-1' // Market price for SL
    };

    const bodyString = JSON.stringify(orderRequest);

    // Generate signature
    const signature = await generateSignature(
        credentials.secretKey,
        method,
        path,
        timestamp,
        nonce,
        bodyString
    );

    // Make API request
    const response = await fetch(`https://openapi.blofin.com${path}`, {
        method: 'POST',
        headers: {
            'ACCESS-KEY': credentials.apiKey,
            'ACCESS-SIGN': signature,
            'ACCESS-TIMESTAMP': timestamp,
            'ACCESS-NONCE': nonce,
            'ACCESS-PASSPHRASE': credentials.passphrase,
            'Content-Type': 'application/json'
        },
        body: bodyString
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`BloFin API error: ${response.status} - ${errorText}`);
    }

    return response.json();
}

/**
 * Get current market price from BloFin
 */
export async function getBlofinPrice(instrument: string = 'BTC-USDT'): Promise<number> {
    const response = await fetch(
        `https://openapi.blofin.com/api/v1/market/tickers?instId=${instrument}`
    );

    if (!response.ok) {
        throw new Error(`Failed to fetch price: ${response.status}`);
    }

    const data = await response.json();
    return parseFloat(data.data[0].last);
}

/**
 * Get available instruments for copy trading
 */
export async function getBlofinInstruments(): Promise<string[]> {
    const response = await fetch('https://openapi.blofin.com/api/v1/market/instruments');

    if (!response.ok) {
        throw new Error(`Failed to fetch instruments: ${response.status}`);
    }

    const data = await response.json();
    return data.data.map((inst: any) => inst.instId);
}
