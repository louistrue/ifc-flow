import { loadIfcFile, IfcModel } from "@/lib/ifc-utils";
import { storeRawIfcContent } from "../ifc-utils";

// Interface for file upload handler props
export interface FileUploaderProps {
  onFileLoaded: (model: IfcModel) => void;
  onError: (error: Error) => void;
  onProgress?: (progress: number, message?: string) => void;
}

// Function to handle file uploads
export async function handleFileUpload(
  file: File,
  onFileLoaded: (model: IfcModel) => void,
  onError: (error: Error) => void,
  onProgress?: (progress: number, message?: string) => void
): Promise<void> {
  try {
    // Check if it's actually an IFC file
    if (!file.name.toLowerCase().endsWith(".ifc")) {
      throw new Error("File must be an IFC file with .ifc extension");
    }

    // Notify start of loading
    if (onProgress) onProgress(0, "Starting file processing");

    // Log the file being processed
    console.log(
      `Processing IFC file: ${file.name} (${(file.size / (1024 * 1024)).toFixed(
        2
      )} MB)`
    );

    // Add a timeout warning for large files
    let timeoutWarning: NodeJS.Timeout | null = null;
    if (file.size > 10 * 1024 * 1024) {
      // If file is larger than 10MB
      timeoutWarning = setTimeout(() => {
        if (onProgress)
          onProgress(
            90,
            "Still processing, large IFC files can take a while..."
          );
      }, 20000); // Show warning after 20 seconds
    }

    // Store the IFC file for direct access by classification nodes
    try {
      // Use FileReader to get raw text content for classification parsing
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target && typeof e.target.result === "string") {
          // Store raw content with filename as key
          storeRawIfcContent(file.name, e.target.result);
          console.log(
            `Stored raw IFC content for ${file.name} (${e.target.result.length} chars)`
          );
        }
      };
      // Start reading as text
      reader.readAsText(file);
    } catch (err) {
      console.warn("Failed to store raw IFC content:", err);
    }

    // Load the file with our IfcOpenShell implementation
    const model = await loadIfcFile(file, onProgress);

    // Clear the timeout warning if it exists
    if (timeoutWarning) clearTimeout(timeoutWarning);

    // Notify completion
    if (onProgress) onProgress(100, "Processing complete");
    onFileLoaded(model);

    console.log(
      `File processed successfully: ${model.elements.length} elements loaded`
    );
  } catch (error) {
    console.error("Error processing IFC file:", error);
    onError(error instanceof Error ? error : new Error(String(error)));
  }
}

// Helper to validate file before upload
export function validateIfcFile(file: File): {
  valid: boolean;
  message?: string;
} {
  if (!file) {
    return { valid: false, message: "No file selected" };
  }

  if (!file.name.toLowerCase().endsWith(".ifc")) {
    return {
      valid: false,
      message: "File must be an IFC file with .ifc extension",
    };
  }

  if (file.size > 100 * 1024 * 1024) {
    return { valid: false, message: "File size exceeds 100MB limit" };
  }

  return { valid: true };
}
