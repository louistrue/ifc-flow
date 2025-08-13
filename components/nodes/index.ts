import type { NodeTypes } from "reactflow"
import { IfcNode } from "./ifc-node"
import { GeometryNode } from "./geometry-node"
import { FilterNode } from "./filter-node"
import { TransformNode } from "./transform-node"
import { ViewerNode } from "./viewer-node"
import { QuantityNode } from "./quantity-node"
import { PropertyNode } from "./property-node"
import { ClassificationNode } from "./classification-node"
import { SpatialNode } from "./spatial-node"
import { ExportNode } from "./export-node"
import { RelationshipNode } from "./relationship-node"
import { AnalysisNode } from "./analysis-node"
import { WatchNode } from "./watch-node"
import { ParameterNode } from "./parameter-node"
import { PythonNode } from "./python-node"
import { DataTransformNode } from "./data-transform-node"
import { ClusterNode } from "./cluster-node"

// Define custom node types as a constant to prevent React Flow warning
export const nodeTypes: NodeTypes = {
  ifcNode: IfcNode,
  geometryNode: GeometryNode,
  filterNode: FilterNode,
  transformNode: TransformNode,
  viewerNode: ViewerNode,
  quantityNode: QuantityNode,
  propertyNode: PropertyNode,
  classificationNode: ClassificationNode,
  spatialNode: SpatialNode,
  exportNode: ExportNode,
  relationshipNode: RelationshipNode,
  analysisNode: AnalysisNode,
  watchNode: WatchNode,
  parameterNode: ParameterNode,
  pythonNode: PythonNode,
  dataTransformNode: DataTransformNode,
  clusterNode: ClusterNode,
} as const

export {
  IfcNode,
  GeometryNode,
  FilterNode,
  TransformNode,
  ViewerNode,
  DataTransformNode,
  QuantityNode,
  PropertyNode,
  ClassificationNode,
  SpatialNode,
  ExportNode,
  RelationshipNode,
  AnalysisNode,
  WatchNode,
  ParameterNode,
  PythonNode,
  ClusterNode,
}

