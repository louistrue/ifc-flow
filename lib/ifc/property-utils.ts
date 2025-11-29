import type { IfcElement, IfcModel } from "@/lib/ifc-utils";
import { querySqliteDatabase, getLastLoadedModel } from "@/lib/ifc-utils";

/**
 * Get a property value from an element using IfcOpenShell conventions
 * This simulates ifcopenshell.util.element.get_property function
 * @param element The IFC element
 * @param propertyName The name of the property to retrieve
 * @param psetName Optional property set name to look in
 * @param model Optional model reference for SQLite fallback
 * @returns The property value or undefined if not found
 */
async function getPropertyValue(
  element: IfcElement,
  propertyName: string,
  psetName?: string,
  model?: IfcModel
): Promise<any> {
  // If pset specified, look only there
  if (psetName && element.psets?.[psetName]) {
    return element.psets[psetName][propertyName];
  }

  // First check direct properties (for convenience)
  if (element.properties && element.properties[propertyName] !== undefined) {
    return element.properties[propertyName];
  }

  // Then check all property sets (simulates ifcopenshell.util.element.get_property)
  if (element.psets && Object.keys(element.psets).length > 0) {
    for (const psetName in element.psets) {
      const pset = element.psets[psetName];
      if (pset && pset[propertyName] !== undefined) {
        return pset[propertyName];
      }
    }
  }

  // Check quantity sets if not found in psets
  if (element.qtos) {
    for (const qtoName in element.qtos) {
      const qto = element.qtos[qtoName];
      if (qto && qto[propertyName] !== undefined) {
        return qto[propertyName];
      }
    }
  }

  // Fallback to SQLite if psets are empty (fast load scenario)
  if (!element.psets || Object.keys(element.psets).length === 0) {
    try {
      const currentModel = model || getLastLoadedModel();
      if (currentModel && element.expressId) {
        // Query the psets table for this element's properties
        let sql: string;
        if (psetName) {
          sql = `SELECT value FROM psets WHERE ifc_id = ${element.expressId} AND pset_name = '${psetName}' AND name = '${propertyName}' LIMIT 1`;
        } else {
          sql = `SELECT value FROM psets WHERE ifc_id = ${element.expressId} AND name = '${propertyName}' LIMIT 1`;
        }

        console.log(`🔍 Querying SQLite for property '${propertyName}' on element ${element.expressId}:`, sql);
        const result = await querySqliteDatabase(currentModel, sql);
        console.log(`📊 SQLite result:`, result);

        if (result && result.length > 0) {
          console.log(`✅ Found property value:`, result[0].value);
          return result[0].value;
        } else {
          console.warn(`❌ No property value found for '${propertyName}' on element ${element.expressId}`);
        }
      }
    } catch (e) {
      console.warn(`Failed to query property ${propertyName} from SQLite:`, e);
    }
  }

  return undefined;
}

/**
 * Find which property set contains the specified property
 * @param element The IFC element
 * @param propertyName The property name to find
 * @returns The property set name or empty string if not found
 */
function findPropertySet(element: IfcElement, propertyName: string): string {
  // Check in property sets
  if (element.psets) {
    for (const psetName in element.psets) {
      if (element.psets[psetName][propertyName] !== undefined) {
        return psetName;
      }
    }
  }

  // Check in quantity sets
  if (element.qtos) {
    for (const qtoName in element.qtos) {
      if (element.qtos[qtoName][propertyName] !== undefined) {
        return qtoName;
      }
    }
  }

  return "";
}

/**
 * Set a property value on an element, simulating ifcOpenShell behavior
 * @param element The IFC element
 * @param propertyName The name of the property to set
 * @param propertyValue The value to set
 * @param targetPset Property set to target (required)
 * @returns The updated element
 */
function setPropertyValue(
  element: IfcElement,
  propertyName: string,
  propertyValue: any,
  targetPset: string
): IfcElement {
  const result = { ...element };

  // Initialize psets if they don't exist
  if (!result.psets) {
    result.psets = {};
  }

  // Initialize the target property set if it doesn't exist
  if (!result.psets[targetPset]) {
    result.psets[targetPset] = {};
  }

  // Set the property in the target property set
  result.psets[targetPset] = {
    ...result.psets[targetPset],
    [propertyName]: propertyValue,
  };

  // Also set in properties for easy access
  result.properties = {
    ...result.properties,
    [propertyName]: propertyValue,
  };

  return result;
}

/**
 * Remove a property from an element
 * @param element The IFC element
 * @param propertyName The name of the property to remove
 * @param targetPset Optional property set to target, if not provided will check all
 * @returns The updated element
 */
