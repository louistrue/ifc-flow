/**
 * Export Executor
 */

import type { NodeExecutor, IExecutionContext } from '../node-executor'
import type { Node } from 'reactflow'
import { exportData, downloadExportedFile } from '@/lib/ifc-utils'

export class ExportExecutor implements NodeExecutor {
  canExecute(node: Node): boolean {
    return node.type === 'exportNode'
  }

  async execute(context: IExecutionContext): Promise<any> {
    const { node } = context
    const input = context.getInput()

    if (!input) {
      return { error: 'No input data to export' }
    }

    const format = node.data.properties?.format || 'csv'
    const fileName = node.data.properties?.fileName || 'export'

    try {
      // For GLB export, may need to extract geometry first
      if (format === 'glb') {
        // Geometry extraction would happen here if needed
      }

      const exportedData = await exportData(input, format, fileName)

      // Download file if not IFC (IFC uses event dispatch)
      if (format !== 'ifc' && exportedData) {
        if (format === 'excel' || format === 'glb') {
          await downloadExportedFile(exportedData as ArrayBuffer, fileName, format)
        } else {
          await downloadExportedFile(exportedData as string, fileName, format)
        }
      }

      context.updateData?.({
        exported: true,
        exportFormat: format,
        exportFileName: fileName,
      })

      return { success: true, format, fileName }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      context.updateData?.({
        error: errorMessage,
      })
      return { error: errorMessage }
    }
  }
}

