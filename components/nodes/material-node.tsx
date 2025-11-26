"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { Layers, AlertTriangle, CheckCircle2 } from "lucide-react";
import { MaterialNodeData } from "./node-types";

interface MaterialNodeProps {
    data: {
        label?: string;
        properties?: {
            action?: string;
            materialName?: string;
            materialCategory?: string;
            materialDescription?: string;
            useValueInput?: boolean;
        };
        results?: any[];
        isLoading?: boolean;
        error?: string | null;
    };
    isConnectable?: boolean;
}

export const MaterialNode = memo(
    ({ data, isConnectable }: MaterialNodeProps) => {
        const { properties, label = "Materials", isLoading, error } = data;

        const action = properties?.action || "get";
        const materialName = properties?.materialName || "";
        const materialCategory = properties?.materialCategory || "";
        const useValueInput = properties?.useValueInput || false;

        // Helper to get results summary
        const getResultsSummary = () => {
            if (!data.results) return null;

            if (action === "get") {
                // Handle new structure with materials array and summary
                if (typeof data.results === 'object' && !Array.isArray(data.results)) {
                    const summary = (data.results as any).summary;
                    if (summary) {
                        return `${summary.uniqueMaterials} material${summary.uniqueMaterials !== 1 ? 's' : ''} found`;
                    }
                }
                // Fallback for array format
                const materialCount = Array.isArray(data.results) ? data.results.length : 0;
                return `${materialCount} material${materialCount !== 1 ? 's' : ''} found`;
            } else if (action === "create") {
                return `Material created`;
            } else if (action === "assign") {
                const assignedCount = (data.results as any)?.assignedCount || 0;
                return `${assignedCount} element${assignedCount !== 1 ? 's' : ''} assigned`;
            }
            return null;
        };

        const resultsSummary = getResultsSummary();

        return (
            <div className="bg-white dark:bg-gray-800 border-2 border-purple-500 dark:border-purple-400 rounded-md w-48 shadow-md">
                <div className="bg-purple-500 text-white px-3 py-1 flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    <div className="text-sm font-medium truncate">{label}</div>
                </div>
                <div className="p-3 text-xs">
                    {materialName || useValueInput ? (
                        <div className="space-y-1">
                            <div className="flex justify-between">
                                <span>Action:</span>
                                <span className="font-medium capitalize">{action}</span>
                            </div>

                            {/* Show material name for create/assign actions */}
                            {(action === "create" || action === "assign") && (
                                <>
                                    <div className="flex justify-between">
                                        <span>Material:</span>
                                        <span className="font-medium truncate max-w-24">
                                            {useValueInput ? "From Input" : materialName}
                                        </span>
                                    </div>

                                    {materialCategory && !useValueInput && (
                                        <div className="flex justify-between">
                                            <span>Category:</span>
                                            <span className="font-medium truncate max-w-24">
                                                {materialCategory}
                                            </span>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Loading state */}
                            {isLoading && (
                                <div className="mt-2 pt-1 border-t border-gray-200 text-blue-600 flex items-center gap-1">
                                    <div className="animate-spin h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full" />
                                    <span className="text-xs">Processing...</span>
                                </div>
                            )}

                            {/* Error state */}
                            {error && (
                                <div className="mt-2 pt-1 border-t border-gray-200 text-red-600 flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    <span className="text-xs">Error</span>
                                </div>
                            )}

                            {/* Results summary */}
                            {!isLoading && !error && resultsSummary && (
                                <div className="mt-2 pt-1 border-t border-gray-200 text-green-600 flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3" />
                                    <span className="text-xs">{resultsSummary}</span>
                                </div>
                            )}

                            {/* Value input indicator */}
                            {useValueInput && (
                                <div className="text-xs text-purple-500 mt-1">
                                    Using value from input
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-muted-foreground">No material configured</div>
                    )}
                </div>

                {/* Input handle for elements */}
                <Handle
                    type="target"
                    position={Position.Left}
                    id="input"
                    style={{ background: "#555", width: 8, height: 8 }}
                    isConnectable={isConnectable}
                />

                {/* Value input handle for material names from upstream nodes */}
                {useValueInput && (action === "assign" || action === "create") && (
                    <Handle
                        type="target"
                        position={Position.Top}
                        id="valueInput"
                        style={{ background: "#9333ea", width: 8, height: 8 }}
                        isConnectable={isConnectable}
                    />
                )}

                {/* Output handle */}
                <Handle
                    type="source"
                    position={Position.Right}
                    id="output"
                    style={{ background: "#555", width: 8, height: 8 }}
                    isConnectable={isConnectable}
                />
            </div>
        );
    }
);

MaterialNode.displayName = "MaterialNode";
