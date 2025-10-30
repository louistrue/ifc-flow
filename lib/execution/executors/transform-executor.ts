/**
 * Transform Executor
 */

import type { Node } from 'reactflow'
import type { NodeExecutor, IExecutionContext } from '../node-executor'
import { transformElements } from '@/lib/ifc-utils'
import { hasActiveModel, withActiveViewer } from '@/lib/ifc/viewer-manager'

export class TransformExecutor implements NodeExecutor {
  canExecute(node: Node): boolean {
    return node.type === 'transformNode'
  }

  async execute(context: IExecutionContext): Promise<any> {
    const { node } = context
    const input = context.getInput()

    if (!input) {
      return []
    }

    const translation: [number, number, number] = [
      Number.parseFloat(node.data.properties?.translateX || '0'),
      Number.parseFloat(node.data.properties?.translateY || '0'),
      Number.parseFloat(node.data.properties?.translateZ || '0'),
    ]
    const rotation: [number, number, number] = [
      Number.parseFloat(node.data.properties?.rotateX || '0'),
      Number.parseFloat(node.data.properties?.rotateY || '0'),
      Number.parseFloat(node.data.properties?.rotateZ || '0'),
    ]
    const scale: [number, number, number] = [
      Number.parseFloat(node.data.properties?.scaleX || '1'),
      Number.parseFloat(node.data.properties?.scaleY || '1'),
      Number.parseFloat(node.data.properties?.scaleZ || '1'),
    ]

    // Check if we have elements with real geometry that can be transformed in viewer
    const elements = Array.isArray(input) ? input : input.elements || []
    const elementsWithRealGeometry = elements.filter((el: any) => el.hasRealGeometry)

    if (elementsWithRealGeometry.length > 0 && hasActiveModel()) {
      const expressIds = elementsWithRealGeometry.map((el: any) => el.expressId)
      withActiveViewer(viewer => {
        viewer.applyTransform(expressIds, { translation, rotation, scale })
      })
    }

    return transformElements(input, translation, rotation, scale)
  }
}

