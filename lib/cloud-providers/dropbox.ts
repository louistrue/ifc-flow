/**
 * Dropbox Integration Service
 * Uses Dropbox Chooser for file selection
 */

import { CloudFile, CloudProviderCallbacks } from './types'

declare global {
  interface Window {
    Dropbox?: {
      choose: (options: DropboxChooserOptions) => void
      isBrowserSupported: () => boolean
    }
  }
}

interface DropboxChooserFile {
  id: string
  name: string
  link: string
  bytes: number
  icon: string
  thumbnailLink?: string
  isDir: boolean
}

interface DropboxChooserOptions {
  success: (files: DropboxChooserFile[]) => void
  cancel?: () => void
  linkType: 'preview' | 'direct'
  multiselect: boolean
  extensions?: string[]
  folderselect?: boolean
  sizeLimit?: number
}

const DROPBOX_SCRIPT_ID = 'dropboxjs'
const DROPBOX_SCRIPT_URL = 'https://www.dropbox.com/static/api/2/dropins.js'

let dropboxLoadPromise: Promise<void> | null = null

/**
 * Load the Dropbox Chooser script
 */
export async function loadDropboxScript(appKey: string): Promise<void> {
  if (dropboxLoadPromise) {
    return dropboxLoadPromise
  }

  dropboxLoadPromise = new Promise((resolve, reject) => {
    // Check if script is already loaded
    if (window.Dropbox) {
      resolve()
      return
    }

    const existingScript = document.getElementById(DROPBOX_SCRIPT_ID)
    if (existingScript) {
      // Script exists but Dropbox not ready, wait for it
      const checkInterval = setInterval(() => {
        if (window.Dropbox) {
          clearInterval(checkInterval)
          resolve()
        }
      }, 100)

      setTimeout(() => {
        clearInterval(checkInterval)
        reject(new Error('Dropbox script load timeout'))
      }, 10000)
      return
    }

    // Create and load the script
    const script = document.createElement('script')
    script.id = DROPBOX_SCRIPT_ID
    script.src = DROPBOX_SCRIPT_URL
    script.setAttribute('data-app-key', appKey)
    script.async = true

    script.onload = () => {
      // Wait for Dropbox object to be available
      const checkInterval = setInterval(() => {
        if (window.Dropbox) {
          clearInterval(checkInterval)
          resolve()
        }
      }, 100)

      setTimeout(() => {
        clearInterval(checkInterval)
        reject(new Error('Dropbox object not available after script load'))
      }, 5000)
    }

    script.onerror = () => {
      dropboxLoadPromise = null
      reject(new Error('Failed to load Dropbox script'))
    }

    document.head.appendChild(script)
  })

  return dropboxLoadPromise
}

/**
 * Check if Dropbox Chooser is available
 */
export function isDropboxAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.Dropbox?.isBrowserSupported?.()
}

/**
 * Open the Dropbox Chooser to select IFC files
 */
export function openDropboxChooser(
  appKey: string,
  callbacks: CloudProviderCallbacks
): void {
  loadDropboxScript(appKey)
    .then(() => {
      if (!window.Dropbox) {
        callbacks.onError(new Error('Dropbox Chooser not available'))
        return
      }

      window.Dropbox.choose({
        success: async (files: DropboxChooserFile[]) => {
          if (files.length === 0) {
            callbacks.onError(new Error('No file selected'))
            return
          }

          const file = files[0]
          callbacks.onProgress?.(10, 'Downloading from Dropbox...')

          try {
            // Download the file
            const response = await fetch(file.link)
            if (!response.ok) {
              throw new Error(`Failed to download file: ${response.statusText}`)
            }

            callbacks.onProgress?.(50, 'Processing file...')
            const arrayBuffer = await response.arrayBuffer()

            const cloudFile: CloudFile = {
              id: file.id,
              name: file.name,
              path: file.name,
              size: file.bytes,
              isFolder: false,
              downloadUrl: file.link,
              thumbnailUrl: file.thumbnailLink,
              provider: 'dropbox',
            }

            callbacks.onProgress?.(100, 'File ready')
            callbacks.onFileSelected(cloudFile, arrayBuffer)
          } catch (error) {
            callbacks.onError(
              error instanceof Error ? error : new Error('Failed to download file')
            )
          }
        },
        cancel: () => {
          // User cancelled, no error needed
        },
        linkType: 'direct',
        multiselect: false,
        extensions: ['.ifc'],
        sizeLimit: 100 * 1024 * 1024, // 100MB limit
      })
    })
    .catch((error) => {
      callbacks.onError(error)
    })
}

/**
 * Convert Dropbox file to CloudFile
 */
export function dropboxFileToCloudFile(file: DropboxChooserFile): CloudFile {
  return {
    id: file.id,
    name: file.name,
    path: file.name,
    size: file.bytes,
    isFolder: file.isDir,
    downloadUrl: file.link,
    thumbnailUrl: file.thumbnailLink,
    provider: 'dropbox',
  }
}
