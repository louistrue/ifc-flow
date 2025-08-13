"use client";

import { useState } from "react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Switch } from "../../ui/switch";
import { Textarea } from "../../ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Badge } from "../../ui/badge";
import { Trash2, Plus, ChevronUp, ChevronDown, Copy, Settings } from "lucide-react";
import { TransformStep, FilterCondition } from "../../nodes/node-types";
import { TRANSFORM_PRESETS } from "../../../lib/data-transform-utils";

interface DataTransformEditorProps {
    properties: any;
    setProperties: (properties: any) => void;
}

export function DataTransformEditor({ properties, setProperties }: DataTransformEditorProps) {
    const [expandedStep, setExpandedStep] = useState<string | null>(null);

    const steps: TransformStep[] = properties?.steps || [];
    const mode = properties?.mode || 'steps';
    const restrictToIncomingElements = properties?.restrictToIncomingElements || false;

    const updateProperty = (key: string, value: any) => {
        setProperties({
            ...properties,
            [key]: value,
        });
    };

    const updateStep = (stepId: string, updates: Partial<TransformStep>) => {
        const newSteps = steps.map(step =>
            step.id === stepId ? { ...step, ...updates } : step
        );
        updateProperty('steps', newSteps);
    };

    const addStep = (type: TransformStep['type']) => {
        const newStep: TransformStep = {
            id: `step-${Date.now()}`,
            type,
            enabled: true,
            config: getDefaultConfig(type)
        };
        updateProperty('steps', [...steps, newStep]);
        setExpandedStep(newStep.id);
    };

    const removeStep = (stepId: string) => {
        const newSteps = steps.filter(step => step.id !== stepId);
        updateProperty('steps', newSteps);
        if (expandedStep === stepId) {
            setExpandedStep(null);
        }
    };

    const moveStep = (stepId: string, direction: 'up' | 'down') => {
        const index = steps.findIndex(step => step.id === stepId);
        if (index === -1) return;

        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= steps.length) return;

        const newSteps = [...steps];
        [newSteps[index], newSteps[newIndex]] = [newSteps[newIndex], newSteps[index]];
        updateProperty('steps', newSteps);
    };

    const duplicateStep = (stepId: string) => {
        const step = steps.find(s => s.id === stepId);
        if (!step) return;

        const newStep: TransformStep = {
            ...step,
            id: `step-${Date.now()}`,
        };
        const index = steps.findIndex(s => s.id === stepId);
        const newSteps = [...steps];
        newSteps.splice(index + 1, 0, newStep);
        updateProperty('steps', newSteps);
    };

    const applyPreset = (presetKey: string) => {
        const preset = TRANSFORM_PRESETS[presetKey as keyof typeof TRANSFORM_PRESETS];
        if (preset) {
            updateProperty('steps', preset.steps);
            setExpandedStep(null);
        }
    };

    return (
        <div className="space-y-4">
            {/* Mode Selection */}
            <div className="space-y-2">
                <Label>Transform Mode</Label>
                <Select value={mode} onValueChange={(value) => updateProperty('mode', value)}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="steps">Visual Steps</SelectItem>
                        <SelectItem value="expression" disabled>Expression (Coming Soon)</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Global Options */}
            <div className="space-y-2">
                <div className="flex items-center space-x-2">
                    <Switch
                        checked={restrictToIncomingElements}
                        onCheckedChange={(checked) => updateProperty('restrictToIncomingElements', checked)}
                    />
                    <Label className="text-sm">Restrict to incoming elements (inputB)</Label>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                    When enabled, only process elements that are also present in the inputB connection
                </p>
            </div>

            {mode === 'steps' && (
                <>
                    {/* Presets */}
                    <div className="space-y-2">
                        <Label>Quick Presets</Label>
                        <div className="grid grid-cols-1 gap-2">
                            {Object.entries(TRANSFORM_PRESETS).map(([key, preset]) => (
                                <Button
                                    key={key}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => applyPreset(key)}
                                    className="justify-start text-left h-auto p-2"
                                >
                                    <div>
                                        <div className="font-medium text-xs">{preset.name}</div>
                                        <div className="text-xs text-gray-600 dark:text-gray-400">{preset.description}</div>
                                    </div>
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Steps Pipeline */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>Transform Steps</Label>
                            <Badge variant="secondary">{steps.filter(s => s.enabled).length} enabled</Badge>
                        </div>

                        {steps.length === 0 && (
                            <div className="text-center py-8 text-gray-500 dark:text-gray-400 border-2 border-dashed rounded-lg">
                                <p className="text-sm">No transform steps configured</p>
                                <p className="text-xs">Add a step below to get started</p>
                            </div>
                        )}

                        {steps.map((step, index) => (
                            <Card key={step.id} className={`${!step.enabled ? 'opacity-50' : ''}`}>
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Badge variant={step.enabled ? "default" : "secondary"}>
                                                {index + 1}
                                            </Badge>
                                            <CardTitle className="text-sm capitalize">{step.type}</CardTitle>
                                            <Switch
                                                checked={step.enabled}
                                                onCheckedChange={(enabled) => updateStep(step.id, { enabled })}
                                            />
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                                            >
                                                <Settings className="h-3 w-3" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => moveStep(step.id, 'up')}
                                                disabled={index === 0}
                                            >
                                                <ChevronUp className="h-3 w-3" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => moveStep(step.id, 'down')}
                                                disabled={index === steps.length - 1}
                                            >
                                                <ChevronDown className="h-3 w-3" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => duplicateStep(step.id)}
                                            >
                                                <Copy className="h-3 w-3" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removeStep(step.id)}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>

                                {expandedStep === step.id && (
                                    <CardContent className="pt-0">
                                        <StepConfigEditor
                                            step={step}
                                            updateStep={(updates) => updateStep(step.id, updates)}
                                        />
                                    </CardContent>
                                )}
                            </Card>
                        ))}

                        {/* Add Step */}
                        <div className="space-y-2">
                            <Label>Add Step</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { type: 'filter', label: 'Filter', desc: 'Filter items by conditions' },
                                    { type: 'map', label: 'Map', desc: 'Transform fields' },
                                    { type: 'pick', label: 'Pick', desc: 'Select specific fields' },
                                    { type: 'omit', label: 'Omit', desc: 'Remove fields' },
                                    { type: 'groupBy', label: 'Group By', desc: 'Group and aggregate' },
                                    { type: 'sort', label: 'Sort', desc: 'Sort by field' },
                                    { type: 'limit', label: 'Limit', desc: 'Limit results' },
                                    { type: 'toMapping', label: 'To Mapping', desc: 'Create property mappings' },
                                ].map(({ type, label, desc }) => (
                                    <Button
                                        key={type}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => addStep(type as TransformStep['type'])}
                                        className="h-auto p-2 text-left justify-start"
                                    >
                                        <div>
                                            <div className="font-medium text-xs">{label}</div>
                                            <div className="text-xs text-gray-600 dark:text-gray-400">{desc}</div>
                                        </div>
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {mode === 'expression' && (
                <div className="space-y-2">
                    <Label>Transform Expression</Label>
                    <Textarea
                        value={properties?.expression || ''}
                        onChange={(e) => updateProperty('expression', e.target.value)}
                        placeholder="// JSONata-like expression (coming soon)&#10;$.elements[type='IfcWall'].{GlobalId: properties.GlobalId, SpaceName: spaceName}"
                        rows={6}
                        disabled
                    />
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                        Expression mode will allow JSONata-like transformations for power users
                    </p>
                </div>
            )}
        </div>
    );
}

