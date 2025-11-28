/**
 * MEXC API Test Utility
 * Use this to diagnose API connection issues
 */

import { MexcCredentials } from './mexcApi';

/**
 * Test MEXC API connectivity and authentication
 */
export async function testMexcConnection(credentials: MexcCredentials): Promise<{
    success: boolean;
    tests: {
        name: string;
        passed: boolean;
        message: string;
        details?: any;
    }[];
}> {
    const tests: {
        name: string;
        passed: boolean;
        message: string;
        details?: any;
    }[] = [];

    // Test 1: Public endpoint (no auth required)
    try {
        const response = await fetch('https://api.mexc.com/api/v3/ticker/price?symbol=BTCUSDT');
        const data = await response.json();
        tests.push({
            name: 'Public API Access',
            passed: response.ok,
            message: response.ok ? `✅ Can reach MEXC API. BTC Price: $${data.price}` : '❌ Cannot reach MEXC API',
            details: { status: response.status, data }
        });
    } catch (error) {
        tests.push({
            name: 'Public API Access',
            passed: false,
            message: '❌ Network error - Cannot reach MEXC API',
            details: { error: error instanceof Error ? error.message : String(error) }
        });
    }

    // Test 2: Check API key format
    const apiKeyValid = !!(credentials.apiKey && credentials.apiKey.startsWith('mx0'));
    tests.push({
        name: 'API Key Format',
        passed: apiKeyValid,
        message: apiKeyValid ? '✅ API Key format looks correct' : '❌ API Key should start with "mx0"',
        details: { apiKey: credentials.apiKey?.substring(0, 10) + '...' }
    });

    // Test 3: Check secret key exists
    const secretKeyValid = !!(credentials.secretKey && credentials.secretKey.length > 20);
    tests.push({
        name: 'Secret Key',
        passed: secretKeyValid,
        message: secretKeyValid ? '✅ Secret Key provided' : '❌ Secret Key missing or too short',
        details: { length: credentials.secretKey?.length }
    });

    // Test 4: Test signature generation
    try {
        const timestamp = Date.now();
        const testString = `recvWindow=5000&timestamp=${timestamp}`;

        const encoder = new TextEncoder();
        const keyData = encoder.encode(credentials.secretKey);
        const messageData = encoder.encode(testString);

        const key = await crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );

        const signature = await crypto.subtle.sign('HMAC', key, messageData);
        const hexSignature = Array.from(new Uint8Array(signature))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        tests.push({
            name: 'Signature Generation',
            passed: true,
            message: '✅ Can generate HMAC-SHA256 signatures',
            details: { signatureLength: hexSignature.length }
        });
    } catch (error) {
        tests.push({
            name: 'Signature Generation',
            passed: false,
            message: '❌ Failed to generate signature',
            details: { error: error instanceof Error ? error.message : String(error) }
        });
    }

    // Test 5: Test authenticated endpoint
    try {
        const timestamp = Date.now();
        const recvWindow = 5000;
        const queryString = `recvWindow=${recvWindow}&timestamp=${timestamp}`;

        // Generate signature
        const encoder = new TextEncoder();
        const keyData = encoder.encode(credentials.secretKey);
        const messageData = encoder.encode(queryString);

        const key = await crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );

        const signatureBuffer = await crypto.subtle.sign('HMAC', key, messageData);
        const signature = Array.from(new Uint8Array(signatureBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        const url = `https://api.mexc.com/api/v3/account?${queryString}&signature=${signature}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-MEXC-APIKEY': credentials.apiKey,
                'Content-Type': 'application/json'
            }
        });

        const responseText = await response.text();
        let responseData;
        try {
            responseData = JSON.parse(responseText);
        } catch {
            responseData = responseText;
        }

        tests.push({
            name: 'Authenticated API Call',
            passed: response.ok,
            message: response.ok
                ? '✅ Successfully authenticated with MEXC API'
                : `❌ Authentication failed: ${response.status} ${response.statusText}`,
            details: {
                status: response.status,
                statusText: response.statusText,
                response: responseData,
                url: url.replace(signature, 'SIGNATURE_HIDDEN')
            }
        });
    } catch (error) {
        tests.push({
            name: 'Authenticated API Call',
            passed: false,
            message: '❌ Failed to make authenticated request',
            details: { error: error instanceof Error ? error.message : String(error) }
        });
    }

    const allPassed = tests.every(t => t.passed);

    return {
        success: allPassed,
        tests
    };
}
