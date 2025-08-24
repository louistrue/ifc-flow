import type { IfcElement } from "@/lib/ifc/ifc-loader"

// Mock function to filter elements by various criteria
export function filterElements(
  elements: IfcElement[],
  options: {
    filterType?: string
    pset?: string
    property?: string
    value?: string
    storey?: string
    material?: string
    ifcClass?: string
  }
): IfcElement[] {
  const {
    filterType = "property",
    pset,
    property,
    value,
    storey,
    material,
    ifcClass,
  } = options
  const matchValue = (propValue: any, pattern?: string) => {
    if (!pattern) return true
    const str = String(propValue)
    const strLower = str.toLowerCase()
    if (pattern.startsWith("/") && pattern.endsWith("/")) {
      try {
        const regex = new RegExp(pattern.slice(1, -1), "i")
        return regex.test(str)
      } catch {
        return false
      }
    }
    if (pattern.includes(";")) {
      const vals = pattern.split(";").map((v) => v.trim().toLowerCase())
      return vals.includes(strLower)
    }
    if (pattern.includes(",")) {
      const vals = pattern.split(",").map((v) => v.trim().toLowerCase())
      return vals.includes(strLower)
    }
    return strLower === pattern.toLowerCase()
  }

  return elements.filter((element) => {
    switch (filterType) {
      case "storey": {
        const storeyValue = element.properties?.Level || element.properties?.Storey
        if (!storeyValue) return false
        return matchValue(storeyValue, storey)
      }
      case "material": {
        const materialValue = element.properties?.Material
        if (!materialValue) return false
        return matchValue(materialValue, material)
      }
      case "class": {
        const classValue = element.type
        if (!classValue) return false
        return matchValue(classValue, ifcClass)
      }
      case "property":
      default: {
        if (pset && property) {
          const propValue = element.psets?.[pset]?.[property]
          if (propValue === undefined) return false
          return matchValue(propValue, value)
        }
        if (pset && !property) {
          const p = element.psets?.[pset]
          if (!p) return false
          if (!value) return true
          return Object.values(p).some((v) => matchValue(v, value))
        }
        if (!pset && property) {
          if (element.properties?.[property] !== undefined) {
            return matchValue(element.properties[property], value)
          }
          if (element.psets) {
            for (const name in element.psets) {
              const p = element.psets[name]
              if (p[property] !== undefined && matchValue(p[property], value)) {
                return true
              }
            }
          }
          return false
        }
        if (!value) return false
        if (element.properties && Object.values(element.properties).some((v) => matchValue(v, value))) {
          return true
        }
        if (element.psets) {
          for (const name in element.psets) {
            const p = element.psets[name]
            if (Object.values(p).some((v) => matchValue(v, value))) {
              return true
            }
          }
        }
        return false
      }
    }
  })
}

