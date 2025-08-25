/**
 * Rate Limiter Implementation
 * 
 * Provides rate limiting functionality for API endpoints to prevent abuse
 * and ensure fair usage across all users.
 */

interface RateLimitEntry {
    count: number;
    resetTime: number;
}

interface RateLimitConfig {
    windowMs: number;  // Time window in milliseconds
    maxRequests: number;  // Maximum requests per window
}

class InMemoryRateLimiter {
    private store = new Map<string, RateLimitEntry>();
    private cleanupInterval: NodeJS.Timeout;

    constructor() {
        // Clean up expired entries every 5 minutes
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 5 * 60 * 1000);
    }

    private cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.store.entries()) {
            if (now > entry.resetTime) {
                this.store.delete(key);
            }
        }
    }

    async check(identifier: string, config: RateLimitConfig): Promise<{
        allowed: boolean;
        remaining: number;
        resetTime: number;
        total: number;
    }> {
        const now = Date.now();
        const resetTime = now + config.windowMs;

        let entry = this.store.get(identifier);

        // If no entry exists or the window has expired, create a new one
        if (!entry || now > entry.resetTime) {
            entry = {
                count: 0,
                resetTime
            };
        }

        // Increment the count
        entry.count++;

        // Update the store
        this.store.set(identifier, entry);

        const allowed = entry.count <= config.maxRequests;
        const remaining = Math.max(0, config.maxRequests - entry.count);

        return {
            allowed,
            remaining,
            resetTime: entry.resetTime,
            total: config.maxRequests
        };
    }

    // Clean up resources
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.store.clear();
    }
}

// Global rate limiter instance
const rateLimiter = new InMemoryRateLimiter();

// Default configurations for different endpoints
export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
    // AI/Chat endpoints - generous for normal conversations
    ai: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 30 // 30 requests per minute
    },

    // General API endpoints
    api: {
        windowMs: 60 * 1000, // 1 minute  
        maxRequests: 60 // 60 requests per minute
    },

    // File upload endpoints
    upload: {
        windowMs: 5 * 60 * 1000, // 5 minutes
        maxRequests: 5 // 5 uploads per 5 minutes
    }
};

/**
 * Rate limit a request based on identifier and configuration
 */
export async function rateLimit(
    identifier: string,
    config: RateLimitConfig = RATE_LIMIT_CONFIGS.api
): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
    total: number;
}> {
    return rateLimiter.check(identifier, config);
}

/**
 * Get rate limit headers for HTTP responses
 */
export function getRateLimitHeaders(result: {
    remaining: number;
    resetTime: number;
    total: number;
}): Record<string, string> {
    return {
        'X-RateLimit-Limit': result.total.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString(),
    };
}

/**
 * Create a rate limit error response
 */
export function createRateLimitError(resetTime: number) {
    const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);

    return {
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.',
        retryAfter,
        resetTime
    };
}

/**
 * Check for suspicious activity patterns
 * This is a simple implementation that can be enhanced with more sophisticated detection
 */
export function checkSuspiciousActivity(clientId: string): boolean {
    // For now, this is a simple placeholder implementation
    // In a production environment, you might want to implement:
    // - Pattern detection for rapid-fire requests
    // - Blacklist checking
    // - Behavioral analysis
    // - Integration with threat intelligence feeds

    // Simple heuristic: check if the clientId looks suspicious
    if (clientId.includes('bot') || clientId.includes('crawler') || clientId.includes('spider')) {
        return true;
    }

    // Check for obviously malicious patterns
    if (clientId.length > 200 || clientId.includes('<script>') || clientId.includes('sql')) {
        return true;
    }

    return false;
}

// Clean up on process exit (only in Node.js environment)
if (typeof process !== 'undefined' && process.on) {
    process.on('exit', () => {
        rateLimiter.destroy();
    });

    process.on('SIGINT', () => {
        rateLimiter.destroy();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        rateLimiter.destroy();
        process.exit(0);
    });
}
