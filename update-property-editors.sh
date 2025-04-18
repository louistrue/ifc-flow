#!/bin/bash

# List of property editor components to update
editor_files=(
  "components/properties-panel/property-editors/geometry-editor.tsx"
  "components/properties-panel/property-editors/ifc-editor.tsx"
  "components/properties-panel/property-editors/transform-editor.tsx"
  "components/properties-panel/property-editors/property-editor.tsx"
  "components/properties-panel/property-editors/export-editor.tsx"
  "components/properties-panel/property-editors/classification-editor.tsx"
  "components/properties-panel/property-editors/spatial-editor.tsx"
  "components/properties-panel/property-editors/relationship-editor.tsx"
  "components/properties-panel/property-editors/quantity-editor.tsx"
  "components/properties-panel/property-editors/analysis-editor.tsx"
  "components/properties-panel/property-editors/parameter-editor.tsx"
  "components/properties-panel/property-editors/viewer-editor.tsx"
  "components/properties-panel/property-editors/watch-editor.tsx"
)

# Loop through each editor file and update it
for file_path in "${editor_files[@]}"; do
  # Check if file exists
  if [ -f "$file_path" ]; then
    editor_name=$(basename "$file_path" .tsx)
    display_name=$(echo "${editor_name%-editor}" | sed 's/-/ /g' | sed 's/\b\(.\)/\u\1/g')
    
    echo "Updating $file_path..."
    
    # Add interface definition right after the imports
    sed -i '' '/^import.*$/,/^export function/ {
      /^export function/i\
interface '"$display_name"'EditorProps {\
  properties: Record<string, any>;\
  setProperties: (properties: Record<string, any>) => void;\
}\
\

      ; }' "$file_path"
    
    # Update the function signature
    sed -i '' 's/export function \(.*\)({ properties, setProperties })/export function \1({ properties, setProperties }: '"$display_name"'EditorProps)/' "$file_path"
    
    echo "Updated $file_path"
  else
    echo "File $file_path not found, skipping"
  fi
done

echo "All property editor components have been updated." 