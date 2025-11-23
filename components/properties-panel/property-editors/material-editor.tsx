"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface MaterialEditorProps {
    properties: Record<string, any>;
    setProperties: (properties: Record<string, any>) => void;
}

const MATERIAL_CATEGORIES = [
    { value: "", label: "None" },
    { value: "concrete", label: "Concrete" },
    { value: "steel", label: "Steel" },
    { value: "aluminium", label: "Aluminium" },
    { value: "block", label: "Block" },
    { value: "brick", label: "Brick" },
    { value: "stone", label: "Stone" },
    { value: "wood", label: "Wood" },
    { value: "glass", label: "Glass" },
    { value: "gypsum", label: "Gypsum" },
    { value: "plastic", label: "Plastic" },
    { value: "earth", label: "Earth" },
    { value: "other", label: "Other" },
];

export function MaterialEditor({ properties, setProperties }: MaterialEditorProps) {
    const action = properties.action || "get";
    const useValueInput = properties.useValueInput || false;

    return (
        <div className="space-y-4">
            {/* Action Selection */}
            <div className="space-y-2">
                <Label htmlFor="action">Action</Label>
                <Select
                    value={action}
                    onValueChange={(value) =>
                        setProperties({ ...properties, action: value })
                    }
                >
                    <SelectTrigger id="action">
                        <SelectValue placeholder="Select action" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="get">Get Materials</SelectItem>
                        <SelectItem value="create">Create Material</SelectItem>
                        <SelectItem value="assign">Assign Material</SelectItem>
                    </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                    {action === "get" && "Extract material information from elements"}
                    {action === "create" && "Create a new IFC material"}
                    {action === "assign" && "Assign material to elements"}
                </p>
            </div>

            {/* Material Configuration - Show for Create and Assign */}
            {(action === "create" || action === "assign") && (
                <>
                    {/* Use Value Input Checkbox - Only for Assign */}
                    {action === "assign" && (
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="useValueInput"
                                checked={useValueInput}
                                onCheckedChange={(checked) =>
                                    setProperties({
                                        ...properties,
                                        useValueInput: checked === true,
                                    })
                                }
                            />
                            <Label
                                htmlFor="useValueInput"
                                className="text-sm font-normal cursor-pointer"
                            >
                                Use material names from input
                            </Label>
                        </div>
                    )}

                    {/* Material Name - Hide if using value input */}
                    {!useValueInput && (
                        <div className="space-y-2">
                            <Label htmlFor="materialName">Material Name</Label>
                            <Input
                                id="materialName"
                                value={properties.materialName || ""}
                                onChange={(e) =>
                                    setProperties({
                                        ...properties,
                                        materialName: e.target.value,
                                    })
                                }
                                placeholder="e.g., Concrete C30/37"
                            />
                            <p className="text-xs text-muted-foreground">
                                The name of the material
                            </p>
                        </div>
                    )}

                    {/* Material Category - Hide if using value input */}
                    {!useValueInput && (
                        <div className="space-y-2">
                            <Label htmlFor="materialCategory">Material Category</Label>
                            <Select
                                value={properties.materialCategory || ""}
                                onValueChange={(value) =>
                                    setProperties({
                                        ...properties,
                                        materialCategory: value,
                                    })
                                }
                            >
                                <SelectTrigger id="materialCategory">
                                    <SelectValue placeholder="Select category (optional)" />
                                </SelectTrigger>
                                <SelectContent>
                                    {MATERIAL_CATEGORIES.map((cat) => (
                                        <SelectItem key={cat.value} value={cat.value}>
                                            {cat.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Material category for filtering and classification
                            </p>
                        </div>
                    )}

                    {/* Material Description - Hide if using value input */}
                    {!useValueInput && (
                        <div className="space-y-2">
                            <Label htmlFor="materialDescription">
                                Description (Optional)
                            </Label>
                            <Textarea
                                id="materialDescription"
                                value={properties.materialDescription || ""}
                                onChange={(e) =>
                                    setProperties({
                                        ...properties,
                                        materialDescription: e.target.value,
                                    })
                                }
                                placeholder="Additional material information..."
                                rows={3}
                            />
                        </div>
                    )}

                    {/* Help text for value input */}
                    {useValueInput && (
                        <div className="p-3 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-md">
                            <p className="text-xs text-purple-900 dark:text-purple-100">
                                <strong>Using value from input:</strong> Connect a Property Node
                                to the top handle OR the main input to provide material names for
                                each element.
                            </p>
                        </div>
                    )}
                </>
            )}

            {/* Help text for Get action */}
            {action === "get" && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
                    <p className="text-xs text-blue-900 dark:text-blue-100">
                        This will extract material information from the connected elements
                        and pass it to downstream nodes.
                    </p>
                </div>
            )}
        </div>
    );
}
