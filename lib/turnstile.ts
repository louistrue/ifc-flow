// Cloudflare Turnstile integration for bot protection

export interface TurnstileResponse {
    success: boolean;
    'error-codes'?: string[];
    challenge_ts?: string;
    hostname?: string;
    action?: string;
    cdata?: string;
}

export interface TurnstileWidgetOptions {
    sitekey: string;
    callback?: (token: string) => void;
    'error-callback'?: (error: string) => void;
    'expired-callback'?: () => void;
    'timeout-callback'?: () => void;
    'after-interactive-callback'?: () => void;
    'before-interactive-callback'?: () => void;
    theme?: 'light' | 'dark' | 'auto';
    language?: string;
    tabindex?: number;
    'response-field'?: boolean;
    'response-field-name'?: string;
    size?: 'normal' | 'compact';
    retry?: 'auto' | 'never';
    'retry-interval'?: number;
    'refresh-expired'?: 'auto' | 'manual' | 'never';
    appearance?: 'always' | 'execute' | 'interaction-only';
    execution?: 'render' | 'execute';
}

// Global Turnstile interface
declare global {
    interface Window {
        turnstile?: {
            render: (container: string | HTMLElement, options: TurnstileWidgetOptions) => string;
            reset: (widgetId?: string) => void;
            remove: (widgetId?: string) => void;
            getResponse: (widgetId?: string) => string;
            isExpired: (widgetId?: string) => boolean;
        };
    }
}

// Get appropriate keys based on environment
function getTurnstileKeys() {
    const isLocalhost = typeof window !== 'undefined'
        ? (window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1' ||
            window.location.hostname === '0.0.0.0')
        : process.env.NODE_ENV === 'development';

    // Optional env override to force test keys in non-production builds
    const forceTestKeys = (process.env.NEXT_PUBLIC_TURNSTILE_USE_TEST_KEYS === 'true' || process.env.TURNSTILE_USE_TEST_KEYS === 'true')
        && process.env.NODE_ENV !== 'production';

    if (isLocalhost || forceTestKeys) {
        // Use Cloudflare test keys for localhost development
        return {
            sitekey: '1x00000000000000000000AA', // Always passes
            secretKey: '1x0000000000000000000000000000000AA'
        };
    }

    // Use production keys
    return {
        sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY || '',
        secretKey: process.env.TURNSTILE_SECRET_KEY || ''
    };
}

// Client-side sitekey getter
export function getTurnstileSitekey(): string {
    const keys = getTurnstileKeys();
    return keys.sitekey;
}

// Server-side token validation
export async function validateTurnstileToken(
    token: string,
    remoteip?: string
): Promise<TurnstileResponse> {
    const { secretKey } = getTurnstileKeys();

    if (!secretKey) {
        throw new Error('TURNSTILE_SECRET_KEY environment variable is not set');
    }

    // Handle test tokens for development
    if (token === 'XXXX.DUMMY.TOKEN.XXXX' && secretKey === '1x0000000000000000000000000000000AA') {
        return {
            success: true,
            challenge_ts: new Date().toISOString(),
            hostname: 'localhost'
        };
    }

    const formData = new FormData();
    formData.append('secret', secretKey);
    formData.append('response', token);

    if (remoteip) {
        formData.append('remoteip', remoteip);
    }

    try {
        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`Turnstile validation failed: ${response.status}`);
        }

        const result: TurnstileResponse = await response.json();
        return result;
    } catch (error) {
        console.error('Turnstile validation error:', error);
        throw error;
    }
}

// Client-side utilities
export const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

export function loadTurnstileScript(): Promise<void> {
    return new Promise((resolve, reject) => {
        // Check if already loaded
        if (window.turnstile) {
            resolve();
            return;
        }

        // Check if script is already in DOM
        const existingScript = document.querySelector(`script[src="${TURNSTILE_SCRIPT_URL}"]`);
        if (existingScript) {
            existingScript.addEventListener('load', () => resolve());
            existingScript.addEventListener('error', reject);
            return;
        }

        // Create and load script
        const script = document.createElement('script');
        script.src = TURNSTILE_SCRIPT_URL;
        script.async = true;
        script.defer = true;

        script.onload = () => {
            // Wait a bit for turnstile to be available
            const checkTurnstile = () => {
                if (window.turnstile) {
                    resolve();
                } else {
                    setTimeout(checkTurnstile, 100);
                }
            };
            checkTurnstile();
        };

        script.onerror = reject;

        document.head.appendChild(script);
    });
}

// Error code mappings
export const TURNSTILE_ERROR_CODES: Record<string, string> = {
    'missing-input-secret': 'The secret parameter is missing.',
    'invalid-input-secret': 'The secret parameter is invalid or malformed.',
    'missing-input-response': 'The response parameter is missing.',
    'invalid-input-response': 'The response parameter is invalid or malformed.',
    'bad-request': 'The request is invalid or malformed.',
    'timeout-or-duplicate': 'The response parameter has already been validated before or is expired.',
    'internal-error': 'An internal error happened while validating the response.',
};

export function getTurnstileErrorMessage(errorCodes?: string[]): string {
    if (!errorCodes || errorCodes.length === 0) {
        return 'Unknown error occurred during verification';
    }

    const messages = errorCodes.map(code =>
        TURNSTILE_ERROR_CODES[code] || `Unknown error: ${code}`
    );

    return messages.join(', ');
}
