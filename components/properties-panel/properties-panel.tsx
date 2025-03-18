"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { NodePropertyRenderer } from "./node-property-renderer"

export function PropertiesPanel({ node, setNodes, setSelectedNode }) {
  const [properties, setProperties] = useState({})

  useEffect(() => {
    if (node && node.data) {
      setProperties(node.data.properties || {})
    }
  }, [node])

  const updateNodeProperties = () => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === node.id) {
          return {
            ...n,
            data: {
              ...n.data,
              properties,
            },
          }
        }
        return n
      }),
    )
  }

  if (!node) return null

  return (
    <div className="w-80 border-l bg-card">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-medium">Properties: {node.data.label}</h3>
        <Button variant="ghost" size="icon" onClick={() => setSelectedNode(null)}>
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
                        }
                      }
                      return n
                    }),
                  )
                }}
              />
            </div>
          </div>

          <Separator className="my-4" />

          <NodePropertyRenderer node={node} properties={properties} setProperties={setProperties} />

          <div className="mt-6">
            <Button onClick={updateNodeProperties} className="w-full">
              Apply Changes
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}

