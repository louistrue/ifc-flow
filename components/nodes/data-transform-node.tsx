"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { Shuffle, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { DataTransformNodeData } from "./node-types";

export const DataTransformNode = memo(({ data, isConnectable }: NodeProps<DataTransformNodeData>) => {
    const { properties, preview } = data;
    const steps = properties?.steps || [];
    const enabledSteps = steps.filter(step => step.enabled);

    // Helper to format step display
    const formatStepSummary = () => {
        if (enabledSteps.length === 0) {
            return "No steps configured";
        }

        const stepTypes = enabledSteps.map(step => {
            switch (step.type) {
                case 'filter':
                    const conditions = step.config.conditions || [];
                    return `Filter (${conditions.length} condition${conditions.length !== 1 ? 's' : ''})`;
                case 'map':
                    const mappings = Object.keys(step.config.mappings || {});
                    return `Map (${mappings.length} field${mappings.length !== 1 ? 's' : ''})`;
                case 'toMapping':
                    return `→ Mappings (${step.config.keyPath || 'GlobalId'} → ${step.config.valuePath || 'value'})`;
                case 'groupBy':
                    return `Group by ${step.config.keyPath || 'id'}`;
                case 'sort':
                    return `Sort by ${step.config.keyPath || 'id'} ${step.config.direction || 'asc'}`;
                case 'limit':
                    return `Limit ${step.config.limit || 100}`;
                case 'pick':
                    const pickFields = step.config.fields || [];
                    return `Pick ${pickFields.length} field${pickFields.length !== 1 ? 's' : ''}`;
                case 'omit':
                    const omitFields = step.config.fields || [];
                    return `Omit ${omitFields.length} field${omitFields.length !== 1 ? 's' : ''}`;
                case 'flatten':
                    return `Flatten ${step.config.path || 'array'}`;
                case 'unique':
                    return `Unique by ${step.config.keyPath || 'id'}`;
                case 'join':
                    return `${step.config.joinType || 'Left'} join`;
                case 'rename':
                    const renameMappings = Object.keys(step.config.mappings || {});
                    return `Rename ${renameMappings.length} field${renameMappings.length !== 1 ? 's' : ''}`;
                default:
                    return step.type;
            }
        });

        if (stepTypes.length <= 2) {
            return stepTypes.join(' → ');
        } else {
            return `${stepTypes.length} steps: ${stepTypes[0]} → ... → ${stepTypes[stepTypes.length - 1]}`;
        }
    };

    // Helper to get status color and icon
    const getStatusInfo = () => {
        if (!preview) {
            return { color: 'text-gray-500', icon: Info, text: 'Not executed' };
        }

        if (preview.warnings.length > 0) {
            return { color: 'text-yellow-500', icon: AlertTriangle, text: `${preview.warnings.length} warning${preview.warnings.length !== 1 ? 's' : ''}` };
        }

        return { color: 'text-green-500', icon: CheckCircle, text: 'Success' };
    };

    const statusInfo = getStatusInfo();
    const StatusIcon = statusInfo.icon;

    return (
        <div className="bg-white dark:bg-gray-800 border-2 border-cyan-500 dark:border-cyan-400 rounded-md w-64 shadow-md">
            <div className="bg-cyan-500 text-white px-3 py-1 flex items-center gap-2">
                <Shuffle className="h-4 w-4" />
                <div className="text-sm font-medium truncate">{data.label || "Data Transform"}</div>
            </div>

            <div className="p-3 text-xs space-y-2">
                {/* Steps summary */}
                <div>
                    <div className="text-gray-600 dark:text-gray-400 mb-1">Pipeline:</div>
                    <div className="text-gray-900 dark:text-gray-100 font-medium">
                        {formatStepSummary()}
                    </div>
                </div>

                {/* Execution status and counts */}
                {preview && (
                    <div className="space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Status:</span>
                            <div className="flex items-center gap-1">
                                <StatusIcon className={`h-3 w-3 ${statusInfo.color}`} />
                                <span className={`text-xs ${statusInfo.color}`}>{statusInfo.text}</span>
                            </div>
                        </div>

                        <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Input:</span>
                            <span className="font-medium">{preview.inputCount.toLocaleString()}</span>
                        </div>

                        <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Output:</span>
                            <span className="font-medium">{preview.outputCount.toLocaleString()}</span>
                        </div>

                        {/* Show sample output for mappings */}
                        {data.results && data.results.mappings && (
                            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                <div className="text-gray-600 dark:text-gray-400 mb-1">Sample mappings:</div>
                                <div className="text-xs space-y-0.5">
                                    {Object.entries(data.results.mappings)
                                        .slice(0, 2)
                                        .map(([key, value]) => (
                                            <div key={key} className="flex justify-between">
                                                <span className="text-gray-500 truncate max-w-[80px]">
                                                    {key.length > 8 ? `${key.slice(0, 8)}...` : key}
                                                </span>
                                                <span className="font-medium truncate max-w-[100px]">
                                                    {String(value).length > 12 ? `${String(value).slice(0, 12)}...` : String(value)}
                                                </span>
                                            </div>
                                        ))}
                                    {Object.keys(data.results.mappings).length > 2 && (
                                        <div className="text-gray-500 text-center">
                                            +{Object.keys(data.results.mappings).length - 2} more...
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Show warnings */}
                        {preview.warnings.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                <div className="text-yellow-600 dark:text-yellow-400 text-xs">
                                    {preview.warnings.slice(0, 2).map((warning, i) => (
                                        <div key={i} className="truncate" title={warning}>
                                            • {warning}
                                        </div>
                                    ))}
                                    {preview.warnings.length > 2 && (
                                        <div>• +{preview.warnings.length - 2} more warnings</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Mode indicator */}
                <div className="flex justify-between text-xs">
                    <span className="text-gray-600 dark:text-gray-400">Mode:</span>
                    <span className="font-medium capitalize">{properties?.mode || 'steps'}</span>
                </div>

                {/* Restriction indicator */}
                {properties?.restrictToIncomingElements && (
                    <div className="text-xs text-blue-600 dark:text-blue-400">
                        ⚡ Restricted to incoming elements
                    </div>
                )}
            </div>

            {/* Primary input handle */}
            <Handle
                type="target"
                position={Position.Left}
                id="input"
                style={{ background: "#555", width: 10, height: 10, top: '40%' }}
                isConnectable={isConnectable}
            />

            {/* Optional second input for joins/restrictions - only show if needed */}
            {(properties?.restrictToIncomingElements ||
                steps.some(step => step.type === 'join' && step.enabled)) && (
                    <Handle
                        type="target"
                        position={Position.Left}
                        id="inputB"
                        style={{ background: "#06b6d4", width: 8, height: 8, top: '75%' }}
                        isConnectable={isConnectable}
                    />
                )}

            {/* Handle labels */}
            <div className="absolute -left-12 top-[35%] text-[10px] text-gray-500 pointer-events-none">
                data
            </div>
            {(properties?.restrictToIncomingElements ||
                steps.some(step => step.type === 'join' && step.enabled)) && (
                    <div className="absolute -left-16 top-[70%] text-[10px] text-cyan-600 pointer-events-none">
                        filter
                    </div>
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
});

DataTransformNode.displayName = "DataTransformNode";
