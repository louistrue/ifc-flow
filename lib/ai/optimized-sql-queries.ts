/**
 * Optimized SQL Query Patterns for IFC SQLite Database
 * Based on actual IfcOpenShell ifc2sql schema analysis
 */

export interface QueryPattern {
    name: string;
    description: string;
    sql: string;
    resultType: 'count' | 'list' | 'properties' | 'quantities' | 'materials';
    expectedColumns: string[];
}

/**
 * Common SQL query patterns optimized for the actual database structure
 */
export const OPTIMIZED_QUERIES: Record<string, QueryPattern> = {
    // Element Counts
    WALL_COUNT: {
        name: "Wall Count",
        description: "Count all walls in the model",
        sql: "SELECT COUNT(*) as count FROM IfcWallStandardCase",
        resultType: 'count',
        expectedColumns: ['count']
    },

    SLAB_COUNT: {
        name: "Slab Count",
        description: "Count all slabs in the model",
        sql: "SELECT COUNT(*) as count FROM IfcSlab",
        resultType: 'count',
        expectedColumns: ['count']
    },

    BEAM_COUNT: {
        name: "Beam Count",
        description: "Count all beams in the model",
        sql: "SELECT COUNT(*) as count FROM IfcBeam",
        resultType: 'count',
        expectedColumns: ['count']
    },

    COLUMN_COUNT: {
        name: "Column Count",
        description: "Count all columns in the model",
        sql: "SELECT COUNT(*) as count FROM IfcColumn",
        resultType: 'count',
        expectedColumns: ['count']
    },

    ALL_ELEMENT_COUNTS: {
        name: "All Element Counts",
        description: "Count all element types using id_map",
        sql: "SELECT ifc_class, COUNT(*) as count FROM id_map WHERE ifc_class LIKE 'Ifc%' AND ifc_class NOT LIKE '%Rel%' AND ifc_class NOT LIKE '%Property%' AND ifc_class NOT LIKE '%Quantity%' GROUP BY ifc_class ORDER BY count DESC",
        resultType: 'list',
        expectedColumns: ['ifc_class', 'count']
    },

    // Element Lists with Names
    WALL_NAMES: {
        name: "Wall Names",
        description: "Get all wall names and GlobalIds",
        sql: "SELECT ifc_id, GlobalId, Name, ObjectType FROM IfcWallStandardCase ORDER BY Name",
        resultType: 'list',
        expectedColumns: ['ifc_id', 'GlobalId', 'Name', 'ObjectType']
    },

    SLAB_NAMES: {
        name: "Slab Names",
        description: "Get all slab names and GlobalIds",
        sql: "SELECT ifc_id, GlobalId, Name, ObjectType FROM IfcSlab ORDER BY Name",
        resultType: 'list',
        expectedColumns: ['ifc_id', 'GlobalId', 'Name', 'ObjectType']
    },

    BEAM_NAMES: {
        name: "Beam Names",
        description: "Get all beam names and GlobalIds",
        sql: "SELECT ifc_id, GlobalId, Name, ObjectType FROM IfcBeam ORDER BY Name",
        resultType: 'list',
        expectedColumns: ['ifc_id', 'GlobalId', 'Name', 'ObjectType']
    },

    // Properties and Quantities
    WALL_PROPERTIES: {
        name: "Wall Properties",
        description: "Get wall properties from psets",
        sql: `SELECT w.ifc_id, w.GlobalId, w.Name, p.pset_name, p.name as property_name, p.value 
          FROM IfcWallStandardCase w 
          JOIN psets p ON w.ifc_id = p.ifc_id 
          ORDER BY w.Name, p.pset_name, p.name`,
        resultType: 'properties',
        expectedColumns: ['ifc_id', 'GlobalId', 'Name', 'pset_name', 'property_name', 'value']
    },

    WALL_QUANTITIES: {
        name: "Wall Quantities",
        description: "Get wall base quantities",
        sql: `SELECT w.ifc_id, w.GlobalId, w.Name, p.name as quantity_name, p.value 
          FROM IfcWallStandardCase w 
          JOIN psets p ON w.ifc_id = p.ifc_id 
          WHERE p.pset_name = 'BaseQuantities'
          ORDER BY w.Name, p.name`,
        resultType: 'quantities',
        expectedColumns: ['ifc_id', 'GlobalId', 'Name', 'quantity_name', 'value']
    },

    // Materials
    WALL_MATERIALS: {
        name: "Wall Materials",
        description: "Get unique materials used in walls",
        sql: `SELECT DISTINCT w.ObjectType as material_type, COUNT(*) as count
          FROM IfcWallStandardCase w 
          WHERE w.ObjectType IS NOT NULL
          GROUP BY w.ObjectType
          ORDER BY count DESC`,
        resultType: 'materials',
        expectedColumns: ['material_type', 'count']
    },

    // Advanced Queries
    ELEMENTS_WITH_AREAS: {
        name: "Elements with Areas",
        description: "Get elements with their areas from quantities",
        sql: `SELECT id_map.ifc_class, p.ifc_id, p.value as area
          FROM psets p
          JOIN id_map ON p.ifc_id = id_map.ifc_id
          WHERE p.pset_name = 'BaseQuantities' 
          AND p.name IN ('GrossFootprintArea', 'GrossSideArea', 'NetSideArea')
          AND CAST(p.value AS REAL) > 0
          ORDER BY CAST(p.value AS REAL) DESC`,
        resultType: 'quantities',
        expectedColumns: ['ifc_class', 'ifc_id', 'area']
    },

    ELEMENTS_WITH_VOLUMES: {
        name: "Elements with Volumes",
        description: "Get elements with their volumes from quantities",
        sql: `SELECT id_map.ifc_class, p.ifc_id, p.value as volume
          FROM psets p
          JOIN id_map ON p.ifc_id = id_map.ifc_id  
          WHERE p.pset_name = 'BaseQuantities'
          AND p.name = 'GrossVolume'
          AND CAST(p.value AS REAL) > 0
          ORDER BY CAST(p.value AS REAL) DESC`,
        resultType: 'quantities',
        expectedColumns: ['ifc_class', 'ifc_id', 'volume']
    },

    PROPERTY_NAMES: {
        name: "Available Property Names",
        description: "Get all available property names and their usage count",
        sql: `SELECT pset_name, name, COUNT(*) as usage_count
          FROM psets 
          GROUP BY pset_name, name 
          ORDER BY usage_count DESC`,
        resultType: 'list',
        expectedColumns: ['pset_name', 'name', 'usage_count']
    }
};

