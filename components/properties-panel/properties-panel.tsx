"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NodePropertyRenderer } from "./node-property-renderer";
import { Node as ReactFlowNode } from "reactflow";

interface Node extends ReactFlowNode {
  data: {
    label: string;
    properties?: Record<string, any>;
  };
}

interface PropertiesPanelProps {
  node: Node | null;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setSelectedNode: React.Dispatch<React.SetStateAction<Node | null>>;
}

export function PropertiesPanel({
  node,
  setNodes,
  setSelectedNode,
}: PropertiesPanelProps) {
  const [properties, setProperties] = useState<Record<string, any>>({});

  // Normalize properties with defaults based on node type
  const normalizeProperties = (node: Node | null, props: Record<string, any>) => {
    if (!node) return props;

    // Apply defaults for propertyNode
    if (node.type === "propertyNode") {
      const normalized = { ...props };

      // Set default source if not present
      if (!normalized.source) {
        normalized.source = "property";
      }

      // Set default action if not present
      if (!normalized.action) {
        normalized.action = "get";
      }

      // Set default propertyName for attributes if source is attribute and propertyName is not set
      if (normalized.source === "attribute" && !normalized.propertyName) {
        normalized.propertyName = "Name";
      }

      // Set default targetPset if not present and source is property
      if (normalized.source === "property" && !normalized.targetPset) {
        normalized.targetPset = "";
      }

      return normalized;
    }

    return props;
  };

  useEffect(() => {
    if (node && node.data) {
      const normalizedProps = normalizeProperties(node, node.data.properties || {});
      setProperties(normalizedProps);
    }
  }, [node]);

  const updateNodeProperties = () => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === node?.id) {
          return {
            ...n,
            data: {
              ...n.data,
              properties,
            },
          };
        }
        return n;
      })
    );
    setSelectedNode(null);
  };

  if (!node) return null;

  return (
    <div className="w-80 border-l bg-card">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-medium">Properties: {node.data.label}</h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSelectedNode(null)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="h-[calc(100vh-120px)]">
        <div className="p-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nodeName">Node Name</Label>
              <Input
                id="nodeName"
                value={node.data.label}
                onChange={(e) => {
                  setNodes((nds) =>
                    nds.map((n) => {
                      if (n.id === node.id) {
                        return {
                          ...n,
                          data: {
                            ...n.data,
                            label: e.target.value,
                          },
                        };
                      }
                      return n;
                    })
                  );
                }}
              />
            </div>
          </div>

          <Separator className="my-4" />

          <NodePropertyRenderer
            node={node}
            properties={properties}
            setProperties={setProperties}
          />

          <div className="mt-6">
            <Button onClick={updateNodeProperties} className="w-full">
              Apply Changes
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
