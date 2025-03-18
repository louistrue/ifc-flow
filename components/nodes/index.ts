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

// Define custom node types
export const nodeTypes = {
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
}

export {
  IfcNode,
  GeometryNode,
  FilterNode,
  TransformNode,
  ViewerNode,
  QuantityNode,
  PropertyNode,
  ClassificationNode,
  SpatialNode,
  ExportNode,
  RelationshipNode,
  AnalysisNode,
  WatchNode,
  ParameterNode,
}

