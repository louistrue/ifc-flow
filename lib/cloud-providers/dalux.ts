/**
 * Dalux Build API Integration
 * API Documentation: https://app.swaggerhub.com/apis-docs/Dalux/DaluxBuild-api/
 */

import {
  CloudFile,
  CloudProject,
  DaluxProject,
  DaluxFile,
  DaluxAuthResponse,
} from './types'

const DALUX_API_BASE = 'https://api.dalux.com/build/v1'
const DALUX_AUTH_URL = 'https://api.dalux.com/oauth/token'

export interface DaluxConfig {
  clientId: string
  clientSecret: string
  accessToken?: string
  refreshToken?: string
}

/**
 * Dalux API Client
 */
export class DaluxClient {
  private config: DaluxConfig
  private accessToken: string | null = null
  private tokenExpiry: number = 0

  constructor(config: DaluxConfig) {
    this.config = config
    this.accessToken = config.accessToken || null
  }

  /**
   * Authenticate with Dalux API using client credentials
   */
  async authenticate(): Promise<DaluxAuthResponse> {
    const response = await fetch(DALUX_AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Dalux authentication failed: ${errorText}`)
    }

    const data: DaluxAuthResponse = await response.json()
    this.accessToken = data.access_token
    this.tokenExpiry = Date.now() + data.expires_in * 1000

    return data
  }

  /**
   * Get authorization header
   */
  private async getAuthHeader(): Promise<Record<string, string>> {
    if (!this.accessToken || Date.now() >= this.tokenExpiry - 60000) {
      await this.authenticate()
    }
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    }
  }

  /**
   * Make an authenticated API request
   */
  private async apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers = await this.getAuthHeader()

    const response = await fetch(`${DALUX_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Dalux API error (${response.status}): ${errorText}`)
    }

    return response.json()
  }

  /**
   * List all projects
   */
  async listProjects(): Promise<CloudProject[]> {
    const projects = await this.apiRequest<DaluxProject[]>('/projects')

    return projects.map((project) => ({
      id: project.id,
      name: project.name,
      description: project.description,
      provider: 'dalux' as const,
    }))
  }

  /**
   * List files in a project
   */
  async listFiles(projectId: string, path: string = '/'): Promise<CloudFile[]> {
    const endpoint = `/projects/${projectId}/files?path=${encodeURIComponent(path)}`
    const files = await this.apiRequest<DaluxFile[]>(endpoint)

    return files.map((file) => ({
      id: file.id,
      name: file.name,
      path: file.path,
      size: file.size,
      modifiedAt: file.modifiedAt,
      isFolder: file.mimeType === 'application/folder',
      provider: 'dalux' as const,
    }))
  }

  /**
   * List IFC models in a project
   */
  async listModels(projectId: string): Promise<CloudFile[]> {
    const endpoint = `/projects/${projectId}/models`
    const models = await this.apiRequest<DaluxFile[]>(endpoint)

    return models
      .filter((file) => file.name.toLowerCase().endsWith('.ifc'))
      .map((file) => ({
        id: file.id,
        name: file.name,
        path: file.path,
        size: file.size,
        modifiedAt: file.modifiedAt,
        isFolder: false,
        provider: 'dalux' as const,
      }))
  }

  /**
   * Download a file
   */
  async downloadFile(
    projectId: string,
    fileId: string,
    onProgress?: (percentage: number, message: string) => void
  ): Promise<ArrayBuffer> {
    onProgress?.(10, 'Getting download URL...')

    const headers = await this.getAuthHeader()

    // Get download URL
    const downloadInfo = await this.apiRequest<{ url: string }>(
      `/projects/${projectId}/files/${fileId}/download`
    )

    onProgress?.(20, 'Downloading file...')

    // Download the file
    const response = await fetch(downloadInfo.url, {
      headers,
    })

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`)
    }

    // Get content length for progress tracking
    const contentLength = response.headers.get('content-length')
    const totalBytes = contentLength ? parseInt(contentLength, 10) : 0

    if (totalBytes === 0 || !response.body) {
      onProgress?.(90, 'Processing file...')
      return response.arrayBuffer()
    }

    // Stream the download with progress
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let receivedBytes = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      chunks.push(value)
      receivedBytes += value.length

      const percentage = 20 + (receivedBytes / totalBytes) * 70
      onProgress?.(Math.round(percentage), 'Downloading file...')
    }

    onProgress?.(95, 'Processing file...')

    // Combine chunks
    const allChunks = new Uint8Array(receivedBytes)
    let position = 0
    for (const chunk of chunks) {
      allChunks.set(chunk, position)
      position += chunk.length
    }

    onProgress?.(100, 'Download complete')
    return allChunks.buffer
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return !!this.accessToken && Date.now() < this.tokenExpiry
  }

  /**
   * Get current access token
   */
  getAccessToken(): string | null {
    return this.accessToken
  }
}

/**
 * Create a Dalux client instance
 */
export function createDaluxClient(config: DaluxConfig): DaluxClient {
  return new DaluxClient(config)
}