function StepConfigEditor({ step, updateStep }: { step: TransformStep; updateStep: (updates: Partial<TransformStep>) => void }) {
    const updateConfig = (key: string, value: any) => {
        updateStep({
            config: {
                ...step.config,
                [key]: value
            }
        });
    };

    switch (step.type) {
        case 'filter':
            return <FilterStepConfig config={step.config} updateConfig={updateConfig} />;
        case 'map':
            return <MapStepConfig config={step.config} updateConfig={updateConfig} />;
        case 'pick':
        case 'omit':
            return <FieldsStepConfig config={step.config} updateConfig={updateConfig} type={step.type} />;
        case 'groupBy':
            return <GroupByStepConfig config={step.config} updateConfig={updateConfig} />;
        case 'sort':
            return <SortStepConfig config={step.config} updateConfig={updateConfig} />;
        case 'limit':
            return <LimitStepConfig config={step.config} updateConfig={updateConfig} />;
        case 'toMapping':
            return <ToMappingStepConfig config={step.config} updateConfig={updateConfig} />;
        case 'join':
            return <JoinStepConfig config={step.config} updateConfig={updateConfig} />;
        case 'rename':
            return <RenameStepConfig config={step.config} updateConfig={updateConfig} />;
        default:
            return <div className="text-sm text-gray-500">Configuration for {step.type} not implemented yet</div>;
    }
}

