/**
 * Buildagil OpenCDE API Integration
 * API Documentation: https://app.swaggerhub.com/apis-docs/buildagil/openCDE-API/1.0
 * OpenCDE Standard: https://github.com/buildingSMART/OpenCDE-API
 */

import {
  CloudFile,
  CloudProject,
  OpenCDEDocument,
  OpenCDEProject,
  OpenCDEAuthResponse,
  OpenCDEFoundationResponse,
} from './types'

export interface BuildagilConfig {
  serverUrl: string
  clientId: string
  clientSecret: string
  accessToken?: string
  refreshToken?: string
}

/**
 * OpenCDE/Buildagil API Client
 */
export class BuildagilClient {
  private config: BuildagilConfig
  private accessToken: string | null = null
  private tokenExpiry: number = 0
  private apiVersion: string = '1.0'
  private baseUrl: string

  constructor(config: BuildagilConfig) {
    this.config = config
    this.baseUrl = config.serverUrl.replace(/\/$/, '')
    this.accessToken = config.accessToken || null
  }

  /**
   * Discover the OpenCDE Foundation API and supported versions
   */
  async discoverVersions(): Promise<OpenCDEFoundationResponse> {
    const response = await fetch(`${this.baseUrl}/foundation/versions`)

    if (!response.ok) {
      throw new Error(`Failed to discover OpenCDE versions: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Authenticate with the OpenCDE server
   * Uses OAuth2 client credentials flow
   */
  async authenticate(): Promise<OpenCDEAuthResponse> {
    const response = await fetch(`${this.baseUrl}/foundation/oauth2/token`, {
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
      throw new Error(`OpenCDE authentication failed: ${errorText}`)
    }

    const data: OpenCDEAuthResponse = await response.json()
    this.accessToken = data.access_token
    this.tokenExpiry = Date.now() + data.expires_in * 1000

    return data
  }

  /**
   * Authenticate using Authorization Code flow (for browser redirects)
   */
  getAuthorizationUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: redirectUri,
      state,
      scope: 'documents:read',
    })

    return `${this.baseUrl}/foundation/oauth2/authorize?${params.toString()}`
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeAuthCode(
    code: string,
    redirectUri: string
  ): Promise<OpenCDEAuthResponse> {
    const response = await fetch(`${this.baseUrl}/foundation/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: redirectUri,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Token exchange failed: ${errorText}`)
    }

    const data: OpenCDEAuthResponse = await response.json()
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

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenCDE API error (${response.status}): ${errorText}`)
    }

    return response.json()
  }

  /**
   * List all projects
   */
  async listProjects(): Promise<CloudProject[]> {
    const response = await this.apiRequest<OpenCDEProject[]>('/bcf/3.0/projects')

    return response.map((project) => ({
      id: project.project_id,
      name: project.name,
      description: project.description,
      provider: 'buildagil' as const,
    }))
  }

  /**
   * List documents in a project
   */
  async listDocuments(projectId: string): Promise<CloudFile[]> {
    const response = await this.apiRequest<OpenCDEDocument[]>(
      `/documents/1.0/projects/${projectId}/documents`
    )

    return response.map((doc) => ({
      id: doc.id,
      name: doc.name,
      path: doc.path || doc.name,
      size: doc.size,
      modifiedAt: doc.modifiedAt,
      isFolder: false,
      downloadUrl: doc.downloadUrl,
      provider: 'buildagil' as const,
    }))
  }

  /**
   * List IFC files in a project
   */
  async listIfcFiles(projectId: string): Promise<CloudFile[]> {
    const documents = await this.listDocuments(projectId)
    return documents.filter((doc) =>
      doc.name.toLowerCase().endsWith('.ifc')
    )
  }

  /**
   * Initiate document selection (OpenCDE standard flow)
   * Returns a URL to open in a popup/iframe for document selection
   */
  async initiateDocumentSelection(
    callbackUrl: string,
    projectId?: string
  ): Promise<{ selectionUrl: string }> {
    const body: Record<string, string> = {
      callback: callbackUrl,
    }

    if (projectId) {
      body.project_id = projectId
    }

    const response = await this.apiRequest<{ url: string }>(
      '/documents/1.0/select-documents',
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    )

    return { selectionUrl: response.url }
  }

  /**
   * Get document download URL
   */
  async getDocumentDownloadUrl(
    projectId: string,
    documentId: string
  ): Promise<string> {
    const response = await this.apiRequest<{ url: string }>(
      `/documents/1.0/projects/${projectId}/documents/${documentId}/download`
    )
    return response.url
  }

  /**
   * Download a document
   */
  async downloadDocument(
    projectId: string,
    documentId: string,
    onProgress?: (percentage: number, message: string) => void
  ): Promise<ArrayBuffer> {
    onProgress?.(10, 'Getting download URL...')

    const downloadUrl = await this.getDocumentDownloadUrl(projectId, documentId)
    const headers = await this.getAuthHeader()

    onProgress?.(20, 'Downloading document...')

    const response = await fetch(downloadUrl, {
      headers,
    })

    if (!response.ok) {
      throw new Error(`Failed to download document: ${response.statusText}`)
    }

    const contentLength = response.headers.get('content-length')
    const totalBytes = contentLength ? parseInt(contentLength, 10) : 0

    if (totalBytes === 0 || !response.body) {
      onProgress?.(90, 'Processing document...')
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
      onProgress?.(Math.round(percentage), 'Downloading document...')
    }

    onProgress?.(95, 'Processing document...')

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
   * Set access token directly (e.g., from stored credentials)
   */
  setAccessToken(token: string, expiresIn: number = 3600): void {
    this.accessToken = token
    this.tokenExpiry = Date.now() + expiresIn * 1000
  }

  /**
   * Get current access token
   */
  getAccessToken(): string | null {
    return this.accessToken
  }
}

/**
 * Create a Buildagil/OpenCDE client instance
 */
export function createBuildagilClient(config: BuildagilConfig): BuildagilClient {
  return new BuildagilClient(config)
}
