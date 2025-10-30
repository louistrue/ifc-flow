/**
 * IfcApi - Single Entry Point for All IFC Operations
 * Provides a clean, unified API for IFC operations
 */

import { getIfcWorkerClient } from '../client/ifc-worker-client'
import type { IfcWorkerClient } from '../client/ifc-worker-client'
import { 
  filterElements, 
  transformElements, 
  extractGeometry 
} from '../operations/element-operations'
import { 
  manageProperties, 
  manageClassifications 
} from '../operations/property-operations'
import { 
  exportData, 
  downloadExportedFile 
} from '../operations/export-manager'
import type { IfcModel, IfcElement } from '@/lib/ifc-utils'
// type ProgressCallback = (progress: number, message?: string) => void

export type ExportFormat = 'csv' | 'json' | 'excel' | 'glb' | 'ifc'

export class IfcApi {
  private workerClient: IfcWorkerClient

  constructor() {
    this.workerClient = getIfcWorkerClient()
  }

  // File operations
  async loadFile(file: File, onProgress?: (progress: number, message?: string) => void): Promise<IfcModel> {
    return this.workerClient.loadIfc(file, onProgress)
  }

  // Element operations
  filter(
    elements: IfcElement[], 
    property: string,
    operator: string,
    value: string,
    filterType: 'property' | 'ifcClass' = 'property'
  ): IfcElement[] {
    return filterElements(elements, property, operator, value, filterType)
  }

  transform(
    elements: IfcElement[],
    translation: [number, number, number] = [0, 0, 0],
    rotation: [number, number, number] = [0, 0, 0],
    scale: [number, number, number] = [1, 1, 1]
  ): IfcElement[] {
    return transformElements(elements, translation, rotation, scale)
  }

  extractGeometry(
    model: IfcModel,
    elementType: string = 'all',
    includeOpenings: boolean = true
  ): IfcElement[] {
    return extractGeometry(model, elementType, includeOpenings)
  }

  async extractGeometryWithWorker(
    model: IfcModel,
    options: { elementType?: string; includeOpenings?: boolean } = {},
    onProgress?: (progress: number, message?: string) => void
  ): Promise<IfcElement[]> {
    return this.workerClient.extractGeometry(model, options, onProgress)
  }

  // Property operations
  manageProperties(
    elements: IfcElement[],
    options: {
      action: 'get' | 'set' | 'remove'
      propertyName: string
      propertyValue?: any
      targetPset?: string
      mapping?: Record<string, any>
    }
  ): IfcElement[] {
    return manageProperties(elements, options)
  }

  manageClassifications(
    elements: IfcElement[],
    system: string = 'uniclass',
    action: 'get' | 'set' = 'get',
    code: string = ''
  ): IfcElement[] {
    return manageClassifications(elements, system, action, code)
  }

  // Geometry operations
  // (Already covered above)

  // Export operations
  async export(
    data: any,
    format: ExportFormat,
    fileName: string = 'export'
  ): Promise<string | ArrayBuffer | void> {
    return exportData(data, format, fileName)
  }

  async downloadExportedFile(
    data: string | ArrayBuffer,
    format: string,
    fileName: string
  ): Promise<void> {
    downloadExportedFile(data, format, fileName)
  }

  // SQLite operations
  async querySqlite(model: IfcModel, query: string): Promise<any[]> {
    return this.workerClient.querySqlite(model, query)
  }

  async warmSqlite(model: IfcModel): Promise<{ tableCount: number }> {
    return this.workerClient.warmSqlite(model)
  }

  async exportSqlite(model: IfcModel): Promise<Uint8Array> {
    return this.workerClient.exportSqlite(model)
  }

  // Python operations
  async runPython(
    script: string,
    model: IfcModel | null,
    inputData?: any,
    properties?: Record<string, any>,
    onProgress?: (progress: number, message?: string) => void
  ): Promise<any> {
    return this.workerClient.runPython(script, model, inputData, properties, onProgress)
  }

  // Cleanup
  terminate(): void {
    this.workerClient.terminate()
  }
}

// Singleton instance
let apiInstance: IfcApi | null = null

export function getIfcApi(): IfcApi {
  if (!apiInstance) {
    apiInstance = new IfcApi()
  }
  return apiInstance
}

