import type { IfcElement } from "@/lib/ifc/ifc-loader"

// Mock function to filter elements by property
export function filterElements(
  elementsInput: IfcElement[] | { elements?: IfcElement[] } | null,
  property: string,
  operator: string,
  value: string,
): IfcElement[] {
  console.log("Filtering elements:", property, operator, value)
  if (!elementsInput) return []

  const elements = Array.isArray(elementsInput)
    ? elementsInput
    : Array.isArray(elementsInput.elements)
    ? elementsInput.elements!
    : []

  return elements.filter((element) => {
    const propParts = property.split(".")
    let propValue: any = element.properties

    for (const part of propParts) {
      if (!propValue || !propValue[part]) return false
      propValue = propValue[part]
    }

    // Ensure we're working with string values for comparison
    const stringValue = String(propValue)

    switch (operator) {
      case "equals":
        return stringValue === value
      case "contains":
        return stringValue.includes(value)
      case "startsWith":
        return stringValue.startsWith(value)
      case "endsWith":
        return stringValue.endsWith(value)
      default:
        return false
    }
  })
}

