"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { NodePropertyRenderer } from "../properties-panel/node-property-renderer";
import type { Node as ReactFlowNode } from "reactflow";

interface Node extends ReactFlowNode {
    data: {
        label: string;
        properties?: Record<string, any>;
    };
}

interface PropertiesDialogProps {
    node: Node | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
}

export function PropertiesDialog({
    node,
    open,
    onOpenChange,
    setNodes,
}: PropertiesDialogProps) {
    const [properties, setProperties] = useState<Record<string, any>>({});
    const [nodeName, setNodeName] = useState("");

    useEffect(() => {
        if (node && node.data) {
            setProperties(node.data.properties || {});
            setNodeName(node.data.label || "");
        }
    }, [node]);

    const handleApply = () => {
        if (!node) return;

        setNodes((nds) =>
            nds.map((n) => {
                if (n.id === node.id) {
                    return {
                        ...n,
                        data: {
                            ...n.data,
                            label: nodeName,
                            properties,
                        },
                    };
                }
                return n;
            })
        );
        onOpenChange(false);
    };

    const handleCancel = () => {
        if (node && node.data) {
            setProperties(node.data.properties || {});
            setNodeName(node.data.label || "");
        }
        onOpenChange(false);
    };

    if (!node) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
                <DialogHeader className="pb-2">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <DialogTitle>Properties</DialogTitle>
                            <DialogDescription>
                                Configure settings for this node.
                            </DialogDescription>
                        </div>
                        {/* Editable node name in the top-right */}
                        <div className="pt-1">
                            <Input
                                value={nodeName}
                                onChange={(e) => setNodeName(e.target.value)}
                                placeholder="Node name"
                                className="h-7 text-xs w-[240px] text-right"
                            />
                        </div>
                    </div>
                </DialogHeader>

                {/* Scrollable content */}
                <ScrollArea className="flex-1 min-h-0 overflow-auto pr-3">
                    <div className="space-y-6">
                        {/* Node-specific Properties */}
                        <section className="space-y-3">
                            <div className="text-sm font-medium">Configuration</div>
                            <div className="rounded-md border p-3">
                                <NodePropertyRenderer
                                    node={node}
                                    properties={properties}
                                    setProperties={setProperties}
                                />
                            </div>
                        </section>
                    </div>
                </ScrollArea>

                <DialogFooter className="gap-2 pt-3">
                    <Button variant="outline" onClick={handleCancel}>
                        Cancel
                    </Button>
                    <Button onClick={handleApply}>Apply Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
