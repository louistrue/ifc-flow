import type { IfcElement } from "@/lib/ifc/ifc-loader"

// Available filter types
export const FILTER_TYPES = [
  { id: "ifcClass", label: "IFC Class" },
  { id: "propertySet", label: "Property Set" },
  { id: "property", label: "Property" },
  { id: "globalId", label: "Global ID" },
  { id: "name", label: "Name" },
  { id: "description", label: "Description" },
  { id: "level", label: "Level" }
]

// Available operators for each filter type
export const FILTER_OPERATORS: Record<string, { id: string; label: string }[]> = {
  ifcClass: [
    { id: "equals", label: "Equals" },
    { id: "notEquals", label: "Not Equals" }
  ],
  propertySet: [
    { id: "exists", label: "Exists" },
    { id: "notExists", label: "Not Exists" }
  ],
  property: [
    { id: "equals", label: "Equals" },
    { id: "notEquals", label: "Not Equals" },
    { id: "contains", label: "Contains" },
    { id: "startsWith", label: "Starts With" },
    { id: "endsWith", label: "Ends With" },
    { id: "greaterThan", label: "> (numeric)" },
    { id: "lessThan", label: "< (numeric)" }
  ],
  globalId: [
    { id: "equals", label: "Equals" },
    { id: "contains", label: "Contains" }
  ],
  name: [
    { id: "equals", label: "Equals" },
    { id: "notEquals", label: "Not Equals" },
    { id: "contains", label: "Contains" },
    { id: "startsWith", label: "Starts With" },
    { id: "endsWith", label: "Ends With" }
  ],
  description: [
    { id: "equals", label: "Equals" },
    { id: "notEquals", label: "Not Equals" },
    { id: "contains", label: "Contains" },
    { id: "isEmpty", label: "Is Empty" },
    { id: "isNotEmpty", label: "Is Not Empty" }
  ],
  level: [
    { id: "equals", label: "Equals" },
    { id: "notEquals", label: "Not Equals" }
  ]
}

// Common IFC classes for filtering dropdown
export const COMMON_IFC_CLASSES = [
  "IfcWall",
  "IfcSlab",
  "IfcBeam",
  "IfcColumn",
  "IfcDoor",
  "IfcWindow",
  "IfcRoof",
  "IfcStair",
  "IfcSpace",
  "IfcFurnishingElement"
]

// Main filter function
export function filterElements(
  elements: IfcElement[],
  filterType: string,
  operator: string,
  value: string,
  propertySet?: string // Added propertySet for property filtering
): IfcElement[] {
  console.log(`Filtering elements by ${filterType} ${operator} ${value}${propertySet ? ` in ${propertySet}` : ''}`)

  // Ensure elements is an array
  if (!elements || !Array.isArray(elements)) {
    console.error("Invalid elements input:", elements)
    return []
  }

  return elements.filter((element) => {
    try {
      switch (filterType) {
        case "ifcClass":
          return filterByIfcClass(element, operator, value)

        case "propertySet":
          return filterByPropertySet(element, operator, value)

        case "property":
          // Split property name if it contains '.' (e.g., "Pset_WallCommon.FireRating")
          let propName = value;
          let psetNameForProp = propertySet; // Use explicitly passed propertySet first
          if (!psetNameForProp && value.includes('.')) {
            [psetNameForProp, propName] = value.split('.', 2);
          }
          return filterByPropertyWithValue(element, operator, propName, psetNameForProp, value);

        case "globalId":
          return filterByGlobalId(element, operator, value)

        case "name":
          return filterByName(element, operator, value)

        case "description":
          return filterByDescription(element, operator, value)

        case "level":
          return filterByLevel(element, operator, value)

        default:
          console.warn(`Unknown filter type: ${filterType}`)
          return false
      }
    } catch (error) {
      console.error(`Filter error for element ${element.expressId || element.id}:`, error)
      return false
    }
  })
}

// Helper function to get a property value, searching psets if needed
function getElementPropertyValue(element: IfcElement, propertyName: string, psetName?: string): any {
  // If pset specified, look only there
  if (psetName && element.psets?.[psetName]) {
    return element.psets[psetName][propertyName];
  }

  // Check direct properties
  if (element.properties && element.properties[propertyName] !== undefined) {
    return element.properties[propertyName];
  }

  // Check all property sets if pset not specified
  if (!psetName && element.psets) {
    for (const currentPsetName in element.psets) {
      const pset = element.psets[currentPsetName];
      if (pset && pset[propertyName] !== undefined) {
        return pset[propertyName];
      }
    }
  }

  // Check quantity sets
  if (element.qtos) {
    for (const qtoName in element.qtos) {
      const qto = element.qtos[qtoName];
      if (qto && qto[propertyName] !== undefined) {
        return qto[propertyName];
      }
    }
  }

  return undefined;
}


