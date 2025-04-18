#!/bin/bash

# List of node components to update
node_files=(
  "filter-node.tsx:FilterNodeData"
  "geometry-node.tsx:GeometryNodeData"
  "ifc-node.tsx:IfcNodeData"
  "parameter-node.tsx:ParameterNodeData"
  "property-node.tsx:PropertyNodeData"
  "quantity-node.tsx:QuantityNodeData"
  "relationship-node.tsx:RelationshipNodeData"
  "spatial-node.tsx:SpatialNodeData"
  "transform-node.tsx:TransformNodeData"
  "viewer-node.tsx:ViewerNodeData"
  "watch-node.tsx:WatchNodeData"
)

# Loop through each node file and update it
for node_entry in "${node_files[@]}"; do
  # Split the entry into file name and type name
  IFS=':' read -r file type <<< "$node_entry"
  
  echo "Updating $file with $type..."
  
  # Path to the component file
  file_path="components/nodes/$file"
  
  # Add the import statement and update the component props
  sed -i '' 's/import { Handle, Position } from "reactflow";/import { Handle, Position, type NodeProps } from "reactflow";/' "$file_path"
  sed -i '' 's/import { Handle, Position } from "reactflow"/import { Handle, Position, type NodeProps } from "reactflow"/' "$file_path"
  
  # Add import for the node type
  sed -i '' '/import.*lucide-react/a\
import { '"$type"' } from "./node-types";' "$file_path"
  
  # Update the component props
  sed -i '' 's/({ data, isConnectable })/({ data, isConnectable }: NodeProps<'"$type"'>)/' "$file_path"
  
  echo "Updated $file"
done

echo "All node components have been updated." 