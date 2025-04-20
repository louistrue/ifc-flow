"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { Move } from "lucide-react";
import { TransformNodeData } from "./node-types";

interface Geometry {
  vertices: number[][];
  placement?: {
    position?: number[];
    rotation?: number[];
    scale?: number[];
    [key: string]: any;
  };
  [key: string]: any;
}

interface Transform {
  translation?: number[];
  rotation?: number[];
  scale?: number[];
}

// Extend the base TransformNodeData with additional properties
interface ExtendedTransformNodeData extends TransformNodeData {
  geometry?: Geometry;
  transformedGeometry?: Geometry;
}

function applyTransformation(geometry: Geometry, transform: Transform): Geometry {
  if (!geometry || !transform) return geometry;

  const {
    translation = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = [1, 1, 1],
  } = transform;

  // Create a deep copy of geometry to avoid mutating original
  const transformedGeometry = JSON.parse(JSON.stringify(geometry));

  // Convert rotation from degrees to radians
  const rotRad = rotation.map((deg) => (deg * Math.PI) / 180);

  // Apply transformation to each vertex
  transformedGeometry.vertices = geometry.vertices.map((vertex) => {
    // First apply scale
    let [x, y, z] = vertex.map((v, i) => v * scale[i]);

    // Apply rotation (Z, Y, X order)
    // Z rotation
    let tempX = x * Math.cos(rotRad[2]) - y * Math.sin(rotRad[2]);
    let tempY = x * Math.sin(rotRad[2]) + y * Math.cos(rotRad[2]);
    x = tempX;
    y = tempY;

    // Y rotation
    tempX = x * Math.cos(rotRad[1]) + z * Math.sin(rotRad[1]);
    let tempZ = -x * Math.sin(rotRad[1]) + z * Math.cos(rotRad[1]);
    x = tempX;
    z = tempZ;

    // X rotation
    tempY = y * Math.cos(rotRad[0]) - z * Math.sin(rotRad[0]);
    tempZ = y * Math.sin(rotRad[0]) + z * Math.cos(rotRad[0]);
    y = tempY;
    z = tempZ;

    // Apply translation
    return [x + translation[0], y + translation[1], z + translation[2]];
  });

  // Update placement to reflect the transformation
  if (transformedGeometry.placement) {
    const currentPos = transformedGeometry.placement.position || [0, 0, 0];
    const currentRot = transformedGeometry.placement.rotation || [0, 0, 0];
    const currentScale = transformedGeometry.placement.scale || [1, 1, 1];

    transformedGeometry.placement = {
      ...transformedGeometry.placement,
      position: [
        currentPos[0] + translation[0],
        currentPos[1] + translation[1],
        currentPos[2] + translation[2],
      ],
      rotation: [
        currentRot[0] + (rotation[0] * Math.PI) / 180,
        currentRot[1] + (rotation[1] * Math.PI) / 180,
        currentRot[2] + (rotation[2] * Math.PI) / 180,
      ],
      scale: [
        currentScale[0] * scale[0],
        currentScale[1] * scale[1],
        currentScale[2] * scale[2],
      ],
    };
  }

  return transformedGeometry;
}

export const TransformNode = memo(({ data, isConnectable }: NodeProps<TransformNodeData>) => {
  // Apply transformation when data changes
  if (data.geometry) {
    const transform = {
      translation: [
        parseFloat(data.properties?.translateX) || 0,
        parseFloat(data.properties?.translateY) || 0,
        parseFloat(data.properties?.translateZ) || 0,
      ],
      rotation: [
        parseFloat(data.properties?.rotateX) || 0,
        parseFloat(data.properties?.rotateY) || 0,
        parseFloat(data.properties?.rotateZ) || 0,
      ],
      scale: [1, 1, 1], // Default scale
    };
    data.transformedGeometry = applyTransformation(data.geometry, transform);
  }

  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-orange-500 dark:border-orange-400 rounded-md w-48 shadow-md">
      <div className="bg-orange-500 text-white px-3 py-1 flex items-center gap-2">
        <Move className="h-4 w-4" />
        <div className="text-sm font-medium truncate">{data.label}</div>
      </div>
      <div className="p-3 text-xs">
        <div className="grid grid-cols-3 gap-1 mb-1">
          <div className="text-center">
            <span className="block text-muted-foreground">Tx</span>
            <span>{data.properties?.translateX || "0"}</span>
          </div>
          <div className="text-center">
            <span className="block text-muted-foreground">Ty</span>
            <span>{data.properties?.translateY || "0"}</span>
          </div>
          <div className="text-center">
            <span className="block text-muted-foreground">Tz</span>
            <span>{data.properties?.translateZ || "0"}</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1">
          <div className="text-center">
            <span className="block text-muted-foreground">Rx</span>
            <span>{data.properties?.rotateX || "0"}°</span>
          </div>
          <div className="text-center">
            <span className="block text-muted-foreground">Ry</span>
            <span>{data.properties?.rotateY || "0"}°</span>
          </div>
          <div className="text-center">
            <span className="block text-muted-foreground">Rz</span>
            <span>{data.properties?.rotateZ || "0"}°</span>
          </div>
        </div>
      </div>
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        style={{ background: "#555", width: 8, height: 8 }}
        isConnectable={isConnectable}
      />
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

TransformNode.displayName = "TransformNode";
