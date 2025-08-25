import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, RATE_LIMIT_CONFIGS, getRateLimitHeaders, createRateLimitError } from './lib/rate-limiter';

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Skip rate limiting for static assets and internal Next.js routes
    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/static') ||
        pathname.includes('.') // Skip files with extensions
    ) {
        return NextResponse.next();
    }

    try {
        // Get client identifier
        const clientId = getClientIdentifier(request);

        // Determine rate limit config based on path
        let config = RATE_LIMIT_CONFIGS.api;

        if (pathname.startsWith('/api/chat') || pathname.startsWith('/api/ai')) {
            config = RATE_LIMIT_CONFIGS.ai;
        } else if (pathname.includes('upload')) {
            config = RATE_LIMIT_CONFIGS.upload;
        }

        // Check rate limit
        const result = await rateLimit(clientId, config);

        // Create response
        const response = result.allowed
            ? NextResponse.next()
            : NextResponse.json(
                createRateLimitError(result.resetTime),
                {
                    status: 429,
                    headers: {
                        'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString()
                    }
                }
            );

        // Add rate limit headers
        const headers = getRateLimitHeaders(result);
        Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value);
        });

        // Log rate limiting activity (only for blocked requests to reduce noise)
        if (!result.allowed) {
            console.log(`🚫 Rate limit exceeded for ${clientId} on ${pathname}`);
        }

        return response;

    } catch (error) {
        // If rate limiting fails, allow the request but log the error
        console.error('Rate limiting error:', error);
        return NextResponse.next();
    }
}

function getClientIdentifier(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] :
        request.headers.get('x-real-ip') ||
        request.ip ||
        'unknown';

    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Create a hash of IP + User-Agent for better rate limiting
    return `${ip}-${Buffer.from(userAgent).toString('base64').slice(0, 10)}`;
}

export const config = {
    matcher: ['/api/chat/:path*', '/api/ai/:path*']
};
