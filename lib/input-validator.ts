import { z } from 'zod';
import { validateModel } from './model-utils';

// Input validation schemas - flexible for AI SDK formats
export const ChatMessageSchema = z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().max(4000, 'Message too long').optional(), // Make content optional
    parts: z.array(z.any()).optional(),
    // AI SDK might send other fields
    id: z.string().optional(),
    createdAt: z.date().optional(),
}).refine((msg) => {
    // At least content or parts should be present for user messages
    if (msg.role === 'user') {
        return (msg.content && msg.content.trim().length > 0) ||
            (msg.parts && msg.parts.length > 0);
    }
    return true; // Assistant/system messages can be more flexible
}, {
    message: "User messages must have content or parts"
});

export const ChatRequestSchema = z.object({
    messages: z.array(ChatMessageSchema).max(200, 'Too many messages in conversation'),
    model: z.string().max(100).optional(),
    modelId: z.string().max(100).optional(),
    modelData: z.object({
        id: z.string().optional(),
        name: z.string().optional(),
        schema: z.string().optional(),
        totalElements: z.number().optional(),
        elementCounts: z.record(z.number()).optional(),
        hasSqlite: z.boolean().optional()
    }).optional().nullable(), // Allow null
    turnstileToken: z.string().max(2000).optional().nullable(), // Allow null
    // AI SDK might send additional fields
    id: z.string().optional(),
    createdAt: z.date().optional(),
});

// Dangerous patterns to detect and block
const DANGEROUS_PATTERNS = [
    // SQL injection attempts
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b.*\b(FROM|INTO|SET|WHERE|TABLE|DATABASE)\b)/i,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
    /('.*';\s*(DROP|DELETE|INSERT|UPDATE))/i,

    // Command injection
    /(\$\(.*\)|\`.*\`|&&|\|\||;.*&)/,
    /(curl|wget|nc|netcat|bash|sh|cmd|powershell|eval|exec)/i,

    // Path traversal
    /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e%5c)/i,

    // Script injection
    /(<script|javascript:|vbscript:|onload=|onerror=)/i,

    // Prompt injection attempts
    /(ignore\s+(previous|all)\s+(instructions|prompts|rules))/i,
    /(you\s+are\s+now|forget\s+(everything|all|previous))/i,
    /^\s*(system|assistant|user)\s*:\s*/i, // Only match at start of message

    // API key extraction attempts
    /(api[_-]?key|secret|token|password|credential)/i,
];

// Suspicious content patterns
const SUSPICIOUS_PATTERNS = [
    /\b(hack|exploit|vulnerability|bypass|inject|payload)\b/i,
    /\b(admin|root|sudo|administrator)\b/i,
    /(base64|hex|decode|encode)\s*[:=]/i,
];

export interface ValidationResult {
    isValid: boolean;
    isDangerous: boolean;
    isSuspicious: boolean;
    errors: string[];
    warnings: string[];
    sanitizedContent?: string;
}

export function validateAndSanitizeInput(input: any): ValidationResult {
    const result: ValidationResult = {
        isValid: true,
        isDangerous: false,
        isSuspicious: false,
        errors: [],
        warnings: []
    };

    try {
        // Add debug logging
        console.log('🔍 Validating input:', {
            hasMessages: !!input?.messages,
            messagesType: typeof input?.messages,
            messagesLength: input?.messages?.length,
            inputKeys: Object.keys(input || {})
        });

        // Schema validation
        const validatedInput = ChatRequestSchema.parse(input);

        // Content validation for each message
        if (validatedInput.messages && Array.isArray(validatedInput.messages)) {
            for (const message of validatedInput.messages) {
                if (message.role === 'user') {
                    // Extract content from message (could be in content field or parts)
                    let messageContent = message.content || '';

                    // If no content but has parts, extract text from parts
                    if (!messageContent && message.parts && Array.isArray(message.parts)) {
                        try {
                            messageContent = message.parts
                                .filter((part: any) => part && typeof part === 'object' && part.type === 'text' && part.text)
                                .map((part: any) => part.text)
                                .join(' ');
                        } catch (error) {
                            console.warn('Error extracting content from parts:', error);
                            messageContent = '';
                        }
                    }

                    // Skip validation if no content found or if it's a continuation message
                    if (!messageContent || messageContent.trim().length === 0) {
                        continue;
                    }

                    // Skip validation for continuation messages (empty or query results)
                    if (messageContent.trim() === '' || messageContent.startsWith('Query results:') || messageContent.startsWith('Query failed:')) {
                        continue;
                    }

                    const contentValidation = validateMessageContent(messageContent);

                    if (contentValidation.isDangerous) {
                        result.isDangerous = true;
                        result.isValid = false;
                        result.errors.push(`Dangerous content detected: ${contentValidation.reason}`);
                    }

                    if (contentValidation.isSuspicious) {
                        result.isSuspicious = true;
                        result.warnings.push(`Suspicious content detected: ${contentValidation.reason}`);
                    }

                    // Sanitize content and update the message
                    const sanitizedContent = sanitizeContent(messageContent);
                    if (message.content) {
                        message.content = sanitizedContent;
                    }

                    // Also update parts if that's where the content came from
                    if (message.parts && Array.isArray(message.parts)) {
                        try {
                            message.parts = message.parts.map((part: any) => {
                                if (part && typeof part === 'object' && part.type === 'text' && part.text) {
                                    return { ...part, text: sanitizeContent(part.text) };
                                }
                                return part;
                            });
                        } catch (error) {
                            console.warn('Error sanitizing parts:', error);
                            // Keep original parts if sanitization fails
                        }
                    }
                }
            }
        } else {
            console.warn('⚠️ No valid messages array found in validated input');
        }

        result.sanitizedContent = JSON.stringify(validatedInput);

    } catch (error) {
        result.isValid = false;
        if (error instanceof z.ZodError) {
            result.errors = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
        } else {
            result.errors = ['Invalid input format'];
        }
    }

    return result;
}

function validateMessageContent(content: string): {
    isDangerous: boolean;
    isSuspicious: boolean;
    reason?: string;
} {
    // Check for dangerous patterns
    for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(content)) {
            return {
                isDangerous: true,
                isSuspicious: false,
                reason: 'Potential injection attack detected'
            };
        }
    }

    // Check for suspicious patterns
    for (const pattern of SUSPICIOUS_PATTERNS) {
        if (pattern.test(content)) {
            return {
                isDangerous: false,
                isSuspicious: true,
                reason: 'Suspicious keywords detected'
            };
        }
    }

    // Check message length and complexity
    if (content.length > 2000) {
        return {
            isDangerous: false,
            isSuspicious: true,
            reason: 'Unusually long message'
        };
    }

    // Check for excessive special characters (potential obfuscation)
    const specialCharRatio = (content.match(/[^a-zA-Z0-9\s]/g) || []).length / content.length;
    if (specialCharRatio > 0.3) {
        return {
            isDangerous: false,
            isSuspicious: true,
            reason: 'High ratio of special characters'
        };
    }

    return {
        isDangerous: false,
        isSuspicious: false
    };
}

function sanitizeContent(content: string): string {
    return content
        // Remove potential HTML/script tags
        .replace(/<[^>]*>/g, '')
        // Remove potential SQL comments
        .replace(/--.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        // Normalize whitespace
        .replace(/\s+/g, ' ')
        .trim()
        // Limit length
        .substring(0, 4000);
}

// Additional validation for model selection
export function validateModelSelection(model: string): boolean {
    return validateModel(model);
}
