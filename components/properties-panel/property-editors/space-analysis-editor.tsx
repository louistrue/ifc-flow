"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Info, Home, BarChart3, Users, Route, Grid3x3 } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SpaceAnalysisEditorProps {
    properties: Record<string, any>;
    setProperties: (properties: Record<string, any>) => void;
}

export function SpaceAnalysisEditor({ properties, setProperties }: SpaceAnalysisEditorProps) {
    // Always space analysis for now
    const analysisType = "space";

    return (
        <div className="space-y-4">
            {/* Hidden analysis type - always space for now */}
            <input type="hidden" value={analysisType} />

            <>
                <div className="space-y-2">
                    <Label htmlFor="metric">Space Metric</Label>
                    <Select
                        value={properties.metric || "room_assignment"}
                        onValueChange={(value) => setProperties({ ...properties, metric: value })}
                    >
                        <SelectTrigger id="metric">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="room_assignment">
                                <div className="flex flex-col">
                                    <span className="font-medium">Room Assignment</span>
                                    <span className="text-xs text-muted-foreground">Map elements to spaces</span>
                                </div>
                            </SelectItem>
                            <SelectItem value="space_metrics">
                                <div className="flex flex-col">
                                    <span className="font-medium">Space Metrics</span>
                                    <span className="text-xs text-muted-foreground">Area, volume, occupancy</span>
                                </div>
                            </SelectItem>
                            <SelectItem value="circulation">
                                <div className="flex flex-col">
                                    <span className="font-medium">Circulation Analysis</span>
                                    <span className="text-xs text-muted-foreground">Circulation vs program space</span>
                                </div>
                            </SelectItem>
                            <SelectItem value="occupancy">
                                <div className="flex flex-col">
                                    <span className="font-medium">Occupancy Calculation</span>
                                    <span className="text-xs text-muted-foreground">Estimate space occupancy</span>
                                </div>
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3">
                    <div className="flex gap-2">
                        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                        <div className="text-xs text-blue-700 dark:text-blue-300 space-y-2">
                            <p className="font-medium">Space Analysis Features:</p>
                            <ul className="space-y-1 ml-2">
                                <li className="flex items-start gap-1">
                                    <span className="text-blue-500">•</span>
                                    <div>
                                        <strong>Room Assignment:</strong> Identifies which elements belong to which spaces using IFC spatial containment relationships (IfcRelContainedInSpatialStructure)
                                    </div>
                                </li>
                                <li className="flex items-start gap-1">
                                    <span className="text-blue-500">•</span>
                                    <div>
                                        <strong>Space Metrics:</strong> Extracts area, volume, and height from IFC quantity sets (Qto_SpaceBaseQuantities)
                                    </div>
                                </li>
                                <li className="flex items-start gap-1">
                                    <span className="text-blue-500">•</span>
                                    <div>
                                        <strong>Circulation:</strong> Categorizes spaces as circulation or program based on space types and names
                                    </div>
                                </li>
                                <li className="flex items-start gap-1">
                                    <span className="text-blue-500">•</span>
                                    <div>
                                        <strong>Occupancy:</strong> Estimates occupancy based on space type and area
                                    </div>
                                </li>
                            </ul>

                            <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                                <p className="font-medium mb-1">Workflow Example:</p>
                                <ol className="space-y-1 ml-2 text-[11px]">
                                    <li>1. IFC Node → Analysis Node (space/room_assignment)</li>
                                    <li>2. Connect output to Watch Node to view results</li>
                                    <li>3. Use Parameter Node to extract specific values</li>
                                    <li>4. Property Node to add space info to elements</li>
                                    <li>5. Export Node to save modified IFC</li>
                                </ol>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        </div>
    );
}
