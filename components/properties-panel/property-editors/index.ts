import { GeometryEditor } from "./geometry-editor"
import { FilterEditor } from "./filter-editor"
import { SpaceAnalysisEditor } from "./space-analysis-editor"

export { GeometryEditor, FilterEditor, SpaceAnalysisEditor }

// Map node types to their editors
export const propertyEditors = {
  geometryNode: GeometryEditor,
  filterNode: FilterEditor,
  analysisNode: SpaceAnalysisEditor,
}

