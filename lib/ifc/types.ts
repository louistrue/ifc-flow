// Core IFC types and worker message/result types

export interface IfcElement {
  id: string;
  expressId: number;
  type: string;
  properties: Record<string, any>;
  geometry?: any;
  psets?: Record<string, any>;
  qtos?: Record<string, any>;
  propertyInfo?: {
    name: string;
    exists: boolean;
    value: any;
    psetName: string;
  };
  classifications?: Array<{
    System: string;
    Code: string;
    Description: string;
  }>;
  transformedGeometry?: {
    translation: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
  };
}

export interface IfcModel {
  id: string;
  name: string;
  file?: any;
  schema?: string;
  project?: {
    GlobalId: string;
    Name: string;
    Description: string;
  };
  elementCounts?: Record<string, number>;
  totalElements?: number;
  elements: IfcElement[];
  sqliteDb?: string;
  sqliteSuccess?: boolean;
}

export interface QuantityResults {
  groups: Record<string, number>;
  unit: string;
  total: number;
  groupBy?: string;
  error?: string;
}

export interface PropertyActions {
  action: string;
  propertyName: string;
  propertyValue?: any;
  targetPset?: string;
}

export type ProgressHandler = (progress: number, message?: string) => void;

// Worker request/response plumbing
export interface WorkerRequest<T = any> {
  action: string;
  messageId: string;
  data?: T;
}

export interface WorkerResponse<T = any> {
  type: string;
  messageId?: string;
  error?: string;
  data?: T;
  [key: string]: any;
}

export interface RequestOptions {
  timeoutMs?: number;
  transfer?: (ArrayBuffer | MessagePort | ImageBitmap)[];
  onProgress?: ProgressHandler;
}

