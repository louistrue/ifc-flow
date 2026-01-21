/**
 * Cloud Provider Types for Model Loading
 * Supports Dropbox, Dalux, and Buildagil (OpenCDE) integrations
 */

export type CloudProviderType = 'dropbox' | 'dalux' | 'buildagil'

export interface CloudFile {
  id: string
  name: string
  path: string
  size?: number
  modifiedAt?: string
  isFolder: boolean
  thumbnailUrl?: string
  downloadUrl?: string
  provider: CloudProviderType
}

export interface CloudProject {
  id: string
  name: string
  description?: string
  thumbnailUrl?: string
  provider: CloudProviderType
}

export interface CloudProviderConfig {
  dropbox?: {
    appKey: string
  }
  dalux?: {
    apiUrl: string
    clientId: string
    clientSecret: string
    accessToken?: string
    refreshToken?: string
  }
  buildagil?: {
    serverUrl: string
    clientId: string
    clientSecret: string
    accessToken?: string
    refreshToken?: string
  }
}

export interface CloudProviderState {
  isAuthenticated: boolean
  isLoading: boolean
  error?: string
  currentProject?: CloudProject
  currentPath?: string
  files?: CloudFile[]
  projects?: CloudProject[]
}

export interface CloudProviderCallbacks {
  onFileSelected: (file: CloudFile, fileData: ArrayBuffer) => void
  onError: (error: Error) => void
  onProgress?: (percentage: number, message: string) => void
}

// Dalux API Types
export interface DaluxProject {
  id: string
  name: string
  description?: string
  createdAt?: string
  modifiedAt?: string
}

export interface DaluxFile {
  id: string
  name: string
  path: string
  size: number
  createdAt: string
  modifiedAt: string
  mimeType: string
  downloadUrl?: string
}

export interface DaluxAuthResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

// OpenCDE (Buildagil) API Types
export interface OpenCDEDocument {
  id: string
  guid?: string
  name: string
  description?: string
  path: string
  size?: number
  createdAt?: string
  modifiedAt?: string
  version?: string
  downloadUrl?: string
}

export interface OpenCDEProject {
  project_id: string
  name: string
  description?: string
}

export interface OpenCDEAuthResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
}

// Foundation API (OpenCDE standard)
export interface OpenCDEVersion {
  version_id: string
  detailed_version?: string
  api_base_url?: string
}

export interface OpenCDEFoundationResponse {
  versions: OpenCDEVersion[]
}
