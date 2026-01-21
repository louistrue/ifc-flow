"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Loader2,
  FolderOpen,
  FileBox,
  ChevronRight,
  RefreshCw,
  ArrowLeft,
  Building2,
  AlertCircle,
} from "lucide-react"
import { createDaluxClient, DaluxClient } from "@/lib/cloud-providers/dalux"
import { saveProviderToken } from "@/lib/cloud-providers/settings"
import type { CloudFile, CloudProject, CloudProviderConfig } from "@/lib/cloud-providers/types"

interface DaluxBrowserProps {
  config: NonNullable<CloudProviderConfig['dalux']>
  onFileSelected: (file: CloudFile, data: ArrayBuffer) => void
  onError: (error: Error) => void
  onCancel: () => void
}

export function DaluxBrowser({
  config,
  onFileSelected,
  onError,
  onCancel,
}: DaluxBrowserProps) {
  const [client, setClient] = useState<DaluxClient | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadingMessage, setLoadingMessage] = useState("Connecting to Dalux...")
  const [projects, setProjects] = useState<CloudProject[]>([])
  const [selectedProject, setSelectedProject] = useState<CloudProject | null>(null)
  const [files, setFiles] = useState<CloudFile[]>([])
  const [selectedFile, setSelectedFile] = useState<CloudFile | null>(null)
  const [currentPath, setCurrentPath] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  // Initialize client and authenticate
  useEffect(() => {
    const initClient = async () => {
      try {
        setIsLoading(true)
        setError(null)
        setLoadingMessage("Authenticating with Dalux...")

        const daluxClient = createDaluxClient({
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          accessToken: config.accessToken,
        })

        // Authenticate
        const authResponse = await daluxClient.authenticate()

        // Save the token for future use
        saveProviderToken('dalux', authResponse.access_token, authResponse.refresh_token)

        setClient(daluxClient)
        setLoadingMessage("Loading projects...")

        // Load projects
        const projectList = await daluxClient.listProjects()
        setProjects(projectList)
        setIsLoading(false)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to connect to Dalux"
        setError(errorMessage)
        setIsLoading(false)
        onError(new Error(errorMessage))
      }
    }

    initClient()
  }, [config, onError])

  // Load files when project is selected
  const loadProjectFiles = useCallback(async (project: CloudProject) => {
    if (!client) return

    try {
      setIsLoading(true)
      setError(null)
      setLoadingMessage("Loading models...")
      setSelectedProject(project)
      setCurrentPath([])

      // Load IFC models for the project
      const projectFiles = await client.listModels(project.id)
      setFiles(projectFiles)
      setIsLoading(false)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load files"
      setError(errorMessage)
      setIsLoading(false)
    }
  }, [client])

  // Navigate to folder
  const navigateToFolder = useCallback(async (folder: CloudFile) => {
    if (!client || !selectedProject) return

    try {
      setIsLoading(true)
      setError(null)
      setLoadingMessage("Loading folder...")

      const folderPath = [...currentPath, folder.name].join('/')
      const folderFiles = await client.listFiles(selectedProject.id, '/' + folderPath)

      setFiles(folderFiles)
      setCurrentPath([...currentPath, folder.name])
      setIsLoading(false)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load folder"
      setError(errorMessage)
      setIsLoading(false)
    }
  }, [client, selectedProject, currentPath])

  // Go back to parent folder or project list
  const goBack = useCallback(async () => {
    if (!client || !selectedProject) {
      setSelectedProject(null)
      setFiles([])
      setCurrentPath([])
      return
    }

    if (currentPath.length === 0) {
      setSelectedProject(null)
      setFiles([])
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const newPath = currentPath.slice(0, -1)
      const pathStr = newPath.length > 0 ? '/' + newPath.join('/') : '/'

      const folderFiles = await client.listFiles(selectedProject.id, pathStr)
      setFiles(folderFiles)
      setCurrentPath(newPath)
      setIsLoading(false)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to navigate"
      setError(errorMessage)
      setIsLoading(false)
    }
  }, [client, selectedProject, currentPath])

  // Download and select file
  const handleFileSelect = useCallback(async () => {
    if (!client || !selectedProject || !selectedFile) return

    try {
      setIsLoading(true)
      setError(null)

      const data = await client.downloadFile(
        selectedProject.id,
        selectedFile.id,
        (percentage, message) => {
          setLoadingMessage(`${message} (${Math.round(percentage)}%)`)
        }
      )

      onFileSelected(selectedFile, data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to download file"
      setError(errorMessage)
      setIsLoading(false)
    }
  }, [client, selectedProject, selectedFile, onFileSelected])

  // Refresh current view
  const refresh = useCallback(async () => {
    if (!client) return

    if (!selectedProject) {
      setIsLoading(true)
      setLoadingMessage("Refreshing projects...")
      try {
        const projectList = await client.listProjects()
        setProjects(projectList)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to refresh")
      }
      setIsLoading(false)
      return
    }

    loadProjectFiles(selectedProject)
  }, [client, selectedProject, loadProjectFiles])

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return ""
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{loadingMessage}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <div className="text-center space-y-2">
          <p className="text-sm font-medium text-destructive">Connection Error</p>
          <p className="text-xs text-muted-foreground max-w-sm">{error}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={refresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {selectedProject && (
            <Button variant="ghost" size="sm" onClick={goBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="flex items-center gap-1 text-sm">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Dalux</span>
            {selectedProject && (
              <>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{selectedProject.name}</span>
              </>
            )}
            {currentPath.map((folder, index) => (
              <span key={index} className="flex items-center">
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <span>{folder}</span>
              </span>
            ))}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={refresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="h-64 border rounded-md">
        {!selectedProject ? (
          // Project list
          <div className="p-2 space-y-1">
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No projects found
              </p>
            ) : (
              projects.map((project) => (
                <button
                  key={project.id}
                  className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-accent text-left transition-colors"
                  onClick={() => loadProjectFiles(project)}
                >
                  <FolderOpen className="h-5 w-5 text-amber-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{project.name}</p>
                    {project.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {project.description}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))
            )}
          </div>
        ) : (
          // File list
          <div className="p-2 space-y-1">
            {files.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No IFC models found in this project
              </p>
            ) : (
              files.map((file) => (
                <button
                  key={file.id}
                  className={`w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors ${
                    selectedFile?.id === file.id
                      ? "bg-primary/10 border border-primary/30"
                      : "hover:bg-accent"
                  }`}
                  onClick={() => {
                    if (file.isFolder) {
                      navigateToFolder(file)
                    } else {
                      setSelectedFile(file)
                    }
                  }}
                  onDoubleClick={() => {
                    if (!file.isFolder) {
                      setSelectedFile(file)
                      handleFileSelect()
                    }
                  }}
                >
                  {file.isFolder ? (
                    <FolderOpen className="h-5 w-5 text-amber-500 flex-shrink-0" />
                  ) : (
                    <FileBox className="h-5 w-5 text-blue-500 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                      {file.modifiedAt && ` • ${new Date(file.modifiedAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  {file.isFolder && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </ScrollArea>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <p className="text-xs text-muted-foreground">
          {selectedFile ? `Selected: ${selectedFile.name}` : "Select an IFC file"}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleFileSelect} disabled={!selectedFile}>
            Open
          </Button>
        </div>
      </div>
    </div>
  )
}