// Filter by IFC class (e.g., IfcWall, IfcSlab)
function filterByIfcClass(element: IfcElement, operator: string, value: string): boolean {
  const elementClass = element.type?.toUpperCase() || "";
  const targetValue = value.toUpperCase();

  // Handle "all" case specifically
  if (targetValue === "ALL") {
    // If filtering for "all", always include the element (regardless of operator for now)
    // You might refine this based on operator if needed (e.g., "notEquals all" would be false)
    return true;
  }

  switch (operator) {
    case "equals":
      // Use startsWith for more flexibility (e.g., IfcWall matches IfcWallStandardCase)
      const isEqual = elementClass.startsWith(targetValue);
      return isEqual;
    case "notEquals":
      // For notEquals, we probably want to check it doesn't start with it either
      const isNotEqual = !elementClass.startsWith(targetValue);
      return isNotEqual;
    default:
      // Keep the warning for unknown operators
      console.warn(`    -> Unknown operator for ifcClass: ${operator}`);
      return false;
  }
}

// Filter by existence of a property set
function filterByPropertySet(element: IfcElement, operator: string, value: string): boolean {
  const hasPset = !!(element.psets && element.psets[value] !== undefined);

  switch (operator) {
    case "exists":
      return hasPset;
    case "notExists":
      return !hasPset;
    default:
      return false;
  }
}

// Filter by property value
function filterByPropertyWithValue(element: IfcElement, operator: string, propertyName: string, psetName: string | undefined, targetValue: string): boolean {
  const propValue = getElementPropertyValue(element, propertyName, psetName);

  const result = compareValues(propValue, operator, targetValue);
  return result;
}

// Filter by GlobalId
function filterByGlobalId(element: IfcElement, operator: string, value: string): boolean {
  const globalId = element.properties?.GlobalId || element.properties?.globalId || ""

  switch (operator) {
    case "equals":
      return globalId === value
    case "contains":
      return typeof globalId === 'string' && globalId.includes(value)
    default:
      return false
  }
}

// Filter by Name property
function filterByName(element: IfcElement, operator: string, value: string): boolean {
  const name = element.properties?.Name || element.properties?.name || ""

  switch (operator) {
    case "equals":
      return name === value
    case "notEquals":
      return name !== value
    case "contains":
      return typeof name === 'string' && name.includes(value)
    case "startsWith":
      return typeof name === 'string' && name.startsWith(value)
    case "endsWith":
      return typeof name === 'string' && name.endsWith(value)
    default:
      return false
  }
}

// Filter by Description property
function filterByDescription(element: IfcElement, operator: string, value: string): boolean {
  const description = element.properties?.Description || element.properties?.description || ""

  switch (operator) {
    case "equals":
      return description === value
    case "notEquals":
      return description !== value
    case "contains":
      return typeof description === 'string' && description.includes(value)
    case "isEmpty":
      return description === ""
    case "isNotEmpty":
      return description !== ""
    default:
      return false
  }
}

// Filter by Level (StoreyName)
function filterByLevel(element: IfcElement, operator: string, value: string): boolean {
  // Try to find level info in various common locations
  const level =
    getElementPropertyValue(element, "Level") ||
    getElementPropertyValue(element, "StoreyName") ||
    getElementPropertyValue(element, "BuildingStorey") ||
    "";

  switch (operator) {
    case "equals":
      return level === value
    case "notEquals":
      return level !== value
    default:
      return false
  }
}

// Helper function to compare values with operators
function compareValues(propValue: any, operator: string, targetValue: string): boolean {
  // Handle undefined/null values specifically for existence checks
  if (propValue === undefined || propValue === null) {
    // Allow 'notEquals' or 'notExists' type operators to pass if value is null/undefined
    return operator === "notEquals" || operator === "isEmpty" || operator === "notExists";
  }

  const stringValue = String(propValue).toLowerCase();
  const targetStringValue = String(targetValue).toLowerCase();

  switch (operator) {
    case "equals":
      return stringValue === targetStringValue
    case "notEquals":
      return stringValue !== targetStringValue
    case "contains":
      return stringValue.includes(targetStringValue)
    case "startsWith":
      return stringValue.startsWith(targetStringValue)
    case "endsWith":
      return stringValue.endsWith(targetStringValue)
    case "greaterThan": // Numeric comparison
      const numProp = parseFloat(stringValue);
      const numTarget = parseFloat(targetStringValue);
      return !isNaN(numProp) && !isNaN(numTarget) && numProp > numTarget;
    case "lessThan": // Numeric comparison
      const numPropLt = parseFloat(stringValue);
      const numTargetLt = parseFloat(targetStringValue);
      return !isNaN(numPropLt) && !isNaN(numTargetLt) && numPropLt < numTargetLt;
    case "isEmpty":
      return stringValue === ""
    case "isNotEmpty":
      return stringValue !== ""
    case "exists": // Property exists and is not null/undefined
      return propValue !== undefined && propValue !== null;
    case "notExists": // Property does not exist or is null/undefined
      return propValue === undefined || propValue === null;
    default:
      console.warn(`Unknown comparison operator: ${operator}`)
      return false
  }
}

