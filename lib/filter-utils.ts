import type { IfcElement } from "@/lib/ifc/ifc-loader"

// Mock function to filter elements by property
export function filterElements(
  elements: IfcElement[],
  property: string,
  operator: string,
  value: string,
): IfcElement[] {
  console.log("Filtering elements:", property, operator, value)

  return elements.filter((element) => {
    const propParts = property.split(".")
    let propValue = element.properties

    for (const part of propParts) {
      if (!propValue[part]) return false
      propValue = propValue[part]
    }

    switch (operator) {
      case "equals":
        return propValue === value
      case "contains":
        return propValue.includes(value)
      case "startsWith":
        return propValue.startsWith(value)
      case "endsWith":
        return propValue.endsWith(value)
      default:
        return false
    }
  })
}

