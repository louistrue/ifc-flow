/**
 * Quantity Executor
 * Handles execution of quantity nodes
 */

import type { NodeExecutor, IExecutionContext } from '../node-executor'
import type { Node } from 'reactflow'
import { extractQuantities, type IfcModel } from '@/lib/ifc-utils'

export class QuantityExecutor implements NodeExecutor {
  canExecute(node: Node): boolean {
    return node.type === 'quantityNode'
  }

  async execute(context: IExecutionContext): Promise<any> {
    const { node, nodeId } = context
    const input = context.getInput()

    if (!input) {
      return {
        groups: { Error: 0 },
        unit: '',
        total: 0,
        error: 'No input data available',
      }
    }

    const modelInput = input as IfcModel

    if (!modelInput || !modelInput.elements || !modelInput.name) {
      return {
        groups: { 'Invalid Model': 0 },
        unit: '',
        total: 0,
        error: 'Invalid input model',
      }
    }

    try {
      const quantityType = node.data.properties?.quantityType || 'area'
      const groupBy = node.data.properties?.groupBy || 'none'
      const ignoreUnknownRefs = node.data.properties?.ignoreUnknownRefs || false

      // Update node data
      context.updateData?.({
        properties: {
          ...node.data.properties,
          quantityType,
          groupBy,
          ignoreUnknownRefs,
        },
      })

      // Extract quantities with progress callback
      const result = await extractQuantities(
        modelInput,
        quantityType,
        groupBy,
        undefined, // onProgress
        (messageId: string) => {
          context.updateData?.({ messageId })
        }
      )

      return result
    } catch (error) {
      return {
        groups: { Error: 0 },
        unit: '',
        total: 0,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
}

