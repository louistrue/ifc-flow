/**
 * Geometry Executor
 * Handles execution of geometry nodes
 */

import type { NodeExecutor, IExecutionContext } from '../node-executor'
import type { Node } from 'reactflow'
import { extractGeometry, extractGeometryWithGeom } from '@/lib/ifc-utils'
import { hasActiveModel, withActiveViewer } from '@/lib/ifc/viewer-manager'

export class GeometryExecutor implements NodeExecutor {
  canExecute(node: Node): boolean {
    return node.type === 'geometryNode'
  }

  async execute(context: IExecutionContext): Promise<any> {
    const { node, nodeId } = context
    const input = context.getInput()

    // Check if we should use actual geometry
    const hasDownstreamGLB = context.hasDownstreamGLBExport?.(nodeId) || false
    const hasDownstreamViewer = context.hasDownstreamViewer?.(nodeId) || false
    const needsActualGeometry = 
      node.data.properties?.useActualGeometry || 
      hasDownstreamGLB || 
      hasDownstreamViewer
    const hasViewerModel = hasActiveModel()

    // Update node with viewer status
    let viewerElementCount = 0
    if (hasViewerModel) {
      viewerElementCount = withActiveViewer(viewer => viewer.getElementCount()) || 0
    }

    context.updateData?.({
      hasRealGeometry: needsActualGeometry && hasViewerModel,
      viewerElementCount,
    })

    if (needsActualGeometry && hasViewerModel) {
      // Use viewer-backed geometry (would need viewer integration)
      // For now, fall back to worker extraction
      return this.executeWithWorker(node, input)
    } else if (needsActualGeometry && !hasViewerModel) {
      // Fallback to worker-based geometry extraction
      return this.executeWithWorker(node, input)
    } else {
      // Use simple extraction method
      const result = extractGeometry(
        input,
        node.data.properties?.elementType || 'all',
        node.data.properties?.includeOpenings !== 'false'
      )

      // Mark elements as having no real geometry
      return Array.isArray(result)
        ? result.map(element => ({
            ...element,
            hasRealGeometry: false,
          }))
        : result
    }
  }

  private async executeWithWorker(node: Node, input: any): Promise<any> {
    // This would call extractGeometryWithGeom
    // For now, fall back to simple extraction
    return extractGeometry(
      input,
      node.data.properties?.elementType || 'all',
      node.data.properties?.includeOpenings !== 'false'
    )
  }
}

