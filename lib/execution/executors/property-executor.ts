/**
 * Property Executor
 * Handles execution of property nodes
 */

import type { NodeExecutor, IExecutionContext } from '../node-executor'
import type { Node } from 'reactflow'
import { manageProperties } from '@/lib/ifc-utils'

export class PropertyExecutor implements NodeExecutor {
  canExecute(node: Node): boolean {
    return node.type === 'propertyNode'
  }

  async execute(context: IExecutionContext): Promise<any> {
    const { node } = context
    const input = context.getInput()

    if (!input) {
      return []
    }

    const elements = Array.isArray(input) ? input : input.elements || []

    const propertyName = node.data.properties?.propertyName || ''
    const action = node.data.properties?.action || 'get'
    const propertyValue = node.data.properties?.propertyValue
    const targetPset = node.data.properties?.targetPset || 'any'

    // Handle value from input connection (for Set action)
    let valueToUse = propertyValue
    if (action === 'set' && node.data.properties?.useInputValue && input.value !== undefined) {
      valueToUse = input.value
    }

    const result = manageProperties(elements, {
      action,
      propertyName,
      propertyValue: valueToUse,
      targetPset,
    })

    // Store results in node data
    context.updateData?.({ results: result })

    return result
  }
}

