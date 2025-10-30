/**
 * IFC Executor
 * Handles execution of IFC nodes
 */

import type { NodeExecutor, IExecutionContext } from '../node-executor'
import type { Node } from 'reactflow'
import { loadIfcFile, getLastLoadedModel } from '@/lib/ifc-utils'

export class IfcExecutor implements NodeExecutor {
  canExecute(node: Node): boolean {
    return node.type === 'ifcNode'
  }

  async execute(context: IExecutionContext): Promise<any> {
    const { node } = context
    
    // Priority 1: Check if node has a model (from file upload in IFC node)
    if (node.data.model) {
      return node.data.model
    }

    // Priority 2: Check for cached model info
    if (node.data.modelInfo) {
      return node.data.modelInfo
    }

    // Priority 3: Check if there's a file to load
    if (node.data.file) {
      try {
        const file = node.data.file
        const result = await loadIfcFile(file)
        // Store the result in the node data for future reference
        context.updateData({ modelInfo: result })
        return result
      } catch (err) {
        throw new Error(
          `Failed to load IFC file: ${err instanceof Error ? err.message : String(err)}`
        )
      }
    }

    // Priority 4: Check if this is an empty node from saved workflow
    if (node.data.isEmptyNode) {
      const fileName = node.data.fileName || node.data.properties?.filename || 'Unknown File'
      return {
        id: `empty-model-${Date.now()}`,
        name: `Reload Required: ${fileName}`,
        elements: [],
        errorMessage: `Please reload the IFC file: ${fileName}. Saved workflows do not include IFC file data.`,
      }
    }

    // Priority 5: Last resort - try to get the last loaded model
    const lastLoaded = getLastLoadedModel()
    if (lastLoaded) {
      context.updateData({ modelInfo: lastLoaded })
      return lastLoaded
    }

    // No model available
    return {
      id: `empty-model-${Date.now()}`,
      name: 'No IFC Data',
      elements: [],
      errorMessage: 'No IFC file loaded. Please load an IFC file first.',
    }
  }
}

