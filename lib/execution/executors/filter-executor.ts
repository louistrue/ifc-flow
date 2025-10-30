/**
 * Filter Executor
 * Handles execution of filter nodes
 */

import type { NodeExecutor, IExecutionContext } from '../node-executor'
import type { Node } from 'reactflow'
import { filterElements } from '@/lib/ifc-utils'

export class FilterExecutor implements NodeExecutor {
  canExecute(node: Node): boolean {
    return node.type === 'filterNode'
  }

  async execute(context: IExecutionContext): Promise<any> {
    const { node } = context
    const input = context.getInput()

    if (!input) {
      return []
    }

    const elementsToFilter = Array.isArray(input) ? input : input.elements
    const filterType = node.data.properties?.filterType || 'property'
    const property = filterType === 'ifcClass'
      ? node.data.properties?.ifcClass || ''
      : node.data.properties?.property || ''

    return filterElements(
      elementsToFilter || [],
      property,
      node.data.properties?.operator || (filterType === 'ifcClass' ? 'contains' : 'equals'),
      node.data.properties?.value || '',
      filterType
    )
  }
}

