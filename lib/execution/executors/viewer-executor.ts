/**
 * Viewer Executor
 */

import type { NodeExecutor, IExecutionContext } from '../node-executor'
import type { Node } from 'reactflow'

export class ViewerExecutor implements NodeExecutor {
  canExecute(node: Node): boolean {
    return node.type === 'viewerNode'
  }

  async execute(context: IExecutionContext): Promise<any> {
    const { node } = context
    const input = context.getInput()

    // Viewer nodes mainly handle 3D visualization
    // Execution is handled by the viewer component itself
    // This executor just passes through the data
    
    context.updateData?.({
      modelData: input,
    })

    return input
  }
}