function FilterStepConfig({ config, updateConfig }: { config: any; updateConfig: (key: string, value: any) => void }) {
    const conditions: FilterCondition[] = config.conditions || [];
    const logic = config.logic || 'and';

    const addCondition = () => {
        const newCondition: FilterCondition = {
            path: '',
            operator: 'equals',
            value: ''
        };
        updateConfig('conditions', [...conditions, newCondition]);
    };

    const updateCondition = (index: number, updates: Partial<FilterCondition>) => {
        const newConditions = conditions.map((cond, i) =>
            i === index ? { ...cond, ...updates } : cond
        );
        updateConfig('conditions', newConditions);
    };

    const removeCondition = (index: number) => {
        updateConfig('conditions', conditions.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-3">
            <div className="space-y-2">
                <Label>Logic</Label>
                <Select value={logic} onValueChange={(value) => updateConfig('logic', value)}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="and">AND (all conditions must match)</SelectItem>
                        <SelectItem value="or">OR (any condition can match)</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label>Conditions</Label>
                    <Button size="sm" onClick={addCondition}>
                        <Plus className="h-3 w-3 mr-1" />
                        Add
                    </Button>
                </div>

                {conditions.map((condition, index) => (
                    <Card key={index} className="p-3">
                        <div className="grid grid-cols-12 gap-2 items-end">
                            <div className="col-span-4">
                                <Label className="text-xs">Field Path</Label>
                                <Input
                                    value={condition.path}
                                    onChange={(e) => updateCondition(index, { path: e.target.value })}
                                    placeholder="e.g., type, properties.GlobalId"
                                    className="text-xs"
                                />
                            </div>
                            <div className="col-span-3">
                                <Label className="text-xs">Operator</Label>
                                <Select value={condition.operator} onValueChange={(value) => updateCondition(index, { operator: value as any })}>
                                    <SelectTrigger className="text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="equals">Equals</SelectItem>
                                        <SelectItem value="notEquals">Not Equals</SelectItem>
                                        <SelectItem value="contains">Contains</SelectItem>
                                        <SelectItem value="startsWith">Starts With</SelectItem>
                                        <SelectItem value="endsWith">Ends With</SelectItem>
                                        <SelectItem value="in">In Array</SelectItem>
                                        <SelectItem value="notIn">Not In Array</SelectItem>
                                        <SelectItem value="gt">Greater Than</SelectItem>
                                        <SelectItem value="gte">Greater Than or Equal</SelectItem>
                                        <SelectItem value="lt">Less Than</SelectItem>
                                        <SelectItem value="lte">Less Than or Equal</SelectItem>
                                        <SelectItem value="exists">Exists</SelectItem>
                                        <SelectItem value="notExists">Not Exists</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="col-span-4">
                                <Label className="text-xs">Value</Label>
                                {condition.operator === 'in' || condition.operator === 'notIn' ? (
                                    <Textarea
                                        value={Array.isArray(condition.value) ? condition.value.join('\n') : condition.value}
                                        onChange={(e) => updateCondition(index, { value: e.target.value.split('\n').filter(v => v.trim()) })}
                                        placeholder="One value per line"
                                        rows={2}
                                        className="text-xs"
                                    />
                                ) : condition.operator === 'exists' || condition.operator === 'notExists' ? (
                                    <Input disabled placeholder="No value needed" className="text-xs" />
                                ) : (
                                    <Input
                                        value={condition.value}
                                        onChange={(e) => updateCondition(index, { value: e.target.value })}
                                        placeholder="Value to compare"
                                        className="text-xs"
                                    />
                                )}
                            </div>
                            <div className="col-span-1">
                                <Button size="sm" variant="ghost" onClick={() => removeCondition(index)}>
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
}

function MapStepConfig({ config, updateConfig }: { config: any; updateConfig: (key: string, value: any) => void }) {
    const mappings = config.mappings || {};

    const addMapping = () => {
        const newMappings = {
            ...mappings,
            [`field${Object.keys(mappings).length + 1}`]: { source: '', transform: '', default: '' }
        };
        updateConfig('mappings', newMappings);
    };

    const updateMapping = (field: string, updates: any) => {
        updateConfig('mappings', {
            ...mappings,
            [field]: { ...mappings[field], ...updates }
        });
    };

    const removeMapping = (field: string) => {
        const newMappings = { ...mappings };
        delete newMappings[field];
        updateConfig('mappings', newMappings);
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <Label>Field Mappings</Label>
                <Button size="sm" onClick={addMapping}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                </Button>
            </div>

            {Object.entries(mappings).map(([field, mapping]: [string, any]) => (
                <Card key={field} className="p-3">
                    <div className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-3">
                            <Label className="text-xs">New Field</Label>
                            <Input
                                value={field}
                                onChange={(e) => {
                                    const newMappings = { ...mappings };
                                    delete newMappings[field];
                                    newMappings[e.target.value] = mapping;
                                    updateConfig('mappings', newMappings);
                                }}
                                className="text-xs"
                            />
                        </div>
                        <div className="col-span-3">
                            <Label className="text-xs">Source Path</Label>
                            <Input
                                value={mapping.source || ''}
                                onChange={(e) => updateMapping(field, { source: e.target.value })}
                                placeholder="e.g., properties.GlobalId"
                                className="text-xs"
                            />
                        </div>
                        <div className="col-span-2">
                            <Label className="text-xs">Transform</Label>
                            <Select value={mapping.transform || ''} onValueChange={(value) => updateMapping(field, { transform: value })}>
                                <SelectTrigger className="text-xs">
                                    <SelectValue placeholder="None" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">None</SelectItem>
                                    <SelectItem value="upper">UPPER</SelectItem>
                                    <SelectItem value="lower">lower</SelectItem>
                                    <SelectItem value="title">Title Case</SelectItem>
                                    <SelectItem value="trim">Trim</SelectItem>
                                    <SelectItem value="number">Number</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="col-span-3">
                            <Label className="text-xs">Default</Label>
                            <Input
                                value={mapping.default || ''}
                                onChange={(e) => updateMapping(field, { default: e.target.value })}
                                placeholder="Default value"
                                className="text-xs"
                            />
                        </div>
                        <div className="col-span-1">
                            <Button size="sm" variant="ghost" onClick={() => removeMapping(field)}>
                                <Trash2 className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    );
}

function FieldsStepConfig({ config, updateConfig, type }: { config: any; updateConfig: (key: string, value: any) => void; type: 'pick' | 'omit' }) {
    const fields: string[] = config.fields || [];

    return (
        <div className="space-y-2">
            <Label>Fields to {type}</Label>
            <Textarea
                value={fields.join('\n')}
                onChange={(e) => updateConfig('fields', e.target.value.split('\n').filter(f => f.trim()))}
                placeholder="One field path per line&#10;e.g.:&#10;type&#10;properties.GlobalId&#10;spaceName"
                rows={4}
                className="text-xs"
            />
            <p className="text-xs text-gray-600 dark:text-gray-400">
                Enter field paths, one per line. Use dot notation for nested fields.
            </p>
        </div>
    );
}

function GroupByStepConfig({ config, updateConfig }: { config: any; updateConfig: (key: string, value: any) => void }) {
    const keyPath = config.keyPath || '';
    const aggregates = config.aggregates || {};

    const addAggregate = () => {
        const newAggregates = {
            ...aggregates,
            [`field${Object.keys(aggregates).length + 1}`]: 'count'
        };
        updateConfig('aggregates', newAggregates);
    };

    const updateAggregate = (field: string, operation: string) => {
        updateConfig('aggregates', {
            ...aggregates,
            [field]: operation
        });
    };

    const removeAggregate = (field: string) => {
        const newAggregates = { ...aggregates };
        delete newAggregates[field];
        updateConfig('aggregates', newAggregates);
    };

    return (
        <div className="space-y-3">
            <div className="space-y-2">
                <Label>Group By Field</Label>
                <Input
                    value={keyPath}
                    onChange={(e) => updateConfig('keyPath', e.target.value)}
                    placeholder="e.g., type, storey"
                    className="text-xs"
                />
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label>Aggregations</Label>
                    <Button size="sm" onClick={addAggregate}>
                        <Plus className="h-3 w-3 mr-1" />
                        Add
                    </Button>
                </div>

                {Object.entries(aggregates).map(([field, operation]) => (
                    <div key={field} className="flex gap-2">
                        <Input
                            value={field}
                            onChange={(e) => {
                                const newAggregates = { ...aggregates };
                                delete newAggregates[field];
                                newAggregates[e.target.value] = operation;
                                updateConfig('aggregates', newAggregates);
                            }}
                            placeholder="Field name"
                            className="text-xs flex-1"
                        />
                        <Select value={operation as string} onValueChange={(value) => updateAggregate(field, value)}>
                            <SelectTrigger className="text-xs w-24">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="count">Count</SelectItem>
                                <SelectItem value="sum">Sum</SelectItem>
                                <SelectItem value="avg">Average</SelectItem>
                                <SelectItem value="min">Min</SelectItem>
                                <SelectItem value="max">Max</SelectItem>
                                <SelectItem value="first">First</SelectItem>
                                <SelectItem value="last">Last</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button size="sm" variant="ghost" onClick={() => removeAggregate(field)}>
                            <Trash2 className="h-3 w-3" />
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    );
}

function SortStepConfig({ config, updateConfig }: { config: any; updateConfig: (key: string, value: any) => void }) {
    return (
        <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
                <Label>Sort By Field</Label>
                <Input
                    value={config.keyPath || ''}
                    onChange={(e) => updateConfig('keyPath', e.target.value)}
                    placeholder="e.g., type, name"
                    className="text-xs"
                />
            </div>
            <div className="space-y-2">
                <Label>Direction</Label>
                <Select value={config.direction || 'asc'} onValueChange={(value) => updateConfig('direction', value)}>
                    <SelectTrigger className="text-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="asc">Ascending</SelectItem>
                        <SelectItem value="desc">Descending</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}

function LimitStepConfig({ config, updateConfig }: { config: any; updateConfig: (key: string, value: any) => void }) {
    return (
        <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
                <Label>Limit</Label>
                <Input
                    type="number"
                    value={config.limit || 100}
                    onChange={(e) => updateConfig('limit', parseInt(e.target.value) || 100)}
                    className="text-xs"
                />
            </div>
            <div className="space-y-2">
                <Label>Skip</Label>
                <Input
                    type="number"
                    value={config.skip || 0}
                    onChange={(e) => updateConfig('skip', parseInt(e.target.value) || 0)}
                    className="text-xs"
                />
            </div>
        </div>
    );
}

function ToMappingStepConfig({ config, updateConfig }: { config: any; updateConfig: (key: string, value: any) => void }) {
    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                    <Label>Key Path (Element ID)</Label>
                    <Input
                        value={config.keyPath || 'GlobalId'}
                        onChange={(e) => updateConfig('keyPath', e.target.value)}
                        placeholder="GlobalId"
                        className="text-xs"
                    />
                </div>
                <div className="space-y-2">
                    <Label>Value Path</Label>
                    <Input
                        value={config.valuePath || 'spaceName'}
                        onChange={(e) => updateConfig('valuePath', e.target.value)}
                        placeholder="spaceName"
                        className="text-xs"
                    />
                </div>
            </div>

            <div className="flex items-center space-x-2">
                <Switch
                    checked={config.skipEmpty !== false}
                    onCheckedChange={(checked) => updateConfig('skipEmpty', checked)}
                />
                <Label className="text-sm">Skip empty values</Label>
            </div>

            <p className="text-xs text-gray-600 dark:text-gray-400">
                Creates a mapping object suitable for Property Node's valueInput.
                Key path identifies elements, value path provides the property value.
            </p>
        </div>
    );
}

function JoinStepConfig({ config, updateConfig }: { config: any; updateConfig: (key: string, value: any) => void }) {
    return (
        <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
                <Label>Join Key Path</Label>
                <Input
                    value={config.keyPath || 'id'}
                    onChange={(e) => updateConfig('keyPath', e.target.value)}
                    placeholder="id"
                    className="text-xs"
                />
            </div>
            <div className="space-y-2">
                <Label>Join Type</Label>
                <Select value={config.joinType || 'left'} onValueChange={(value) => updateConfig('joinType', value)}>
                    <SelectTrigger className="text-xs">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="left">Left Join</SelectItem>
                        <SelectItem value="inner">Inner Join</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}

function RenameStepConfig({ config, updateConfig }: { config: any; updateConfig: (key: string, value: any) => void }) {
    const mappings = config.mappings || {};

    const addMapping = () => {
        const newMappings = {
            ...mappings,
            [`oldField${Object.keys(mappings).length + 1}`]: `newField${Object.keys(mappings).length + 1}`
        };
        updateConfig('mappings', newMappings);
    };

    const updateMapping = (oldField: string, newField: string) => {
        const newMappings = { ...mappings };
        delete newMappings[oldField];
        newMappings[oldField] = newField;
        updateConfig('mappings', newMappings);
    };

    const removeMapping = (field: string) => {
        const newMappings = { ...mappings };
        delete newMappings[field];
        updateConfig('mappings', newMappings);
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <Label>Field Renames</Label>
                <Button size="sm" onClick={addMapping}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                </Button>
            </div>

            {Object.entries(mappings).map(([oldField, newField]) => (
                <div key={oldField} className="flex gap-2">
                    <Input
                        value={oldField}
                        onChange={(e) => {
                            const newMappings = { ...mappings };
                            delete newMappings[oldField];
                            newMappings[e.target.value] = newField;
                            updateConfig('mappings', newMappings);
                        }}
                        placeholder="Old field name"
                        className="text-xs flex-1"
                    />
                    <span className="text-xs self-center">→</span>
                    <Input
                        value={newField as string}
                        onChange={(e) => updateMapping(oldField, e.target.value)}
                        placeholder="New field name"
                        className="text-xs flex-1"
                    />
                    <Button size="sm" variant="ghost" onClick={() => removeMapping(oldField)}>
                        <Trash2 className="h-3 w-3" />
                    </Button>
                </div>
            ))}
        </div>
    );
}

function getDefaultConfig(type: TransformStep['type']): Record<string, any> {
    switch (type) {
        case 'filter':
            return { conditions: [], logic: 'and' };
        case 'map':
            return { mappings: {} };
        case 'pick':
        case 'omit':
            return { fields: [] };
        case 'groupBy':
            return { keyPath: 'type', aggregates: { id: 'count' } };
        case 'sort':
            return { keyPath: 'type', direction: 'asc' };
        case 'limit':
            return { limit: 100, skip: 0 };
        case 'toMapping':
            return { keyPath: 'GlobalId', valuePath: 'spaceName', skipEmpty: true };
        case 'join':
            return { keyPath: 'id', joinType: 'left' };
        case 'rename':
            return { mappings: {} };
        default:
            return {};
    }
}
