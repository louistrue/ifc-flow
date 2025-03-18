import { GeometryEditor } from "./geometry-editor"
import { FilterEditor } from "./filter-editor"

export { GeometryEditor, FilterEditor }

// Map node types to their editors
export const propertyEditors = {
  geometryNode: GeometryEditor,
  filterNode: FilterEditor,
}

