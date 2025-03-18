import type { IfcElement } from "@/lib/ifc/ifc-loader"

// Property management functions
export function manageProperties(
  elements: IfcElement[],
  action = "get",
  propertyName = "",
  propertyValue = "",
): IfcElement[] {
  console.log("Managing properties:", action, propertyName, propertyValue)

  const result = [...elements]

  switch (action) {
    case "get":
      // Return original elements, with enhanced data for the specified property
      return result

    case "set":
      // Set the property on all elements
      return result.map((element) => ({
        ...element,
        properties: {
          ...element.properties,
          [propertyName]: propertyValue,
        },
      }))

    case "add":
      // Same as set for our simplified implementation
      return result.map((element) => ({
        ...element,
        properties: {
          ...element.properties,
          [propertyName]: propertyValue,
        },
      }))

    case "remove":
      // Remove the property from all elements
      return result.map((element) => {
        const newProps = { ...element.properties }
        delete newProps[propertyName]
        return {
          ...element,
          properties: newProps,
        }
      })

    default:
      return result
  }
}

// Classification functions
export function manageClassifications(
  elements: IfcElement[],
  system = "uniclass",
  action = "get",
  code = "",
): IfcElement[] {
  console.log("Managing classifications:", system, action, code)

  if (action === "get") {
    // Just return the elements, in a real implementation we'd enhance with classification data
    return elements
  }

  // Set classification
  return elements.map((element) => ({
    ...element,
    properties: {
      ...element.properties,
      Classification: {
        System: system,
        Code: code,
        Description: `Mock ${system} description for ${code}`,
      },
    },
  }))
}

