"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useCloudProviderSettings } from "@/hooks/use-cloud-provider-settings"
import {
  Folder,
  File,
  ChevronRight,
  ChevronDown,
  ArrowUp,
  Loader2,
  RefreshCw,
} from "lucide-react"
import { cn } from "@/lib/utils"

export interface CloudFile {
  id: string
  name: string
  path: string
  isFolder: boolean
  downloadUrl: string
  size?: number
  modified?: string
}

interface CloudFileBrowserProps {
  provider: "dropbox" | "dalux"
  onFileSelect: (file: CloudFile) => void
}

export function CloudFileBrowser({ provider, onFileSelect }: CloudFileBrowserProps) {
  const { settings } = useCloudProviderSettings()
  const [currentPath, setCurrentPath] = useState("/")
  const [files, setFiles] = useState<CloudFile[]>([])
  const [selectedFile, setSelectedFile] = useState<CloudFile | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  const fetchFiles = useCallback(
    async (path: string) => {
      setIsLoading(true)
      setError(null)

      try {
        // Simulated API call - in production this would call actual cloud APIs
        if (provider === "dropbox" && settings.dropbox?.appKey) {
          // Dropbox API integration would go here
          const response = await fetch("/api/cloud/dropbox/list", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              appKey: settings.dropbox.appKey,
              path,
            }),
          })

          if (!response.ok) {
            throw new Error("Failed to fetch Dropbox files")
          }

          const data = await response.json()
          setFiles(data.files || [])
        } else if (provider === "dalux" && settings.dalux?.apiKey) {
          // Dalux API integration would go here
          const response = await fetch("/api/cloud/dalux/list", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              apiKey: settings.dalux.apiKey,
              projectId: settings.dalux.projectId,
              path,
            }),
          })

          if (!response.ok) {
            throw new Error("Failed to fetch Dalux files")
          }

          const data = await response.json()
          setFiles(data.files || [])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch files")
        setFiles([])
      } finally {
        setIsLoading(false)
      }
    },
    [provider, settings]
  )

  const handleNavigate = useCallback(
    (folder: CloudFile) => {
      if (folder.isFolder) {
        setCurrentPath(folder.path)
        setSelectedFile(null)
        fetchFiles(folder.path)
      }
    },
    [fetchFiles]
  )

  const handleNavigateUp = useCallback(() => {
    const parentPath = currentPath.split("/").slice(0, -1).join("/") || "/"
    setCurrentPath(parentPath)
    setSelectedFile(null)
    fetchFiles(parentPath)
  }, [currentPath, fetchFiles])

  /**
   * Handle single click - select the file.
   */
  const handleClick = useCallback((file: CloudFile) => {
    if (file.isFolder) {
      // Toggle folder expansion
      setExpandedFolders((prev: Set<string>) => {
        const next = new Set(prev)
        if (next.has(file.id)) {
          next.delete(file.id)
        } else {
          next.add(file.id)
        }
        return next
      })
    } else {
      setSelectedFile(file)
    }
  }, [])

  /**
   * FIX: Handle double-click by passing the file directly to onFileSelect.
   *
   * Previously the code did:
   *   setSelectedFile(file)
   *   handleFileSelect()  // This read stale selectedFile from closure!
   *
   * Now we pass the file directly as a parameter, avoiding the stale state issue.
   */
  const handleDoubleClick = useCallback(
    (file: CloudFile) => {
      if (file.isFolder) {
        handleNavigate(file)
      } else {
        // Pass file directly to avoid stale state from setSelectedFile + closure
        onFileSelect(file)
      }
    },
    [handleNavigate, onFileSelect]
  )

  /**
   * Handle "Open" button click - uses the currently selected file state.
   * This is safe because the user explicitly selected the file and then clicked Open.
   */
  const handleOpenClick = useCallback(() => {
    if (selectedFile && !selectedFile.isFolder) {
      onFileSelect(selectedFile)
    }
  }, [selectedFile, onFileSelect])

  const handleRefresh = useCallback(() => {
    fetchFiles(currentPath)
  }, [currentPath, fetchFiles])

  // Filter to only show IFC files and folders
  const filteredFiles = files.filter(
    (file: CloudFile) => file.isFolder || file.name.toLowerCase().endsWith(".ifc")
  )

  return (
    <div className="border rounded-md">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b bg-muted/50">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleNavigateUp}
          disabled={currentPath === "/" || isLoading}
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground flex-1 truncate">
          {currentPath}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
        </Button>
      </div>

      {/* File list */}
      <ScrollArea className="h-[300px]">
        {isLoading && files.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 p-4">
            <p className="text-sm text-destructive text-center">{error}</p>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              Retry
            </Button>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">
              {files.length === 0
                ? "Click refresh to load files"
                : "No IFC files found"}
            </p>
          </div>
        ) : (
          <div className="p-1">
            {filteredFiles.map((file: CloudFile) => (
              <div
                key={file.id}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer",
                  "hover:bg-accent hover:text-accent-foreground",
                  selectedFile?.id === file.id && "bg-accent text-accent-foreground"
                )}
                onClick={() => handleClick(file)}
                onDoubleClick={() => handleDoubleClick(file)}
              >
                {file.isFolder ? (
                  <>
                    {expandedFolders.has(file.id) ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <Folder className="h-4 w-4 text-blue-500" />
                  </>
                ) : (
                  <>
                    <span className="w-4" />
                    <File className="h-4 w-4 text-muted-foreground" />
                  </>
                )}
                <span className="flex-1 truncate text-sm">{file.name}</span>
                {file.size !== undefined && !file.isFolder && (
                  <span className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer with open button */}
      <div className="flex items-center justify-between p-2 border-t bg-muted/50">
        <span className="text-sm text-muted-foreground">
          {selectedFile ? selectedFile.name : "No file selected"}
        </span>
        <Button
          size="sm"
          onClick={handleOpenClick}
          disabled={!selectedFile || selectedFile.isFolder}
        >
          Open
        </Button>
      </div>
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
