import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'ifc-flow-map' },
    transports: [
        // Error logs
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),

        // AI conversation logs - separate file for semantic analysis
        new winston.transports.File({
            filename: path.join(logsDir, 'ai-conversations.log'),
            level: 'info',
            maxsize: 10485760, // 10MB
            maxFiles: 10,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        }),

        // Security logs - separate file for security events
        new winston.transports.File({
            filename: path.join(logsDir, 'security.log'),
            level: 'warn',
            maxsize: 5242880, // 5MB
            maxFiles: 10,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        }),

        // All logs
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log',),
            maxsize: 5242880, // 5MB
            maxFiles: 5
        })
    ]
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        ),
        level: 'warn' // Only show warnings and errors in console
    }));
}

// Specialized logging functions for AI conversations
export const aiLogger = {
    // Log complete conversation turn
    logConversationTurn: (data: {
        sessionId?: string;
        clientId?: string;
        ip?: string;
        modelName: string;
        userPrompt: string;
        toolCalls: Array<{
            toolName: string;
            query: string;
            description: string;
            result: any;
        }>;
        aiResponse: string;
        responseTime: number;
        success: boolean;
        error?: string;
        finishReason?: string;
        usage?: {
            promptTokens?: number;
            completionTokens?: number;
            totalTokens?: number;
        };
        toolCallsCount?: number;
        toolResultsCount?: number;
        textLength?: number;
    }) => {
        logger.info('AI_CONVERSATION_TURN', {
            type: 'conversation_turn',
            timestamp: new Date().toISOString(),
            ...data
        });
    },

    // Log tool execution details
    logToolExecution: (data: {
        toolName: string;
        query: string;
        description: string;
        result: any;
        executionTime: number;
        success: boolean;
        error?: string;
        clientId?: string;
        ip?: string;
        toolCallId?: string;
        args?: any;
        output?: any;
        outputType?: string;
    }) => {
        logger.info('AI_TOOL_EXECUTION', {
            type: 'tool_execution',
            timestamp: new Date().toISOString(),
            ...data
        });
    },

    // Log semantic analysis data
    logSemanticAnalysis: (data: {
        userIntent: string;
        detectedKeywords: string[];
        toolChoice: string;
        queryGenerated: string;
        resultQuality: 'good' | 'partial' | 'poor';
        semanticAccuracy: number; // 0-1 score
    }) => {
        logger.info('AI_SEMANTIC_ANALYSIS', {
            type: 'semantic_analysis',
            timestamp: new Date().toISOString(),
            ...data
        });
    },

    // Security-specific logging
    security: (event: string, data?: any) => {
        logger.warn('SECURITY_EVENT', {
            type: 'security',
            event,
            timestamp: new Date().toISOString(),
            severity: 'high',
            ...data
        });

        // In production, you might want to send this to a security monitoring service
        if (process.env.NODE_ENV === 'production') {
            // TODO: Send to security monitoring service (e.g., Sentry, DataDog)
        }
    },

    rateLimitExceeded: (clientId: string, ip: string, limit: number) => {
        logger.warn('RATE_LIMIT_EXCEEDED', {
            type: 'security',
            event: 'rate_limit_exceeded',
            clientId,
            ip,
            limit,
            action: 'blocked',
            timestamp: new Date().toISOString()
        });
    },

    suspiciousActivity: (clientId: string, ip: string, reason: string) => {
        logger.warn('SUSPICIOUS_ACTIVITY', {
            type: 'security',
            event: 'suspicious_activity',
            clientId,
            ip,
            reason,
            action: 'flagged',
            timestamp: new Date().toISOString()
        });
    },

    dangerousInput: (clientId: string, ip: string, inputType: string) => {
        logger.error('DANGEROUS_INPUT_BLOCKED', {
            type: 'security',
            event: 'dangerous_input',
            clientId,
            ip,
            inputType,
            action: 'blocked',
            timestamp: new Date().toISOString()
        });
    },

    // Standard logging methods
    info: (message: string, data?: any) => {
        logger.info(message, data);
    },

    warn: (message: string, data?: any) => {
        logger.warn(message, data);
    },

    error: (message: string, data?: any) => {
        logger.error(message, data);
    },

    debug: (message: string, data?: any) => {
        if (process.env.NODE_ENV === 'development') {
            logger.debug(message, data);
        }
    }
};

export default logger;
