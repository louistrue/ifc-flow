import { TransformStep, FilterCondition } from "../components/nodes/node-types";

export interface TransformResult {
    data: any;
    metadata: {
        inputCount: number;
        outputCount: number;
        warnings: string[];
    };
}

export interface TransformContext {
    input: any;
    inputB?: any;
    restrictToIncomingElements?: boolean;
    incomingElementIds?: Set<string>;
}

/**
 * Execute a pipeline of transform steps on input data
 */
export function executeTransformPipeline(
    steps: TransformStep[],
    context: TransformContext
): TransformResult {
    let data = context.input;
    const warnings: string[] = [];
    const inputCount = getDataCount(data);

    // If restricting to incoming elements, build the set of valid IDs
    if (context.restrictToIncomingElements && context.inputB) {
        context.incomingElementIds = extractElementIds(context.inputB);
    }

    try {
        for (const step of steps) {
            if (!step.enabled) continue;

            const stepResult = executeStep(step, data, context);
            data = stepResult.data;
            warnings.push(...stepResult.warnings);
        }
    } catch (error) {
        warnings.push(`Transform error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
        data,
        metadata: {
            inputCount,
            outputCount: getDataCount(data),
            warnings,
        },
    };
}

/**
 * Execute a single transform step
 */
function executeStep(
    step: TransformStep,
    data: any,
    context: TransformContext
): { data: any; warnings: string[] } {
    const warnings: string[] = [];

    try {
        switch (step.type) {
            case 'filter':
                return { data: executeFilter(data, step.config, warnings), warnings };

            case 'map':
                return { data: executeMap(data, step.config, warnings), warnings };

            case 'pick':
                return { data: executePick(data, step.config, warnings), warnings };

            case 'omit':
                return { data: executeOmit(data, step.config, warnings), warnings };

            case 'flatten':
                return { data: executeFlatten(data, step.config, warnings), warnings };

            case 'groupBy':
                return { data: executeGroupBy(data, step.config, warnings), warnings };

            case 'unique':
                return { data: executeUnique(data, step.config, warnings), warnings };

            case 'sort':
                return { data: executeSort(data, step.config, warnings), warnings };

            case 'limit':
                return { data: executeLimit(data, step.config, warnings), warnings };

            case 'toMapping':
                return { data: executeToMapping(data, step.config, context, warnings), warnings };

            case 'join':
                return { data: executeJoin(data, context.inputB, step.config, warnings), warnings };

            case 'rename':
                return { data: executeRename(data, step.config, warnings), warnings };

            default:
                warnings.push(`Unknown step type: ${step.type}`);
                return { data, warnings };
        }
    } catch (error) {
        warnings.push(`Step ${step.type} failed: ${error instanceof Error ? error.message : String(error)}`);
        return { data, warnings };
    }
}

/**
 * Filter step: filter array/object entries based on conditions
 */
function executeFilter(data: any, config: any, warnings: string[]): any {
    const conditions: FilterCondition[] = config.conditions || [];
    const logic = config.logic || 'and'; // 'and' | 'or'

    if (!Array.isArray(data) && typeof data !== 'object') {
        warnings.push('Filter can only be applied to arrays or objects');
        return data;
    }

    if (conditions.length === 0) {
        warnings.push('No filter conditions specified');
        return data;
    }

    const testConditions = (item: any): boolean => {
        const results = conditions.map(condition => testCondition(item, condition));
        return logic === 'and' ? results.every(r => r) : results.some(r => r);
    };

    if (Array.isArray(data)) {
        return data.filter(testConditions);
    } else {
        const result: any = {};
        for (const [key, value] of Object.entries(data)) {
            if (testConditions(value)) {
                result[key] = value;
            }
        }
        return result;
    }
}

/**
 * Test a single filter condition
 */
function testCondition(item: any, condition: FilterCondition): boolean {
    const value = getValueAtPath(item, condition.path);
    const testValue = condition.value;

    switch (condition.operator) {
        case 'equals':
            return value === testValue;
        case 'notEquals':
            return value !== testValue;
        case 'contains':
            return String(value).includes(String(testValue));
        case 'startsWith':
            return String(value).startsWith(String(testValue));
        case 'endsWith':
            return String(value).endsWith(String(testValue));
        case 'in':
            return Array.isArray(testValue) && testValue.includes(value);
        case 'notIn':
            return Array.isArray(testValue) && !testValue.includes(value);
        case 'gt':
            return Number(value) > Number(testValue);
        case 'gte':
            return Number(value) >= Number(testValue);
        case 'lt':
            return Number(value) < Number(testValue);
        case 'lte':
            return Number(value) <= Number(testValue);
        case 'exists':
            return value !== undefined && value !== null;
        case 'notExists':
            return value === undefined || value === null;
        default:
            return false;
    }
}

/**
 * Map step: transform each item in array/object
 */
function executeMap(data: any, config: any, warnings: string[]): any {
    const mappings = config.mappings || {}; // { newField: { source: 'path', transform?: 'upper|lower|title|trim|number', default?: any } }

    if (!Array.isArray(data) && typeof data !== 'object') {
        warnings.push('Map can only be applied to arrays or objects');
        return data;
    }

    const mapItem = (item: any): any => {
        const result: any = {};
        for (const [newField, mapping] of Object.entries(mappings)) {
            const mapConfig = mapping as any;
            let value = getValueAtPath(item, mapConfig.source || newField);

            // Apply transform
            if (mapConfig.transform) {
                value = applyTransform(value, mapConfig.transform);
            }

            // Apply default
            if ((value === undefined || value === null || value === '') && mapConfig.default !== undefined) {
                value = mapConfig.default;
            }

            result[newField] = value;
        }
        return result;
    };

    if (Array.isArray(data)) {
        return data.map(mapItem);
    } else {
        const result: any = {};
        for (const [key, value] of Object.entries(data)) {
            result[key] = mapItem(value);
        }
        return result;
    }
}

/**
 * Pick step: select only specified fields
 */
function executePick(data: any, config: any, warnings: string[]): any {
    const fields: string[] = config.fields || [];

    if (fields.length === 0) {
        warnings.push('No fields specified for pick');
        return data;
    }

    const pickItem = (item: any): any => {
        const result: any = {};
        for (const field of fields) {
            const value = getValueAtPath(item, field);
            if (value !== undefined) {
                setValueAtPath(result, field, value);
            }
        }
        return result;
    };

    if (Array.isArray(data)) {
        return data.map(pickItem);
    } else if (typeof data === 'object' && data !== null) {
        return pickItem(data);
    }

    return data;
}

/**
 * Omit step: remove specified fields
 */
function executeOmit(data: any, config: any, warnings: string[]): any {
    const fields: string[] = config.fields || [];

    if (fields.length === 0) {
        warnings.push('No fields specified for omit');
        return data;
    }

    const omitItem = (item: any): any => {
        const result = { ...item };
        for (const field of fields) {
            deleteValueAtPath(result, field);
        }
        return result;
    };

    if (Array.isArray(data)) {
        return data.map(omitItem);
    } else if (typeof data === 'object' && data !== null) {
        return omitItem(data);
    }

    return data;
}

/**
 * Flatten step: flatten array at specified path
 */
function executeFlatten(data: any, config: any, warnings: string[]): any {
    const path = config.path || '';

    if (!Array.isArray(data)) {
        warnings.push('Flatten can only be applied to arrays');
        return data;
    }

    if (!path) {
        // Flatten top-level array
        return data.flat();
    }

    // Flatten arrays at specified path
    const result: any[] = [];
    for (const item of data) {
        const arrayValue = getValueAtPath(item, path);
        if (Array.isArray(arrayValue)) {
            result.push(...arrayValue);
        } else {
            result.push(item);
        }
    }
    return result;
}

/**
 * GroupBy step: group items by key and optionally aggregate
 */
function executeGroupBy(data: any, config: any, warnings: string[]): any {
    const keyPath = config.keyPath || 'id';
    const aggregates = config.aggregates || {}; // { field: 'count|sum|avg|min|max|first|last' }

    if (!Array.isArray(data)) {
        warnings.push('GroupBy can only be applied to arrays');
        return data;
    }

    const groups: Record<string, any[]> = {};

    // Group items
    for (const item of data) {
        const key = String(getValueAtPath(item, keyPath) || 'undefined');
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(item);
    }

    // Apply aggregates
    const result: any = {};
    for (const [key, items] of Object.entries(groups)) {
        const groupResult: any = { [keyPath]: key, items };

        for (const [field, operation] of Object.entries(aggregates)) {
            const op = operation as string;
            const values = items.map(item => getValueAtPath(item, field)).filter(v => v !== undefined && v !== null);

            switch (op) {
                case 'count':
                    groupResult[`${field}_count`] = items.length;
                    break;
                case 'sum':
                    groupResult[`${field}_sum`] = values.reduce((sum, val) => sum + Number(val), 0);
                    break;
                case 'avg':
                    groupResult[`${field}_avg`] = values.length > 0 ? values.reduce((sum, val) => sum + Number(val), 0) / values.length : 0;
                    break;
                case 'min':
                    groupResult[`${field}_min`] = values.length > 0 ? Math.min(...values.map(Number)) : undefined;
                    break;
                case 'max':
                    groupResult[`${field}_max`] = values.length > 0 ? Math.max(...values.map(Number)) : undefined;
                    break;
                case 'first':
                    groupResult[`${field}_first`] = values[0];
                    break;
                case 'last':
                    groupResult[`${field}_last`] = values[values.length - 1];
                    break;
            }
        }

        result[key] = groupResult;
    }

    return result;
}

/**
 * Unique step: remove duplicates based on key path
 */
function executeUnique(data: any, config: any, warnings: string[]): any {
    const keyPath = config.keyPath || 'id';

    if (!Array.isArray(data)) {
        warnings.push('Unique can only be applied to arrays');
        return data;
    }

    const seen = new Set();
    return data.filter(item => {
        const key = getValueAtPath(item, keyPath);
        const keyStr = JSON.stringify(key);
        if (seen.has(keyStr)) {
            return false;
        }
        seen.add(keyStr);
        return true;
    });
}

/**
 * Sort step: sort array by key path
 */
function executeSort(data: any, config: any, warnings: string[]): any {
    const keyPath = config.keyPath || 'id';
    const direction = config.direction || 'asc'; // 'asc' | 'desc'

    if (!Array.isArray(data)) {
        warnings.push('Sort can only be applied to arrays');
        return data;
    }

    return [...data].sort((a, b) => {
        const aVal = getValueAtPath(a, keyPath);
        const bVal = getValueAtPath(b, keyPath);

        let comparison = 0;
        if (aVal < bVal) comparison = -1;
        else if (aVal > bVal) comparison = 1;

        return direction === 'desc' ? -comparison : comparison;
    });
}

/**
 * Limit step: limit number of items
 */
function executeLimit(data: any, config: any, warnings: string[]): any {
    const limit = config.limit || 100;
    const skip = config.skip || 0;

    if (!Array.isArray(data)) {
        warnings.push('Limit can only be applied to arrays');
        return data;
    }

    return data.slice(skip, skip + limit);
}

/**
 * ToMapping step: convert to { mappings: { key: value } } format for Property Node
 */
function executeToMapping(data: any, config: any, context: TransformContext, warnings: string[]): any {
    const keyPath = config.keyPath || 'GlobalId';
    const valuePath = config.valuePath || 'spaceName';
    const skipEmpty = config.skipEmpty !== false;

    let items: any[] = [];

    // Handle different input formats
    if (Array.isArray(data)) {
        items = data;
    } else if (data && typeof data === 'object') {
        // Check for common analysis result formats
        if (data.elementSpaceMap) {
            // Room assignment format: convert elementSpaceMap to array
            items = Object.entries(data.elementSpaceMap).map(([globalId, spaceInfo]) => ({
                GlobalId: globalId,
                ...(typeof spaceInfo === 'object' && spaceInfo !== null ? spaceInfo : { value: spaceInfo })
            }));
        } else if (data.elements && Array.isArray(data.elements)) {
            // Property node result format
            items = data.elements;
        } else {
            // Generic object: convert to array of entries
            items = Object.entries(data).map(([key, value]) => ({
                key,
                value,
                ...((typeof value === 'object' && value !== null) ? value : {})
            }));
        }
    }

    const mappings: Record<string, any> = {};
    let totalMappings = 0;
    let skippedEmpty = 0;
    let restrictedOut = 0;

    for (const item of items) {
        const key = getValueAtPath(item, keyPath);
        const value = getValueAtPath(item, valuePath);

        if (!key) continue;

        // Check if restricting to incoming elements
        if (context.restrictToIncomingElements && context.incomingElementIds) {
            if (!context.incomingElementIds.has(String(key))) {
                restrictedOut++;
                continue;
            }
        }

        // Skip empty values if configured
        if (skipEmpty && (value === undefined || value === null || value === '')) {
            skippedEmpty++;
            continue;
        }

        mappings[String(key)] = value;
        totalMappings++;
    }

    const result = {
        mappings,
        metadata: {
            totalMappings,
            skippedEmpty,
            restrictedOut,
            inputCount: items.length
        }
    };

    if (skippedEmpty > 0) {
        warnings.push(`Skipped ${skippedEmpty} items with empty values`);
    }
    if (restrictedOut > 0) {
        warnings.push(`Filtered out ${restrictedOut} items not in incoming elements`);
    }

    return result;
}

/**
 * Join step: join with inputB data
 */
function executeJoin(data: any, inputB: any, config: any, warnings: string[]): any {
    const keyPath = config.keyPath || 'id';
    const joinType = config.joinType || 'left'; // 'left' | 'inner'

    if (!Array.isArray(data)) {
        warnings.push('Join can only be applied to arrays');
        return data;
    }

    if (!inputB || !Array.isArray(inputB)) {
        warnings.push('Join requires inputB to be an array');
        return data;
    }

    // Build lookup map for inputB
    const lookupMap = new Map();
    for (const item of inputB) {
        const key = getValueAtPath(item, keyPath);
        if (key !== undefined) {
            lookupMap.set(String(key), item);
        }
    }

    const result: any[] = [];
    for (const item of data) {
        const key = getValueAtPath(item, keyPath);
        const joinItem = key !== undefined ? lookupMap.get(String(key)) : undefined;

        if (joinType === 'inner' && !joinItem) {
            continue; // Skip items without match in inner join
        }

        result.push({
            ...item,
            ...(joinItem || {})
        });
    }

    return result;
}

/**
 * Rename step: rename fields
 */
function executeRename(data: any, config: any, warnings: string[]): any {
    const mappings = config.mappings || {}; // { oldName: newName }

    const renameItem = (item: any): any => {
        const result = { ...item };
        for (const [oldName, newName] of Object.entries(mappings)) {
            if (oldName in result) {
                result[newName as string] = result[oldName];
                delete result[oldName];
            }
        }
        return result;
    };

    if (Array.isArray(data)) {
        return data.map(renameItem);
    } else if (typeof data === 'object' && data !== null) {
        return renameItem(data);
    }

    return data;
}

/**
 * Utility functions
 */

function getValueAtPath(obj: any, path: string): any {
    if (!path) return obj;

    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
        if (current === null || current === undefined) {
            return undefined;
        }
        current = current[part];
    }

    return current;
}

function setValueAtPath(obj: any, path: string, value: any): void {
    if (!path) return;

    const parts = path.split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!(part in current) || typeof current[part] !== 'object') {
            current[part] = {};
        }
        current = current[part];
    }

    current[parts[parts.length - 1]] = value;
}

function deleteValueAtPath(obj: any, path: string): void {
    if (!path) return;

    const parts = path.split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!(part in current) || typeof current[part] !== 'object') {
            return; // Path doesn't exist
        }
        current = current[part];
    }

    delete current[parts[parts.length - 1]];
}

function applyTransform(value: any, transform: string): any {
    if (value === null || value === undefined) return value;

    const str = String(value);
    switch (transform) {
        case 'upper':
            return str.toUpperCase();
        case 'lower':
            return str.toLowerCase();
        case 'title':
            return str.replace(/\w\S*/g, (txt) =>
                txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
            );
        case 'trim':
            return str.trim();
        case 'number':
            const num = Number(str);
            return isNaN(num) ? value : num;
        default:
            return value;
    }
}

function getDataCount(data: any): number {
    if (Array.isArray(data)) {
        return data.length;
    } else if (data && typeof data === 'object') {
        return Object.keys(data).length;
    }
    return data !== null && data !== undefined ? 1 : 0;
}

function extractElementIds(data: any): Set<string> {
    const ids = new Set<string>();

    if (Array.isArray(data)) {
        for (const item of data) {
            const id = getValueAtPath(item, 'GlobalId') || getValueAtPath(item, 'properties.GlobalId') || getValueAtPath(item, 'id');
            if (id) {
                ids.add(String(id));
            }
        }
    } else if (data && typeof data === 'object' && data.elements && Array.isArray(data.elements)) {
        for (const item of data.elements) {
            const id = getValueAtPath(item, 'GlobalId') || getValueAtPath(item, 'properties.GlobalId') || getValueAtPath(item, 'id');
            if (id) {
                ids.add(String(id));
            }
        }
    }

    return ids;
}

/**
 * Preset configurations for common use cases
 */
export const TRANSFORM_PRESETS = {
    roomAssignmentToWalls: {
        name: 'Room Assignment → Wall Mappings',
        description: 'Convert room assignment results to wall property mappings',
        steps: [
            {
                id: 'filter-walls',
                type: 'filter' as const,
                enabled: true,
                config: {
                    conditions: [
                        {
                            path: 'type',
                            operator: 'in' as const,
                            value: ['IfcWall', 'IfcWallStandardCase']
                        }
                    ],
                    logic: 'and'
                }
            },
            {
                id: 'to-mapping',
                type: 'toMapping' as const,
                enabled: true,
                config: {
                    keyPath: 'GlobalId',
                    valuePath: 'spaceName',
                    skipEmpty: true
                }
            }
        ]
    },

    elementsToIndex: {
        name: 'Elements → GlobalId Index',
        description: 'Create an index of elements by GlobalId',
        steps: [
            {
                id: 'to-mapping',
                type: 'toMapping' as const,
                enabled: true,
                config: {
                    keyPath: 'properties.GlobalId',
                    valuePath: 'type',
                    skipEmpty: false
                }
            }
        ]
    },

    groupByType: {
        name: 'Group by Element Type',
        description: 'Group elements by their IFC type with counts',
        steps: [
            {
                id: 'group-by-type',
                type: 'groupBy' as const,
                enabled: true,
                config: {
                    keyPath: 'type',
                    aggregates: {
                        'id': 'count'
                    }
                }
            }
        ]
    }
};
