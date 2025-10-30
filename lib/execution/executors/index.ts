/**
 * Executor Index
 * Registers all executors with the registry
 */

import { executorRegistry } from '../executor-registry'
import { IfcExecutor } from './ifc-executor'
import { GeometryExecutor } from './geometry-executor'
import { QuantityExecutor } from './quantity-executor'
import { PropertyExecutor } from './property-executor'
import { FilterExecutor } from './filter-executor'
import { AnalysisExecutor } from './analysis-executor'
import { PythonExecutor } from './python-executor'
import { TransformExecutor } from './transform-executor'
import { ClusterExecutor } from './cluster-executor'
import { ExportExecutor } from './export-executor'
import { WatchExecutor } from './watch-executor'
import { ViewerExecutor } from './viewer-executor'
import { AiExecutor } from './ai-executor'
import { ClassificationExecutor } from './classification-executor'
import { SpatialExecutor } from './spatial-executor'
import { RelationshipExecutor } from './relationship-executor'
import { ParameterExecutor } from './parameter-executor'
import { DataTransformExecutor } from './data-transform-executor'

// Register all executors
export function registerAllExecutors() {
  executorRegistry.register('ifcNode', new IfcExecutor())
  executorRegistry.register('geometryNode', new GeometryExecutor())
  executorRegistry.register('quantityNode', new QuantityExecutor())
  executorRegistry.register('propertyNode', new PropertyExecutor())
  executorRegistry.register('filterNode', new FilterExecutor())
  executorRegistry.register('analysisNode', new AnalysisExecutor())
  executorRegistry.register('pythonNode', new PythonExecutor())
  executorRegistry.register('transformNode', new TransformExecutor())
  executorRegistry.register('clusterNode', new ClusterExecutor())
  executorRegistry.register('exportNode', new ExportExecutor())
  executorRegistry.register('watchNode', new WatchExecutor())
  executorRegistry.register('viewerNode', new ViewerExecutor())
  executorRegistry.register('aiNode', new AiExecutor())
  executorRegistry.register('classificationNode', new ClassificationExecutor())
  executorRegistry.register('spatialNode', new SpatialExecutor())
  executorRegistry.register('relationshipNode', new RelationshipExecutor())
  executorRegistry.register('parameterNode', new ParameterExecutor())
  executorRegistry.register('dataTransformNode', new DataTransformExecutor())
}

// Auto-register on import
registerAllExecutors()