/**
 * Generate a dynamic query based on element type and request type
 */
export function generateDynamicQuery(
    elementType: string,
    requestType: 'count' | 'names' | 'properties' | 'quantities' | 'materials'
): QueryPattern | null {
    const ifcClass = elementType.startsWith('Ifc') ? elementType : `Ifc${elementType}`;

    switch (requestType) {
        case 'count':
            return {
                name: `${elementType} Count`,
                description: `Count all ${elementType.toLowerCase()}s`,
                sql: `SELECT COUNT(*) as count FROM ${ifcClass}`,
                resultType: 'count',
                expectedColumns: ['count']
            };

        case 'names':
            return {
                name: `${elementType} Names`,
                description: `Get all ${elementType.toLowerCase()} names`,
                sql: `SELECT ifc_id, GlobalId, Name, ObjectType FROM ${ifcClass} ORDER BY Name`,
                resultType: 'list',
                expectedColumns: ['ifc_id', 'GlobalId', 'Name', 'ObjectType']
            };

        case 'properties':
            return {
                name: `${elementType} Properties`,
                description: `Get ${elementType.toLowerCase()} properties`,
                sql: `SELECT e.ifc_id, e.GlobalId, e.Name, p.pset_name, p.name as property_name, p.value 
              FROM ${ifcClass} e 
              JOIN psets p ON e.ifc_id = p.ifc_id 
              ORDER BY e.Name, p.pset_name, p.name`,
                resultType: 'properties',
                expectedColumns: ['ifc_id', 'GlobalId', 'Name', 'pset_name', 'property_name', 'value']
            };

        case 'quantities':
            return {
                name: `${elementType} Quantities`,
                description: `Get ${elementType.toLowerCase()} quantities`,
                sql: `SELECT e.ifc_id, e.GlobalId, e.Name, p.name as quantity_name, p.value 
              FROM ${ifcClass} e 
              JOIN psets p ON e.ifc_id = p.ifc_id 
              WHERE p.pset_name = 'BaseQuantities'
              ORDER BY e.Name, p.name`,
                resultType: 'quantities',
                expectedColumns: ['ifc_id', 'GlobalId', 'Name', 'quantity_name', 'value']
            };

        case 'materials':
            return {
                name: `${elementType} Materials`,
                description: `Get ${elementType.toLowerCase()} materials`,
                sql: `SELECT DISTINCT ObjectType as material_type, COUNT(*) as count
              FROM ${ifcClass} 
              WHERE ObjectType IS NOT NULL
              GROUP BY ObjectType
              ORDER BY count DESC`,
                resultType: 'materials',
                expectedColumns: ['material_type', 'count']
            };

        default:
            return null;
    }
}

/**
 * Validate if a table exists in the database schema
 */
export function validateTableExists(tableName: string): QueryPattern {
    return {
        name: "Table Validation",
        description: `Check if table ${tableName} exists`,
        sql: `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`,
        resultType: 'list',
        expectedColumns: ['name']
    };
}

/**
 * Get database schema information
 */
export const SCHEMA_QUERIES = {
    ALL_TABLES: {
        name: "All Tables",
        description: "Get all table names",
        sql: "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
        resultType: 'list' as const,
        expectedColumns: ['name']
    },

    ELEMENT_TABLES: {
        name: "Element Tables",
        description: "Get all IFC element tables",
        sql: "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'Ifc%' AND name NOT LIKE '%Rel%' ORDER BY name",
        resultType: 'list' as const,
        expectedColumns: ['name']
    },

    TABLE_SCHEMA: (tableName: string) => ({
        name: `${tableName} Schema`,
        description: `Get schema for table ${tableName}`,
        sql: `PRAGMA table_info(${tableName})`,
        resultType: 'list' as const,
        expectedColumns: ['cid', 'name', 'type', 'notnull', 'dflt_value', 'pk']
    })
};
