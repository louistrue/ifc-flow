import type { IfcElement } from "@/lib/ifc/ifc-loader"

// Export functions
export function exportData(
  elements: IfcElement[],
  format = "csv",
  fileName = "export",
): string {
  console.log("Exporting data:", format, fileName)

  const propertyList = Array.from(
    new Set(elements.flatMap((el) => Object.keys(el.properties || {})))
  )

  switch (format) {
    case "csv":
      // Generate mock CSV
      const csvHeader = propertyList.join(",")
      const csvRows = elements.map((element) => {
        return propertyList.map((prop) => element.properties[prop] || "").join(",")
      })
      return `${csvHeader}\n${csvRows.join("\n")}`

    case "json":
      // Generate mock JSON
      const jsonData = elements.map((element) => {
        const obj: Record<string, any> = {}
        propertyList.forEach((prop) => {
          obj[prop] = element.properties[prop] || null
        })
        return obj
      })
      return JSON.stringify(jsonData, null, 2)

    case "excel":
      // Would use a library like ExcelJS in a real app
      return "Excel export (mock)"

    case "ifc":
      // Would use IfcOpenShell to generate IFC
      return "IFC export (mock)"

    case "glb":
      // Would use Three.js to generate GLB
      return "GLB export (mock)"

    default:
      return "Unknown format"
  }
}

