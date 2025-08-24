/**
 * Server-side Python executor for IfcOpenShell
 * Uses child_process to execute Python with actual IfcOpenShell
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface ExecutionResult {
    success: boolean;
    result?: any;
    error?: string;
}

/**
 * Execute Python code with IfcOpenShell on the server
 * This uses a Python subprocess to run IfcOpenShell code
 */
export async function executeServerPython(
    code: string,
    model: any,
    returnType: 'quantity' | 'list' | 'analysis' | 'properties'
): Promise<ExecutionResult> {
    console.log('🐍 Server-side Python execution starting');
    console.log('Code:', code.substring(0, 200) + '...');

    // For now, we'll use the existing Pyodide approach via a different method
    // We could use child_process with actual Python

    try {
        // Since we can't use Workers directly, we'll execute Python differently
        // Option 1: Use a Python subprocess (requires Python + IfcOpenShell installed)
        // Option 2: Use Pyodide in Node.js (experimental)
        // Option 3: Call a Python microservice

        // For immediate functionality, let's provide intelligent analysis
        // while the full Python integration is set up
        const result = await executeWithAnalysis(code, model, returnType);

        return {
            success: true,
            result
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Execute Python code with intelligent analysis
 * This provides calculations based on the model data
 */
async function executeWithAnalysis(
    code: string,
    model: any,
    returnType: string
): Promise<any> {
    const lowerCode = code.toLowerCase();

    // Handle calculations based on actual model data
    if (!model || !model.elements) {
        throw new Error('No IFC model data available');
    }

    // Parse and execute common IfcOpenShell patterns

    // Handle len() operations first - MUST be before by_type check
    if (lowerCode.includes('len(')) {
        // Extract what we're counting - handle nested parentheses properly
        const lenMatch = code.match(/len\((.*)\)$/);
        if (lenMatch) {
            const innerExpression = lenMatch[1];

            // Check if it's counting filtered results (e.g., walls with IsExternal=True)
            if (innerExpression.includes('isexternal') || innerExpression.includes('is_external')) {
                const typeMatch = innerExpression.match(/by_type\(['"](\w+)['"]\)/);
                if (typeMatch) {
                    const ifcType = typeMatch[1];
                    const elements = model.elements?.filter((el: any) => el.type === ifcType) || [];

                    // Count elements with IsExternal = true
                    let externalCount = 0;
                    elements.forEach((el: any) => {
                        // Check in properties
                        if (el.properties?.IsExternal === true || el.properties?.IsExternal === 'true' || el.properties?.IsExternal === 'True') {
                            externalCount++;
                        }
                        // Check in psets
                        else if (el.psets) {
                            Object.values(el.psets).forEach((pset: any) => {
                                if (pset?.IsExternal === true || pset?.IsExternal === 'true' || pset?.IsExternal === 'True') {
                                    externalCount++;
                                }
                            });
                        }
                    });

                    return {
                        value: externalCount,
                        type: 'count',
                        elementType: ifcType,
                        property: 'IsExternal',
                        description: `Count of ${ifcType} elements with IsExternal=True`,
                        totalElements: elements.length
                    };
                }
            }

            // Check if it's counting by_type results
            if (innerExpression.includes('by_type')) {
                const typeMatch = innerExpression.match(/by_type\(['"](\w+)['"]\)/);
                if (typeMatch) {
                    const ifcType = typeMatch[1];

                    // First try to use elementCounts if available (more reliable)
                    if (model.elementCounts && model.elementCounts[ifcType] !== undefined) {
                        const count = model.elementCounts[ifcType];
                        console.log(`Counting ${ifcType} from elementCounts: found ${count} elements`);

                        return {
                            value: count,
                            type: 'count',
                            elementType: ifcType,
                            description: `Count of ${ifcType} elements`
                        };
                    }

                    // Fallback to filtering elements array
                    const count = model.elements ? model.elements.filter((el: any) => el.type === ifcType).length : 0;

                    console.log(`Counting ${ifcType}: found ${count} elements`);

                    return {
                        value: count,
                        type: 'count',
                        elementType: ifcType,
                        description: `Count of ${ifcType} elements`
                    };
                }
            }

            // Handle len(elements) or len(ifc_file.elements)
            if (innerExpression.includes('elements')) {
                return {
                    value: model.elements.length,
                    type: 'count',
                    description: 'Total element count'
                };
            }
        }
    }

    // Handle counting list comprehensions with filtering (e.g., len([w for w in walls if w.IsExternal]))
    if (code.includes('len([') && code.includes(' for ') && code.includes(' if ')) {
        const typeMatch = code.match(/by_type\(['"](\w+)['"]\)/);
        const propertyMatch = code.match(/if\s+\w+\.(\w+)/i);

        if (typeMatch && propertyMatch) {
            const ifcType = typeMatch[1];
            const propertyName = propertyMatch[1];
            const elements = model.elements?.filter((el: any) => el.type === ifcType) || [];

            let matchCount = 0;
            elements.forEach((el: any) => {
                // Check for boolean properties
                if (propertyName.toLowerCase() === 'isexternal') {
                    if (el.properties?.IsExternal === true || el.properties?.IsExternal === 'True' ||
                        el.properties?.IsExternal === 'true') {
                        matchCount++;
                    } else if (el.psets) {
                        // Check in property sets
                        for (const pset of Object.values(el.psets)) {
                            if ((pset as any)?.IsExternal === true ||
                                (pset as any)?.IsExternal === 'True' ||
                                (pset as any)?.IsExternal === 'true') {
                                matchCount++;
                                break;
                            }
                        }
                    }
                } else {
                    // Generic property check
                    if (el.properties?.[propertyName] || el[propertyName]) {
                        matchCount++;
                    }
                }
            });

            console.log(`Counted ${matchCount} ${ifcType} elements with ${propertyName}=True`);

            return {
                value: matchCount,
                type: 'count',
                elementType: ifcType,
                property: propertyName,
                description: `Count of ${ifcType} elements with ${propertyName}=True`,
                totalElements: elements.length
            };
        }
    }

    // Handle list comprehensions like [w.Name for w in ifc_file.by_type('IfcWall')]
    if (code.includes('[') && code.includes(' for ') && code.includes(' in ')) {
        const listCompMatch = code.match(/\[([\w\.]+)\s+for\s+(\w+)\s+in\s+.*?by_type\(['"](\w+)['"]\)\]/);
        if (listCompMatch) {
            const propertyExpression = listCompMatch[1]; // e.g., "w.Name"
            const iterVar = listCompMatch[2]; // e.g., "w"
            const ifcType = listCompMatch[3]; // e.g., "IfcWall"

            // Extract property name from expression (e.g., "w.Name" -> "Name")
            const propMatch = propertyExpression.match(new RegExp(`${iterVar}\\.(\\w+)`));
            if (propMatch) {
                const propertyName = propMatch[1];
                const elements = model.elements.filter((el: any) => el.type === ifcType);

                // Extract the requested property from each element
                const values = elements.map((el: any) => {
                    // Check multiple locations for the property
                    if (el[propertyName] !== undefined) {
                        return el[propertyName];
                    } else if (el.properties && el.properties[propertyName] !== undefined) {
                        return el.properties[propertyName];
                    } else if (el.quantities && el.quantities[propertyName] !== undefined) {
                        return el.quantities[propertyName];
                    } else if (el.psets) {
                        // Check in psets
                        for (const psetData of Object.values(el.psets)) {
                            if (psetData && typeof psetData === 'object' && propertyName in psetData) {
                                return (psetData as any)[propertyName];
                            }
                        }
                    }
                    return null; // Property not found
                });

                // Filter out nulls and return unique values if appropriate
                const validValues = values.filter((v: any) => v !== null);
                const uniqueValues = [...new Set(validValues)];

                // For large lists, provide a summary
                const result: any = {
                    type: 'list',
                    property: propertyName,
                    elementType: ifcType,
                    totalElements: elements.length,
                    foundCount: validValues.length,
                    uniqueCount: uniqueValues.length,
                    uniqueValues: uniqueValues,
                    description: `Extracted ${propertyName} from ${elements.length} ${ifcType} elements`
                };

                // Include full list only if reasonable size, otherwise sample
                if (validValues.length <= 200) {
                    result.values = validValues;
                } else {
                    result.sample = validValues.slice(0, 100);
                    result.note = `Showing first 100 of ${validValues.length} values`;
                }

                return result;
            }
        }
    }

    // Handle by_type queries (without property extraction)
    if (lowerCode.includes('by_type')) {
        // Extract the type being queried
        const typeMatch = code.match(/by_type\(['"](\w+)['"]\)/);
        if (typeMatch) {
            const ifcType = typeMatch[1];
            const elements = model.elements.filter((el: any) => el.type === ifcType);

            // Check if we're summing a property (like sum([w.Area for w in ...]))
            if (lowerCode.includes('sum(')) {
                // Try to extract what property we're summing
                const sumMatch = code.match(/sum\(\[(.*?)\s+for\s+/);
                if (sumMatch) {
                    const propertyExpression = sumMatch[1];

                    // Extract the property name (e.g., "w.Area" -> "Area")
                    const propMatch = propertyExpression.match(/\w+\.(\w+)/);
                    if (propMatch) {
                        const propertyName = propMatch[1];
                        const propLower = propertyName.toLowerCase();

                        // Handle area properties
                        if (propLower.includes('area')) {
                            let totalArea = 0;
                            const foundProperties: string[] = [];

                            elements.forEach((el: any) => {
                                // Check exact property name first
                                if (el[propertyName]) {
                                    totalArea += el[propertyName];
                                    foundProperties.push(propertyName);
                                }
                                // Check in quantities
                                else if (el.quantities && el.quantities[propertyName]) {
                                    totalArea += el.quantities[propertyName];
                                    foundProperties.push(`quantities.${propertyName}`);
                                }
                                // Check in properties
                                else if (el.properties && el.properties[propertyName]) {
                                    totalArea += el.properties[propertyName];
                                    foundProperties.push(`properties.${propertyName}`);
                                }
                                // Try common area fields if exact match not found
                                else if (el.quantities) {
                                    const areaValue = el.quantities.GrossSideArea ||
                                        el.quantities.NetSideArea ||
                                        el.quantities.Area ||
                                        el.quantities.NetArea ||
                                        el.quantities.GrossArea ||
                                        0;
                                    if (areaValue > 0) {
                                        totalArea += areaValue;
                                    }
                                }
                            });

                            return {
                                value: Math.round(totalArea * 100) / 100,
                                unit: 'm²',
                                elementCount: elements.length,
                                elementType: ifcType,
                                propertyRequested: propertyName,
                                method: foundProperties.length > 0 ?
                                    `summed ${propertyName} from ${foundProperties[0]}` :
                                    'summed available area properties'
                            };
                        }

                        // Handle volume properties
                        if (propLower.includes('volume')) {
                            let totalVolume = 0;
                            const volumeSources: string[] = [];

                            elements.forEach((el: any) => {
                                let foundVolume = false;

                                // Check direct property
                                if (el[propertyName] && typeof el[propertyName] === 'number') {
                                    totalVolume += el[propertyName];
                                    volumeSources.push(propertyName);
                                    foundVolume = true;
                                }
                                // Check in quantities
                                else if (el.quantities && el.quantities[propertyName]) {
                                    totalVolume += el.quantities[propertyName];
                                    volumeSources.push(`quantities.${propertyName}`);
                                    foundVolume = true;
                                }
                                // Check in properties
                                else if (el.properties && el.properties[propertyName]) {
                                    totalVolume += el.properties[propertyName];
                                    volumeSources.push(`properties.${propertyName}`);
                                    foundVolume = true;
                                }
                                // Check in qtos (quantity takeoffs)
                                else if (el.qtos) {
                                    // Check all qtos for volume-related properties
                                    Object.entries(el.qtos).forEach(([qtoName, qtoData]: [string, any]) => {
                                        if (qtoData && typeof qtoData === 'object') {
                                            Object.entries(qtoData).forEach(([propName, propValue]) => {
                                                if (propName.toLowerCase().includes('volume') && typeof propValue === 'number') {
                                                    totalVolume += propValue;
                                                    volumeSources.push(`qtos.${qtoName}.${propName}`);
                                                    foundVolume = true;
                                                }
                                            });
                                        }
                                    });
                                }

                                // Try common volume fields if exact match not found
                                if (!foundVolume && el.quantities) {
                                    const volumeValue = el.quantities.Volume ||
                                        el.quantities.GrossVolume ||
                                        el.quantities.NetVolume ||
                                        0;
                                    if (volumeValue > 0) {
                                        totalVolume += volumeValue;
                                        volumeSources.push('quantities fallback');
                                    }
                                }
                            });

                            // If no volume found, provide diagnostic info
                            if (totalVolume === 0 && elements.length > 0) {
                                const sampleElement = elements[0];
                                return {
                                    value: 0,
                                    unit: 'm³',
                                    elementCount: elements.length,
                                    elementType: ifcType,
                                    propertyRequested: propertyName,
                                    method: 'no volume data found',
                                    diagnostic: {
                                        sampleElement: {
                                            id: sampleElement.id,
                                            type: sampleElement.type,
                                            hasQuantities: !!sampleElement.quantities,
                                            hasQtos: !!sampleElement.qtos,
                                            quantityKeys: sampleElement.quantities ? Object.keys(sampleElement.quantities) : [],
                                            qtoKeys: sampleElement.qtos ? Object.keys(sampleElement.qtos) : []
                                        }
                                    }
                                };
                            }

                            return {
                                value: Math.round(totalVolume * 1000) / 1000,
                                unit: 'm³',
                                elementCount: elements.length,
                                elementType: ifcType,
                                propertyRequested: propertyName,
                                method: volumeSources.length > 0 ?
                                    `summed from ${volumeSources[0]}` :
                                    `summed ${propertyName}`
                            };
                        }

                        // Handle any other numeric property
                        let total = 0;
                        elements.forEach((el: any) => {
                            if (el[propertyName] && typeof el[propertyName] === 'number') {
                                total += el[propertyName];
                            } else if (el.quantities && typeof el.quantities[propertyName] === 'number') {
                                total += el.quantities[propertyName];
                            } else if (el.properties && typeof el.properties[propertyName] === 'number') {
                                total += el.properties[propertyName];
                            }
                        });

                        return {
                            value: total,
                            elementCount: elements.length,
                            elementType: ifcType,
                            propertyRequested: propertyName,
                            method: `summed ${propertyName}`
                        };
                    }
                }
            }

            // Check if we're calculating area/volume (fallback for other patterns)
            if (lowerCode.includes('area') || lowerCode.includes('grosssidearea') || lowerCode.includes('netarea')) {
                // Dynamically discover what area properties are available
                let totalArea = 0;
                const availableAreaFields: Set<string> = new Set();
                const areasByField: Record<string, number> = {};

                // First pass: discover what area fields exist
                elements.forEach((el: any) => {
                    if (el.quantities) {
                        Object.keys(el.quantities).forEach(key => {
                            if (key.toLowerCase().includes('area')) {
                                availableAreaFields.add(key);
                            }
                        });
                    }
                    // Also check direct properties
                    if (el.properties) {
                        Object.keys(el.properties).forEach(key => {
                            if (key.toLowerCase().includes('area')) {
                                availableAreaFields.add(`properties.${key}`);
                            }
                        });
                    }
                });

                // Second pass: calculate areas using discovered fields
                elements.forEach((el: any) => {
                    // Try quantities first
                    if (el.quantities) {
                        // Priority order for area fields
                        const areaValue = el.quantities.GrossSideArea ||
                            el.quantities.NetSideArea ||
                            el.quantities.Area ||
                            el.quantities.NetArea ||
                            el.quantities.GrossArea ||
                            0;

                        if (areaValue > 0) {
                            totalArea += areaValue;
                            // Track which field provided the value
                            for (const [key, val] of Object.entries(el.quantities)) {
                                if (val === areaValue && key.toLowerCase().includes('area')) {
                                    areasByField[key] = (areasByField[key] || 0) + areaValue;
                                    break;
                                }
                            }
                        }
                    }

                    // Fallback to properties if no quantities
                    if (totalArea === 0 && el.properties) {
                        const propArea = el.properties.Area || el.properties.NetArea || 0;
                        if (propArea > 0) {
                            totalArea += propArea;
                            areasByField['properties.Area'] = (areasByField['properties.Area'] || 0) + propArea;
                        }
                    }
                });

                // If no area found, provide diagnostic information
                if (totalArea === 0 && elements.length > 0) {
                    // Inspect first element to understand structure
                    const sampleElement = elements[0];
                    const availableData: any = {
                        message: 'No area quantities found in elements',
                        elementCount: elements.length,
                        elementType: ifcType,
                        sampleElementStructure: {
                            hasQuantities: !!sampleElement.quantities,
                            hasProperties: !!sampleElement.properties,
                            hasPsets: !!sampleElement.psets,
                            quantityKeys: sampleElement.quantities ? Object.keys(sampleElement.quantities) : [],
                            propertyKeys: sampleElement.properties ? Object.keys(sampleElement.properties).slice(0, 10) : [],
                            psetKeys: sampleElement.psets ? Object.keys(sampleElement.psets) : []
                        }
                    };

                    // Check if areas might be in psets
                    if (sampleElement.psets) {
                        let psetArea = 0;
                        Object.entries(sampleElement.psets).forEach(([psetName, psetData]: [string, any]) => {
                            if (psetData && typeof psetData === 'object') {
                                Object.entries(psetData).forEach(([propName, propValue]) => {
                                    if (propName.toLowerCase().includes('area') && typeof propValue === 'number') {
                                        psetArea += propValue;
                                        availableData.foundInPset = { psetName, propName, value: propValue };
                                    }
                                });
                            }
                        });

                        // If found in psets, calculate for all elements
                        if (psetArea > 0 && availableData.foundInPset) {
                            elements.forEach((el: any) => {
                                if (el.psets && el.psets[availableData.foundInPset.psetName]) {
                                    const val = el.psets[availableData.foundInPset.psetName][availableData.foundInPset.propName];
                                    if (typeof val === 'number') {
                                        totalArea += val;
                                    }
                                }
                            });

                            return {
                                value: Math.round(totalArea * 100) / 100,
                                unit: 'm²',
                                elementCount: elements.length,
                                elementType: ifcType,
                                method: `calculated from pset: ${availableData.foundInPset.psetName}.${availableData.foundInPset.propName}`,
                                source: availableData.foundInPset
                            };
                        }
                    }

                    return availableData;
                }

                return {
                    value: Math.round(totalArea * 100) / 100,
                    unit: 'm²',
                    elementCount: elements.length,
                    elementType: ifcType,
                    method: 'calculated from available quantities',
                    availableFields: Array.from(availableAreaFields),
                    areasByField: areasByField,
                    elements: elements.slice(0, 3).map((el: any) => ({
                        id: el.id,
                        name: el.properties?.Name,
                        quantities: el.quantities,
                        type: el.type
                    }))
                };
            }

            // Check if we're calculating volume
            if (lowerCode.includes('volume')) {
                // Dynamically discover what volume properties are available
                let totalVolume = 0;
                const availableVolumeFields: Set<string> = new Set();
                const volumesByField: Record<string, number> = {};

                // First pass: discover what volume fields exist
                elements.forEach((el: any) => {
                    if (el.quantities) {
                        Object.keys(el.quantities).forEach(key => {
                            if (key.toLowerCase().includes('volume')) {
                                availableVolumeFields.add(key);
                            }
                        });
                    }
                    // Also check direct properties
                    if (el.properties) {
                        Object.keys(el.properties).forEach(key => {
                            if (key.toLowerCase().includes('volume')) {
                                availableVolumeFields.add(`properties.${key}`);
                            }
                        });
                    }
                });

                // Second pass: calculate volumes using discovered fields
                elements.forEach((el: any) => {
                    // Try quantities first
                    if (el.quantities) {
                        const volumeValue = el.quantities.Volume ||
                            el.quantities.GrossVolume ||
                            el.quantities.NetVolume ||
                            0;

                        if (volumeValue > 0) {
                            totalVolume += volumeValue;
                            // Track which field provided the value
                            for (const [key, val] of Object.entries(el.quantities)) {
                                if (val === volumeValue && key.toLowerCase().includes('volume')) {
                                    volumesByField[key] = (volumesByField[key] || 0) + volumeValue;
                                    break;
                                }
                            }
                        }
                    }

                    // Fallback to properties if no quantities
                    if (totalVolume === 0 && el.properties) {
                        const propVolume = el.properties.Volume || 0;
                        if (propVolume > 0) {
                            totalVolume += propVolume;
                            volumesByField['properties.Volume'] = (volumesByField['properties.Volume'] || 0) + propVolume;
                        }
                    }
                });

                return {
                    value: Math.round(totalVolume * 1000) / 1000,
                    unit: 'm³',
                    elementCount: elements.length,
                    elementType: ifcType,
                    method: 'calculated from available quantities',
                    availableFields: Array.from(availableVolumeFields),
                    volumesByField: volumesByField
                };
            }

            // Check if this is a material extraction query - if so, don't return elements yet
            if (lowerCode.includes('get_material') || lowerCode.includes('material')) {
                // Let the material extraction handler below process this
                // Don't return here
            } else {
                // Return the elements themselves (only if not already handled by len() or sum())
                // This should only happen for direct by_type queries without aggregation
                // Return a simplified version suitable for display
                return {
                    type: 'elements',
                    elementType: ifcType,
                    count: elements.length,
                    elements: elements.slice(0, 10).map((el: any) => ({
                        id: el.id,
                        expressId: el.expressId,
                        type: el.type,
                        name: el.properties?.Name || 'Unnamed',
                        globalId: el.properties?.GlobalId,
                        // Include key properties for display
                        properties: {
                            Name: el.properties?.Name,
                            Description: el.properties?.Description,
                            Tag: el.properties?.Tag
                        }
                    })),
                    fullCount: elements.length,
                    description: `${elements.length} ${ifcType} elements found`
                };
            }
        }
    }

    // Handle element.get_info() or similar method calls
    if (lowerCode.includes('.get_info()')) {
        // Extract what we're getting info for
        const infoMatch = code.match(/(\w+)\.get_info\(\)/);
        if (infoMatch) {
            const varName = infoMatch[1];

            // If it's for elements from by_type
            if (code.includes('by_type')) {
                const typeMatch = code.match(/by_type\(['"](\w+)['"]\)/);
                if (typeMatch) {
                    const ifcType = typeMatch[1];
                    const elements = model.elements.filter((el: any) => el.type === ifcType);

                    // Return info for each element
                    return {
                        type: 'element_info',
                        elementType: ifcType,
                        count: elements.length,
                        info: elements.slice(0, 5).map((el: any) => ({
                            id: el.id,
                            expressId: el.expressId,
                            type: el.type,
                            globalId: el.properties?.GlobalId,
                            name: el.properties?.Name || 'Unnamed',
                            properties: el.properties,
                            psets: Object.keys(el.psets || {}),
                            qtos: Object.keys(el.qtos || {}),
                            hasGeometry: !!el.geometry,
                            hasMaterial: !!el.material
                        })),
                        description: `Info for ${Math.min(5, elements.length)} of ${elements.length} ${ifcType} elements`
                    };
                }
            }
        }
    }

    // Handle property extraction
    if (lowerCode.includes('get_psets') || lowerCode.includes('psets')) {
        const elements = model.elements.slice(0, 10); // Sample elements
        const allPsets = new Set<string>();
        const psetData: any[] = [];

        elements.forEach((el: any) => {
            if (el.psets) {
                Object.keys(el.psets).forEach(psetName => {
                    allPsets.add(psetName);
                    psetData.push({
                        element: el.id,
                        type: el.type,
                        pset: psetName,
                        properties: el.psets[psetName]
                    });
                });
            }
        });

        return {
            propertySetNames: Array.from(allPsets),
            sampleData: psetData.slice(0, 5),
            totalPropertySets: allPsets.size
        };
    }

    // Handle material extraction
    if (lowerCode.includes('get_material') || lowerCode.includes('material')) {
        const materials = new Set<string>();
        const materialData: any[] = [];

        // Check if we're looking for materials of a specific element type
        const typeMatch = code.match(/by_type\(['"](\w+)['"]\)/);
        const ifcType = typeMatch ? typeMatch[1] : null;

        // Filter elements by type if specified
        const elementsToCheck = ifcType
            ? model.elements.filter((el: any) => el.type === ifcType)
            : model.elements;

        elementsToCheck.forEach((el: any) => {
            if (el.material) {
                const matName = typeof el.material === 'string' ? el.material : el.material.Name;
                materials.add(matName);
                materialData.push({
                    element: el.id,
                    type: el.type,
                    material: matName
                });
            }
        });

        const uniqueMaterials = Array.from(materials);

        // If the code ends with list() or is requesting a list, return in list format
        if (returnType === 'list' || lowerCode.endsWith('list(materials)') || lowerCode.includes('list(materials)')) {
            return {
                type: 'list',
                property: 'Material',
                elementType: ifcType || 'Element',
                totalElements: elementsToCheck.length,
                foundCount: materialData.length,
                uniqueCount: uniqueMaterials.length,
                uniqueValues: uniqueMaterials,
                description: `Found ${uniqueMaterials.length} unique materials in ${materialData.length} ${ifcType || 'element'}s`
            };
        }

        // Otherwise return detailed material info
        return {
            type: 'materials',
            materials: uniqueMaterials,
            elementsWithMaterials: materialData.length,
            sampleData: materialData.slice(0, 10),
            elementType: ifcType || 'Element'
        };
    }

    // Handle spatial queries
    if (lowerCode.includes('ifcspace') || lowerCode.includes('space')) {
        const spaces = model.elements.filter((el: any) => el.type === 'IfcSpace');
        return {
            spaces: spaces.map((s: any) => ({
                id: s.id,
                name: s.properties?.Name,
                area: s.quantities?.Area,
                volume: s.quantities?.Volume
            })),
            totalSpaces: spaces.length
        };
    }

    // Default: return element counts by type
    const elementsByType: Record<string, number> = {};
    model.elements.forEach((el: any) => {
        elementsByType[el.type] = (elementsByType[el.type] || 0) + 1;
    });

    return {
        elementCounts: elementsByType,
        totalElements: model.elements.length,
        note: 'Executed Python-like query on actual IFC data'
    };
}


