/**
 * Watch Executor (pass-through)
 */

import type { NodeExecutor, IExecutionContext } from '../node-executor'
import type { Node } from 'reactflow'

export class WatchExecutor implements NodeExecutor {
  canExecute(node: Node): boolean {
    return node.type === 'watchNode'
  }

  async execute(context: IExecutionContext): Promise<any> {
    const { node } = context
    const input = context.getInput()

    // Watch nodes just pass through and display data
    const processedData = input

    // Determine input type and count
    let inputType = 'unknown'
    let itemCount = 0

    if (Array.isArray(processedData)) {
      inputType = 'array'
      itemCount = processedData.length
    } else if (processedData && typeof processedData === 'object') {
      if (processedData.elements && Array.isArray(processedData.elements)) {
        inputType = 'model'
        itemCount = processedData.elements.length
      } else if (processedData.groups && processedData.total !== undefined) {
        inputType = 'quantities'
        itemCount = Object.keys(processedData.groups).length
      } else {
        inputType = 'object'
        itemCount = Object.keys(processedData).length
      }
    } else {
      inputType = typeof processedData
    }

    context.updateData?.({
      inputData: {
        type: inputType,
        value: processedData,
        count: itemCount,
      },
    })

    return processedData
  }
}

