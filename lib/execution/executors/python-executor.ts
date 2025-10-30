/**
 * Python Executor
 */

import type { NodeExecutor, IExecutionContext } from '../node-executor'
import type { Node } from 'reactflow'
import { runPythonScript, getLastLoadedModel, type IfcModel } from '@/lib/ifc-utils'

export class PythonExecutor implements NodeExecutor {
  canExecute(node: Node): boolean {
    return node.type === 'pythonNode'
  }

  async execute(context: IExecutionContext): Promise<any> {
    const { node, nodeId } = context
    const input = context.getInput()

    // Get model
    let model: IfcModel | null = null
    if (input && input.name && input.elements) {
      model = input as IfcModel
    } else {
      model = getLastLoadedModel()
    }

    context.updateData?.({
      isLoading: true,
      progress: { percentage: 5, message: 'Running Python...' },
      error: null,
    })

    try {
      const code = node.data.properties?.code || '# No code provided\nresult = None'
      const result = await runPythonScript(
        model || null,
        code,
        (percentage, message) => {
          context.updateData?.({
            isLoading: true,
            progress: { percentage, message: message || 'Processing' },
          })
        },
        input // Pass input data
      )

      context.updateData?.({
        isLoading: false,
        result,
        error: null,
        progress: { percentage: 100, message: 'Complete' },
      })

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      context.updateData?.({
        isLoading: false,
        result: null,
        error: errorMessage,
        progress: { percentage: 0, message: 'Error' },
      })
      throw error
    }
  }
}

