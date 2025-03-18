"use client"

import { useState, useEffect } from "react"

export function useFileDrag() {
  const [isFileDragging, setIsFileDragging] = useState(false)

  // Add event listeners for file drag events on the document
  useEffect(() => {
    const handleDocumentDragOver = (e: DragEvent) => {
      e.preventDefault()
      // Check if files are being dragged
      if (e.dataTransfer?.types.includes("Files")) {
        setIsFileDragging(true)
      }
    }

    const handleDocumentDragLeave = (e: DragEvent) => {
      // Only consider it a leave if we're leaving the document
      if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
        setIsFileDragging(false)
      }
    }

    const handleDocumentDrop = () => {
      setIsFileDragging(false)
    }

    document.addEventListener("dragover", handleDocumentDragOver)
    document.addEventListener("dragleave", handleDocumentDragLeave)
    document.addEventListener("drop", handleDocumentDrop)

    return () => {
      document.removeEventListener("dragover", handleDocumentDragOver)
      document.removeEventListener("dragleave", handleDocumentDragLeave)
      document.removeEventListener("drop", handleDocumentDrop)
    }
  }, [])

  return {
    isFileDragging,
    setIsFileDragging,
  }
}

