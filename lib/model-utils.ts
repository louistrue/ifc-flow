/**
 * Shared utilities for AI model management
 * Loads models from environment variables and provides validation/resolution
 */

export interface ModelConfig {
    id: string;
    slug: string;
    name?: string;
    provider?: string;
}

/**
 * Load available models from environment variables
 * Supports multiple formats: JSON array, comma-separated, pipe-separated
 */
export function loadAvailableModels(): ModelConfig[] {
    const raw = process.env.NEXT_PUBLIC_MODEL_LIST || process.env.MODEL_LIST;
    const defaultModels: ModelConfig[] = [
        { id: 'gpt-4o-mini', slug: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
        { id: 'gpt-4.1-mini', slug: 'openai/gpt-4.1-mini', name: 'GPT-4.1 Mini', provider: 'OpenAI' },
        { id: 'gpt-4.1-nano', slug: 'openai/gpt-4.1-nano', name: 'GPT-4.1 Nano', provider: 'OpenAI' },
    ];

    if (!raw || !raw.trim()) return defaultModels;

    try {
        // JSON format: [{"id": "...", "slug": "...", "name": "...", "provider": "..."}, ...]
        // or simple: ["provider/model", ...]
        if (raw.trim().startsWith('[') || raw.trim().startsWith('{')) {
            const parsed = JSON.parse(raw);
            const arr = Array.isArray(parsed) ? parsed : [parsed];
            const models = arr.map((item: any): ModelConfig | null => {
                if (typeof item === 'string') {
                    const slug = item;
                    const id = slug.includes('/') ? slug.split('/').pop() || slug : slug;
                    const provider = slug.includes('/') ? slug.split('/')[0] : 'openrouter';
                    return { id, slug, name: id, provider };
                }
                if (item && typeof item === 'object') {
                    const slug = item.slug || item.model || item.slugOrModel;
                    const id = item.id || (slug ? (slug.includes('/') ? slug.split('/').pop() || slug : slug) : 'model');
                    const name = item.name || id;
                    const provider = item.provider || (slug?.includes('/') ? slug.split('/')[0] : 'openrouter');
                    return { id, slug, name, provider };
                }
                return null;
            }).filter((item): item is ModelConfig => item !== null);
            return models.length > 0 ? models : defaultModels;
        }

        // Comma-separated format: "name|slug,name|slug" or "slug,slug"
        const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
        const models = parts.map((part): ModelConfig => {
            if (part.includes('|')) {
                const [name, slug] = part.split('|').map(s => s.trim());
                const id = slug.includes('/') ? slug.split('/').pop() || slug : slug;
                const provider = slug.includes('/') ? slug.split('/')[0] : 'openrouter';
                return { id, slug, name: name || id, provider };
            }
            const slug = part;
            const id = slug.includes('/') ? slug.split('/').pop() || slug : slug;
            const provider = slug.includes('/') ? slug.split('/')[0] : 'openrouter';
            return { id, slug, name: id, provider };
        });
        return models.length > 0 ? models : defaultModels;
    } catch (e) {
        console.warn('Failed to parse MODEL_LIST env var. Using defaults.', e);
        return defaultModels;
    }
}

/**
 * Resolve a model ID or slug to a valid OpenRouter slug
 */
export function resolveModelSlug(modelId?: string): string {
    const availableModels = loadAvailableModels();
    const defaultModel = availableModels[0]?.slug || "openai/gpt-4o-mini";

    if (!modelId) return defaultModel;

    // If already a provider/model slug, check if it's in our available models
    if (modelId.includes("/")) {
        const isAvailable = availableModels.some(m => m && m.slug === modelId);
        return isAvailable ? modelId : defaultModel;
    }

    // Find matching model by ID
    const matchingModel = availableModels.find(m =>
        m && (m.id === modelId ||
            m.id.toLowerCase().replace(/\s+/g, "") === modelId.toLowerCase().replace(/\s+/g, ""))
    );

    return matchingModel ? matchingModel.slug : defaultModel;
}

/**
 * Validate if a model is allowed based on environment configuration
 */
export function validateModel(model: string): boolean {
    const availableModels = loadAvailableModels();
    const allowedSlugs = availableModels.map(m => m.slug).filter(Boolean);

    // Check direct match or ID match (for backwards compatibility)
    return allowedSlugs.includes(model) ||
        allowedSlugs.some(allowed => {
            if (allowed.includes('/')) {
                const modelId = allowed.split('/')[1];
                return model === modelId || model.endsWith(modelId);
            }
            return false;
        });
}

/**
 * Get the list of allowed model slugs for validation
 */
export function getAllowedModelSlugs(): string[] {
    return loadAvailableModels().map(m => m.slug).filter(Boolean);
}