function removePropertyValue(
  element: IfcElement,
  propertyName: string,
  targetPset?: string
): IfcElement {
  const result = { ...element };

  // Remove from direct properties
  if (result.properties) {
    const newProps = { ...result.properties };
    delete newProps[propertyName];
    result.properties = newProps;
  }

  // Remove from property sets
  if (result.psets) {
    const newPsets = { ...result.psets };

    if (targetPset) {
      // Only remove from specific pset
      if (
        newPsets[targetPset] &&
        newPsets[targetPset][propertyName] !== undefined
      ) {
        newPsets[targetPset] = { ...newPsets[targetPset] };
        delete newPsets[targetPset][propertyName];
      }
    } else {
      // Remove from all psets
      for (const psetName in newPsets) {
        if (newPsets[psetName][propertyName] !== undefined) {
          newPsets[psetName] = { ...newPsets[psetName] };
          delete newPsets[psetName][propertyName];
        }
      }
    }

    result.psets = newPsets;
  }

  // Remove from quantity sets if needed
  if (!targetPset && result.qtos) {
    const newQtos = { ...result.qtos };
    for (const qtoName in newQtos) {
      if (newQtos[qtoName][propertyName] !== undefined) {
        newQtos[qtoName] = { ...newQtos[qtoName] };
        delete newQtos[qtoName][propertyName];
      }
    }
    result.qtos = newQtos;
  }

  return result;
}

/**
 * Get all property sets for an element (similar to ifcopenshell.util.element.get_psets)
 * @param element The IFC element
 * @param qtos_only If true, only return quantity sets
 * @returns All property sets or quantity sets
 */
export function getAllPropertySets(
  element: IfcElement,
  qtos_only = false
): Record<string, Record<string, any>> {
  if (qtos_only) {
    return element.qtos || {};
  }

  // Filter to non-quantity property sets
  if (element.psets) {
    const psets: Record<string, Record<string, any>> = {};
    for (const psetName in element.psets) {
      if (!psetName.startsWith("Qto_")) {
        psets[psetName] = element.psets[psetName];
      }
    }
    return psets;
  }

  return {};
}

/**
 * Get all properties from all property sets for an element
 * (similar to flattening all psets into a single dictionary)
 * @param element The IFC element
 * @returns All properties from all psets merged
 */
export function getAllProperties(element: IfcElement): Record<string, any> {
  const allProps: Record<string, any> = { ...element.properties };

  if (element.psets) {
    for (const psetName in element.psets) {
      const pset = element.psets[psetName];
      for (const propName in pset) {
        // Properties in psets override direct properties
        allProps[propName] = pset[propName];
      }
    }
  }

  return allProps;
}

// Property management functions - Using IfcOpenShell-like approach
export async function manageProperties(
  elements: IfcElement[],
  options: {
    action?: string;
    propertyName?: string;
    propertyValue?: any;
    targetPset?: string;
    source?: string;
    model?: IfcModel;
  } = {}
): Promise<IfcElement[]> {
  const {
    action = "get",
    propertyName = "",
    propertyValue = "",
    targetPset = "CustomProperties",
    source = "property",
    model
  } = options;

  console.log(
    "Managing properties:",
    action,
    propertyName,
    propertyValue,
    targetPset ? `in pset: ${targetPset}` : ""
  );

  // Handle empty or "any" values for targetPset
  let effectiveTargetPset = targetPset;
  if (effectiveTargetPset === "any") {
    effectiveTargetPset = "";
  }

  const result = [...elements];

  switch (action.toLowerCase()) {
    case "get":
      console.log("📝 In manageProperties 'get' case, processing", result.length, "elements");
      // Return original elements, with propertyInfo added for the specified property
      return Promise.all(result.map(async (element, index) => {
        console.log(`🔍 Processing element ${index + 1}/${result.length}, expressId: ${element.expressId}`);
        const value = await getPropertyValue(element, propertyName, effectiveTargetPset, model);
        const psetName = findPropertySet(element, propertyName);

        return {
          ...element,
          propertyInfo: {
            name: propertyName,
            exists: value !== undefined,
            value: value,
            psetName: psetName,
          },
        };
      }));

    case "set":
      // Set property, always using targetPset
      return result.map((element) =>
        setPropertyValue(
          element,
          propertyName,
          propertyValue,
          effectiveTargetPset || "CustomProperties"
        )
      );

    case "add":
      // Add is same as set in our implementation
      return result.map((element) =>
        setPropertyValue(
          element,
          propertyName,
          propertyValue,
          effectiveTargetPset || "CustomProperties"
        )
      );

    case "remove":
      // Remove the property from all elements
      return result.map((element) =>
        removePropertyValue(element, propertyName, effectiveTargetPset)
      );

    default:
      return result;
  }
}

