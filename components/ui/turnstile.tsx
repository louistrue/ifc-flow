"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { loadTurnstileScript, type TurnstileWidgetOptions } from '@/lib/turnstile';

interface TurnstileProps {
    sitekey: string;
    onSuccess?: (token: string) => void;
    onError?: (error: string) => void;
    onExpired?: () => void;
    onTimeout?: () => void;
    theme?: 'light' | 'dark' | 'auto';
    size?: 'normal' | 'compact';
    className?: string;
    disabled?: boolean;
}

export function Turnstile({
    sitekey,
    onSuccess,
    onError,
    onExpired,
    onTimeout,
    theme = 'auto',
    size = 'normal',
    className = '',
    disabled = false
}: TurnstileProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    const handleSuccess = useCallback((token: string) => {
        console.log('🔐 Turnstile verification successful', {
            token: token.substring(0, 20) + '...',
            sitekey: sitekey?.substring(0, 10) + '...',
            isTestKey: sitekey === '1x00000000000000000000AA'
        });

        // Clear timeouts if they exist
        if ((window as any).turnstileTestTimeout) {
            clearTimeout((window as any).turnstileTestTimeout);
            (window as any).turnstileTestTimeout = null;
        }
        if ((window as any).turnstileProdTimeout) {
            clearTimeout((window as any).turnstileProdTimeout);
            (window as any).turnstileProdTimeout = null;
        }

        onSuccess?.(token);
    }, [onSuccess, sitekey]);

    const handleError = useCallback((error: string) => {
        console.error('🚨 Turnstile verification failed:', error);
        console.log('🔍 Debugging info:', {
            sitekey: sitekey?.substring(0, 10) + '...',
            isTestKey: sitekey === '1x00000000000000000000AA',
            error,
            userAgent: navigator.userAgent.substring(0, 50) + '...',
            currentDomain: window.location.hostname,
            fullURL: window.location.href
        });

        // Special handling for domain configuration errors
        if (error === '110200') {
            console.error('❌ DOMAIN CONFIGURATION ERROR (110200):');
            console.error(`🌐 Current domain: ${window.location.hostname}`);
            console.error('🔧 This error means the Turnstile sitekey is not configured for this domain.');
            console.error('📋 To fix this:');
            console.error('   1. Go to Cloudflare Dashboard → Turnstile');
            console.error('   2. Edit your widget settings');
            console.error(`   3. Add "${window.location.hostname}" to the allowed domains`);
            console.error('   4. Save and try again');
        }

        setHasError(true);
        onError?.(error);
    }, [onError, sitekey]);

    const handleExpired = useCallback(() => {
        console.warn('⏰ Turnstile token expired');
        onExpired?.();
    }, [onExpired]);

    const handleTimeout = useCallback(() => {
        console.warn('⏱️ Turnstile verification timeout');
        onTimeout?.();
    }, [onTimeout]);

    const renderWidget = useCallback(() => {
        if (!containerRef.current || !window.turnstile || !sitekey || disabled) {
            return;
        }

        try {
            // Remove existing widget if any
            if (widgetIdRef.current) {
                window.turnstile.remove(widgetIdRef.current);
                widgetIdRef.current = null;
            }

            // Use different options for test vs production
            const isTestKey = sitekey === '1x00000000000000000000AA';

            const options: TurnstileWidgetOptions = {
                sitekey,
                callback: handleSuccess,
                'error-callback': handleError,
                'expired-callback': handleExpired,
                'timeout-callback': handleTimeout,
                theme,
                size,
                // For production: use managed mode with interaction-only for better reliability
                // For test: always show the widget
                ...(isTestKey ? {
                    appearance: 'always',
                    execution: 'render'
                } : {
                    // Managed mode - let Cloudflare decide the best approach
                    // Remove appearance and execution to use defaults
                }),
                retry: 'auto',
                'refresh-expired': 'auto'
            };

            widgetIdRef.current = window.turnstile.render(containerRef.current, options);
            setIsLoading(false);
            setHasError(false);
        } catch (error) {
            console.error('Failed to render Turnstile widget:', error);
            setHasError(true);
            setIsLoading(false);
        }
    }, [sitekey, handleSuccess, handleError, handleExpired, handleTimeout, theme, size, disabled]);

    // Load Turnstile script and render widget
    useEffect(() => {
        if (disabled) {
            setIsLoading(false);
            return;
        }

        // Domain info available via devtools when needed

        loadTurnstileScript()
            .then(() => {
                renderWidget();

                // For test sitekey in non-production, auto-complete after short delay to unblock dev
                if (sitekey === '1x00000000000000000000AA' && process.env.NODE_ENV !== 'production') {
                    const testTimeout = setTimeout(() => {
                        handleSuccess('XXXX.DUMMY.TOKEN.XXXX');
                    }, 1500);
                    (window as any).turnstileTestTimeout = testTimeout;
                } else {
                    // For production, add multiple timeout checks for stuck verification
                    console.log('🔒 Production Turnstile: Setting up verification monitoring');

                    let checkCount = 0;
                    const maxChecks = 3;

                    const checkVerification = () => {
                        checkCount++;
                        // Periodic check for stuck verification

                        if (!widgetIdRef.current || !window.turnstile) {
                            // Widget or API not available
                            return;
                        }

                        const response = window.turnstile.getResponse(widgetIdRef.current);
                        // Turnstile response check

                        if (!response && checkCount < maxChecks) {
                            // Stuck verification; resetting widget
                            try {
                                window.turnstile.reset(widgetIdRef.current);
                                // Schedule next check
                                (window as any).turnstileProdTimeout = setTimeout(checkVerification, 5000);
                            } catch (e) {
                                // Failed to reset Turnstile
                                // Force re-render widget if reset fails
                                renderWidget();
                            }
                        } else if (!response && checkCount >= maxChecks) {
                            // Verification failed after multiple attempts; final re-render

                            // Try one more re-render before giving up
                            try {
                                renderWidget();

                                // Set a final fallback timeout (only for production issues)
                                setTimeout(() => {
                                    if (!widgetIdRef.current || !window.turnstile?.getResponse(widgetIdRef.current)) {
                                        // Persistently failing; likely network/extension issues

                                        // Show error state to user
                                        setHasError(true);
                                        setIsLoading(false);
                                    }
                                }, 10000); // 10 seconds for final attempt
                            } catch (e) {
                                // Failed to re-render Turnstile widget
                                setHasError(true);
                                setIsLoading(false);
                            }
                        }
                    };

                    // Initial check after 5 seconds
                    (window as any).turnstileProdTimeout = setTimeout(checkVerification, 5000);
                }
            })
            .catch((error) => {
                console.error('Failed to load Turnstile script:', error);
                setHasError(true);
                setIsLoading(false);
            });
    }, [renderWidget, disabled, sitekey, handleSuccess]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (widgetIdRef.current && window.turnstile) {
                try {
                    window.turnstile.remove(widgetIdRef.current);
                } catch (error) {
                    console.warn('Failed to cleanup Turnstile widget:', error);
                }
            }

            // Clear any pending timeouts
            if ((window as any).turnstileTestTimeout) {
                clearTimeout((window as any).turnstileTestTimeout);
                (window as any).turnstileTestTimeout = null;
            }
            if ((window as any).turnstileProdTimeout) {
                clearTimeout((window as any).turnstileProdTimeout);
                (window as any).turnstileProdTimeout = null;
            }
        };
    }, []);

    // Public methods
    const reset = useCallback(() => {
        if (widgetIdRef.current && window.turnstile) {
            window.turnstile.reset(widgetIdRef.current);
            setHasError(false);
        }
    }, []);

    const getResponse = useCallback((): string | null => {
        if (widgetIdRef.current && window.turnstile) {
            return window.turnstile.getResponse(widgetIdRef.current) || null;
        }
        return null;
    }, []);

    // Expose methods via ref (if needed)
    useEffect(() => {
        if (containerRef.current) {
            (containerRef.current as any).turnstileReset = reset;
            (containerRef.current as any).turnstileGetResponse = getResponse;
        }
    }, [reset, getResponse]);

    if (disabled) {
        return null;
    }

    return (
        <div className={`turnstile-container ${className}`}>
            <div
                ref={containerRef}
                className="turnstile-widget"
                style={{
                    minHeight: size === 'compact' ? '65px' : '65px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            />

            {isLoading && (
                <div className="flex items-center justify-center py-4 text-sm text-gray-500 dark:text-gray-400">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-sky-500 mr-2"></div>
                    Loading verification...
                </div>
            )}

            {hasError && (
                <div className="flex flex-col items-center justify-center py-3 px-4 space-y-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <div className="text-sm font-medium text-red-800 dark:text-red-200 text-center">
                        Security Verification Failed
                    </div>

                    <div className="text-xs text-center text-red-700 dark:text-red-300">
                        <div>Domain configuration issue detected.</div>
                        <div className="mt-1 font-mono bg-red-100 dark:bg-red-900/40 px-2 py-1 rounded">
                            Domain: {typeof window !== 'undefined' ? window.location.hostname : 'unknown'}
                        </div>
                    </div>

                    <div className="text-xs text-center text-red-600 dark:text-red-400 space-y-1">
                        <div>This usually means the security widget isn't configured for this domain.</div>
                        <div>Check browser console for detailed fix instructions.</div>
                    </div>

                    <div className="flex space-x-2">
                        <button
                            onClick={() => {
                                setHasError(false);
                                setIsLoading(true);
                                renderWidget();
                            }}
                            className="text-xs px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                        >
                            Retry verification
                        </button>
                        <button
                            onClick={() => {
                                // Clear all timeouts and start fresh
                                if ((window as any).turnstileTestTimeout) {
                                    clearTimeout((window as any).turnstileTestTimeout);
                                    (window as any).turnstileTestTimeout = null;
                                }
                                if ((window as any).turnstileProdTimeout) {
                                    clearTimeout((window as any).turnstileProdTimeout);
                                    (window as any).turnstileProdTimeout = null;
                                }

                                // Remove existing widget
                                if (widgetIdRef.current && window.turnstile) {
                                    try {
                                        window.turnstile.remove(widgetIdRef.current);
                                        widgetIdRef.current = null;
                                    } catch (e) {
                                        console.warn('Failed to remove widget:', e);
                                    }
                                }

                                // Reset state and re-render
                                setHasError(false);
                                setIsLoading(true);
                                setTimeout(() => renderWidget(), 100); // Small delay to ensure cleanup
                            }}
                            className="text-xs px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                            Reset widget
                        </button>
                    </div>

                    <div className="text-xs text-center text-red-500 dark:text-red-400">
                        If this persists, contact the site administrator
                    </div>
                </div>
            )}
        </div>
    );
}

// Hook for easier integration
export function useTurnstile(sitekey: string) {
    const [token, setToken] = useState<string | null>(null);
    const [isVerified, setIsVerified] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSuccess = useCallback((token: string) => {
        setToken(token);
        setIsVerified(true);
        setError(null);
    }, []);

    const handleError = useCallback((error: string) => {
        setToken(null);
        setIsVerified(false);
        setError(error);
    }, []);

    const reset = useCallback(() => {
        setToken(null);
        setIsVerified(false);
        setError(null);
    }, []);

    return {
        token,
        isVerified,
        error,
        handleSuccess,
        handleError,
        reset,
        TurnstileComponent: (props: Omit<TurnstileProps, 'sitekey' | 'onSuccess' | 'onError'>) => (
            <Turnstile
                sitekey={sitekey}
                onSuccess={handleSuccess}
                onError={handleError}
                {...props}
            />
        )
    };
}
