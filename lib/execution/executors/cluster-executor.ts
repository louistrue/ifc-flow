/**
 * Cluster Executor
 */

import type { Node } from 'reactflow'
import type { NodeExecutor, IExecutionContext } from '../node-executor'
import { buildClustersFromElements, applyClusterColors } from '@/lib/ifc/cluster-utils'

export class ClusterExecutor implements NodeExecutor {
  canExecute(node: Node): boolean {
    return node.type === 'clusterNode'
  }

  async execute(context: IExecutionContext): Promise<any> {
    const { node } = context
    const input = context.getInput()

    if (!input) {
      return []
    }

    const elements = Array.isArray(input) ? input : input.elements || []
    const config = {
      groupBy: (node.data.properties?.groupBy || 'type') as 'type' | 'level' | 'material' | 'property',
      property: node.data.properties?.property,
      pset: node.data.properties?.pset,
    }

    const result = buildClustersFromElements(elements, config)

    context.updateData?.({
      clusters: result?.clusters || [],
      clusterStats: result?.stats || { totalClusters: 0, totalElements: 0, visibleClusters: 0 },
    })

    // Return elements with cluster information
    return elements
  }
}