// Classification functions
export function manageClassifications(
  elements: IfcElement[],
  system = "uniclass",
  action = "get",
  code = ""
): IfcElement[] {
  console.log("Managing classifications:", system, action, code);

  if (action === "get") {
    // Extract classification data from elements using IfcOpenShell conventions
    return elements.map((element) => {
      // Look for classification information in property sets
      let classification = null;

      // IfcOpenShell typically stores classifications in specific psets
      const classificationPsets = [
        "Classification",
        "Pset_ClassificationReference",
      ];

      if (element.psets) {
        // First look in known classification psets
        for (const psetName of classificationPsets) {
          if (element.psets[psetName]) {
            const pset = element.psets[psetName];
            classification = {
              System: pset.System || pset.ClassificationSystem || system,
              Code: pset.Code || pset.ClassificationCode || "",
              Description:
                pset.Description || pset.ClassificationDescription || "",
            };
            break;
          }
        }

        // If not found, try to detect classification data in any pset
        if (!classification) {
          for (const psetName in element.psets) {
            const pset = element.psets[psetName];
            if (
              psetName.includes("Classification") ||
              (pset.System && pset.Code) ||
              pset.ClassificationCode !== undefined
            ) {
              classification = {
                System: pset.System || pset.ClassificationSystem || system,
                Code: pset.Code || pset.ClassificationCode || "",
                Description:
                  pset.Description || pset.ClassificationDescription || "",
              };
              break;
            }
          }
        }
      }

      return {
        ...element,
        classifications: classification ? [classification] : [],
      };
    });
  }

  // Set classification using IfcOpenShell conventions
  return elements.map((element) => {
    const updatedElement = { ...element };

    // Initialize psets if they don't exist
    if (!updatedElement.psets) {
      updatedElement.psets = {};
    }

    // Create or update the Classification property set
    updatedElement.psets["Pset_ClassificationReference"] = {
      ...(updatedElement.psets["Pset_ClassificationReference"] || {}),
      ClassificationSystem: system,
      ClassificationCode: code,
      ClassificationDescription: `${system} - ${code}`,
    };

    // Also maintain a simplified format for the UI
    updatedElement.classifications = [
      {
        System: system,
        Code: code,
        Description: `${system} - ${code}`,
      },
    ];

    return updatedElement;
  });
}

/**
 * Format a property value for display in the UI
 * @param value Any property value
 * @param options Optional formatting options
 * @returns Formatted string representation
 */
export function formatPropertyValue(
  value: any,
  options: { maxLength?: number; showType?: boolean } = {}
): string {
  const { maxLength = 50, showType = false } = options;

  if (value === undefined || value === null) {
    return showType ? "undefined" : "";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "number") {
    // Format numbers nicely
    return value.toString();
  }

  if (typeof value === "object") {
    try {
      const json = JSON.stringify(value);
      if (json.length > maxLength) {
        return json.substring(0, maxLength) + "...";
      }
      return json;
    } catch (e) {
      return "[Complex Object]";
    }
  }

  // For strings and other types
  const str = String(value);
  if (str.length > maxLength) {
    return str.substring(0, maxLength) + "...";
  }
  return str;
}

/**
 * Create a summary of property data for display
 * @param elements The elements to summarize
 * @param propertyName The property name to summarize
 * @returns Object with summary information
 */
export function summarizePropertyData(
  elements: IfcElement[],
  propertyName: string
): {
  elementCount: number;
  withPropertyCount: number;
  uniqueValues: any[];
  valueTypes: Record<string, number>;
  propertySetCounts: Record<string, number>;
} {
  const summary = {
    elementCount: elements.length,
    withPropertyCount: 0,
    uniqueValues: [] as any[],
    valueTypes: {} as Record<string, number>,
    propertySetCounts: {} as Record<string, number>,
  };

  // Track unique values (up to 10)
  const uniqueValuesSet = new Set();

  elements.forEach((element) => {
    const value = getPropertyValue(element, propertyName);

    if (value !== undefined) {
      summary.withPropertyCount++;

      // Add to unique values (if not too many)
      if (uniqueValuesSet.size < 10) {
        uniqueValuesSet.add(
          typeof value === "object" ? JSON.stringify(value) : value
        );
      }

      // Count value types
      const type = typeof value;
      summary.valueTypes[type] = (summary.valueTypes[type] || 0) + 1;

      // Count property sets
      const psetName = findPropertySet(element, propertyName);
      if (psetName) {
        summary.propertySetCounts[psetName] =
          (summary.propertySetCounts[psetName] || 0) + 1;
      }
    }
  });

  // Convert unique values set to array
  summary.uniqueValues = Array.from(uniqueValuesSet);

  return summary;
}
