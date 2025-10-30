/**
 * Analysis Executor
 */

import type { NodeExecutor, IExecutionContext } from '../node-executor'
import type { Node } from 'reactflow'
import { performAnalysis } from '@/lib/ifc/analysis-utils'
import { getLastLoadedModel } from '@/lib/ifc-utils'

export class AnalysisExecutor implements NodeExecutor {
  canExecute(node: Node): boolean {
    return node.type === 'analysisNode'
  }

  async execute(context: IExecutionContext): Promise<any> {
    const { node, nodeId } = context
    const input = context.getInput()

    if (!input) {
      return {
        error: 'No input',
        message: 'Please connect an IFC node to analyze spaces',
      }
    }

    // Find source model
    let sourceModel = null
    if (input && typeof input === 'object') {
      if (input.file && input.elements) {
        sourceModel = input
      } else if (input.model) {
        sourceModel = input.model
      } else if (Array.isArray(input) && input.length > 0 && input[0]?.model) {
        sourceModel = input[0].model
      }
    }

    if (!sourceModel) {
      sourceModel = getLastLoadedModel()
    }

    // Format elements
    let elementsToAnalyze = input
    if (!Array.isArray(elementsToAnalyze)) {
      elementsToAnalyze = elementsToAnalyze.elements || []
    }

    // Update loading state
    context.updateData?.({
      isLoading: true,
      error: null,
    })

    try {
      const onProgress = (message: string) => {
        const currentMessages = node.data.progressMessages || []
        const updatedMessages = [...currentMessages, message].slice(-6)
        context.updateData?.({
          isLoading: true,
          progressMessages: updatedMessages,
        })
      }

      const result = await performAnalysis(
        elementsToAnalyze,
        [],
        'space',
        {
          metric: node.data.properties?.metric || 'room_assignment',
          model: sourceModel,
        },
        onProgress
      )

      context.updateData?.({
        isLoading: false,
        result,
        error: null,
        progressMessages: [],
      })

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      context.updateData?.({
        isLoading: false,
        result: null,
        error: errorMessage,
        progressMessages: [],
      })
      return {
        error: errorMessage,
        message: 'Analysis failed',
      }
    }
  }
}

