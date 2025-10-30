/**
 * Relationship Executor
 */

import type { NodeExecutor, IExecutionContext } from '../node-executor'
import type { Node } from 'reactflow'
import { queryRelationships } from '@/lib/ifc-utils'

export class RelationshipExecutor implements NodeExecutor {
  canExecute(node: Node): boolean {
    return node.type === 'relationshipNode'
  }

  async execute(context: IExecutionContext): Promise<any> {
    const { node } = context
    const input = context.getInput()

    if (!input) {
      return []
    }

    return queryRelationships(
      input,
      node.data.properties?.relationType || 'containment',
      node.data.properties?.direction || 'outgoing'
    )
  }
}

