import type { IfcElement } from "@/lib/ifc/ifc-loader"

// Quantity extraction functions
export function extractQuantities(
  elements: IfcElement[],
  quantityType = "area",
  groupBy = "none",
  unit = "",
): Record<string, number> {
  console.log("Extracting quantities:", quantityType, groupBy)

  // Default units by quantity type
  const defaultUnits: Record<string, string> = {
    length: "m",
    area: "m²",
    volume: "m³",
    count: "",
    weight: "kg",
  }

  const finalUnit = unit || defaultUnits[quantityType] || ""

  // Mock quantity data
  if (groupBy === "none") {
    return { Total: getMockQuantity(elements.length, quantityType) }
  }

  const groups: Record<string, number> = {}

  elements.forEach((element) => {
    let groupKey = ""

    switch (groupBy) {
      case "type":
        groupKey = element.type
        break
      case "material":
        groupKey = element.properties.Material || "Unknown"
        break
      case "level":
        groupKey = element.properties.Level || "Unknown"
        break
      default:
        groupKey = "Unknown"
    }

    if (!groups[groupKey]) {
      groups[groupKey] = 0
    }

    groups[groupKey] += getMockQuantity(1, quantityType)
  })

  return groups
}

// Helper function to generate mock quantities
function getMockQuantity(factor: number, type: string): number {
  const base: Record<string, number> = {
    length: 3.5,
    area: 12.5,
    volume: 8.2,
    count: 1,
    weight: 750,
  }

  const randomFactor = 0.8 + Math.random() * 0.4 // 0.8 to 1.2
  return Number((base[type] * factor * randomFactor).toFixed(2))
}

/**
 * Formats common unit symbols for display.
 * E.g., converts "m2" to "m²", "m3" to "m³", etc.
 * 
 * @param unitSymbol The raw unit symbol string.
 * @returns A formatted unit symbol string.
 */
export function formatUnitSymbol(unitSymbol: string | null | undefined): string {
  if (!unitSymbol) {
    return "";
  }

  // Handle common cases with superscripts
  let formatted = unitSymbol
    .replace(/m2/gi, "m²") // Square meters
    .replace(/m3/gi, "m³") // Cubic meters
    .replace(/ft2/gi, "ft²") // Square feet
    .replace(/ft3/gi, "ft³") // Cubic feet
    .replace(/sq.?ft/gi, "ft²") // Alternative square feet
    .replace(/cu.?ft/gi, "ft³") // Alternative cubic feet
    .replace(/deg/gi, "°");   // Degrees

  // Add more replacements as needed based on common IFC units

  return formatted;
}

