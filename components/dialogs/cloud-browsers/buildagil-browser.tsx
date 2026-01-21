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
  Cloud,
  AlertCircle,
} from "lucide-react"
import { createBuildagilClient, BuildagilClient } from "@/lib/cloud-providers/buildagil"
import { saveProviderToken } from "@/lib/cloud-providers/settings"
import type { CloudFile, CloudProject, CloudProviderConfig } from "@/lib/cloud-providers/types"

interface BuildagilBrowserProps {
  config: NonNullable<CloudProviderConfig['buildagil']>
  onFileSelected: (file: CloudFile, data: ArrayBuffer) => void
  onError: (error: Error) => void
  onCancel: () => void
}

export function BuildagilBrowser({
  config,
  onFileSelected,
  onError,
  onCancel,
}: BuildagilBrowserProps) {
  const [client, setClient] = useState<BuildagilClient | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadingMessage, setLoadingMessage] = useState("Connecting to Buildagil...")
  const [projects, setProjects] = useState<CloudProject[]>([])
  const [selectedProject, setSelectedProject] = useState<CloudProject | null>(null)
  const [files, setFiles] = useState<CloudFile[]>([])
  const [selectedFile, setSelectedFile] = useState<CloudFile | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Initialize client and authenticate
  useEffect(() => {
    const initClient = async () => {
      try {
        setIsLoading(true)
        setError(null)
        setLoadingMessage("Authenticating with Buildagil...")

        const buildagilClient = createBuildagilClient({
          serverUrl: config.serverUrl,
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          accessToken: config.accessToken,
        })

        // Authenticate
        const authResponse = await buildagilClient.authenticate()

        // Save the token for future use
        saveProviderToken('buildagil', authResponse.access_token, authResponse.refresh_token)

        setClient(buildagilClient)
        setLoadingMessage("Loading projects...")

        // Load projects
        const projectList = await buildagilClient.listProjects()
        setProjects(projectList)
        setIsLoading(false)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to connect to Buildagil"
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
      setLoadingMessage("Loading documents...")
      setSelectedProject(project)

      // Load IFC files for the project
      const projectFiles = await client.listIfcFiles(project.id)
      setFiles(projectFiles)
      setIsLoading(false)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load documents"
      setError(errorMessage)
      setIsLoading(false)
    }
  }, [client])

  // Go back to project list
  const goBack = useCallback(() => {
    setSelectedProject(null)
    setFiles([])
    setSelectedFile(null)
  }, [])

  // Download and select file
  const handleFileSelect = useCallback(async () => {
    if (!client || !selectedProject || !selectedFile) return

    try {
      setIsLoading(true)
      setError(null)

      const data = await client.downloadDocument(
        selectedProject.id,
        selectedFile.id,
        (percentage, message) => {
          setLoadingMessage(`${message} (${Math.round(percentage)}%)`)
        }
      )

      onFileSelected(selectedFile, data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to download document"
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
            <Cloud className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Buildagil</span>
            {selectedProject && (
              <>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{selectedProject.name}</span>
              </>
            )}
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
                No IFC documents found in this project
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
                  onClick={() => setSelectedFile(file)}
                  onDoubleClick={() => {
                    setSelectedFile(file)
                    handleFileSelect()
                  }}
                >
                  <FileBox className="h-5 w-5 text-blue-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                      {file.modifiedAt && ` • ${new Date(file.modifiedAt).toLocaleDateString()}`}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </ScrollArea>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <p className="text-xs text-muted-foreground">
          {selectedFile ? `Selected: ${selectedFile.name}` : "Select an IFC document"}
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
