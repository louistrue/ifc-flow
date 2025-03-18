import { propertyEditors } from "./property-editors"

export function NodePropertyRenderer({ node, properties, setProperties }) {
  // Check if we have a specific editor for this node type
  const PropertyEditor = propertyEditors[node.type]

  if (PropertyEditor) {
    return <PropertyEditor properties={properties} setProperties={setProperties} />
  }

  // Default fallback for nodes without specific editors
  return (
    <div className="text-center text-sm text-muted-foreground py-4">No properties available for this node type.</div>
  )
}

