import type { IfcElement } from "@/lib/ifc-utils"

// Mock function to filter elements by property or IFC class
export function filterElements(
  elements: IfcElement[],
  property: string,
  operator: string,
  value: string,
  filterType: 'property' | 'ifcClass' = 'property'
): IfcElement[] {
  console.log("Filtering elements:", property, operator, value, filterType)

  return elements.filter((element) => {
    if (filterType === 'ifcClass') {
      // Filter by IFC class
      const elementType = element.type || '';
      
      // Case-insensitive matching
      const lowerElementType = elementType.toLowerCase();
      const lowerProperty = property.toLowerCase();

      switch (operator) {
        case "equals":
          return lowerElementType === lowerProperty;
        case "contains":
          return lowerElementType.includes(lowerProperty);
        case "startsWith":
          return lowerElementType.startsWith(lowerProperty);
        case "endsWith":
          return lowerElementType.endsWith(lowerProperty);
        default:
          return false;
      }
    } else {
      // Original property-based filtering
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
    }
  })
}

