# SQLite IFC Queries

This document provides examples of SQLite queries for common IFC model analysis operations.

## Basic Element Queries

### Count Elements by Type
```sql
-- Count all walls
SELECT COUNT(*) FROM ifcwall;

-- Count all slabs
SELECT COUNT(*) FROM ifcslab;

-- Count all columns
SELECT COUNT(*) FROM ifccolumn;
```

### Get Element Names
```sql
-- Get wall names (excluding nulls)
SELECT Name FROM ifcwall WHERE Name IS NOT NULL;

-- Get all wall names with IDs
SELECT id, Name FROM ifcwall WHERE Name IS NOT NULL;
```

### Find External Elements
```sql
-- Find external walls
SELECT * FROM ifcwall WHERE IsExternal = 1;

-- Find non-external walls
SELECT * FROM ifcwall WHERE IsExternal = 0 OR IsExternal IS NULL;
```

## Property Queries

### Get Elements with Specific Properties
```sql
-- Get walls with fire rating
SELECT w.Name, p.Value as FireRating
FROM ifcwall w
JOIN ifcpropertysinglevalue p ON w.id = p.entity_id
WHERE p.Name = 'FireRating';

-- Get walls with specific material
SELECT w.Name, m.Name as Material
FROM ifcwall w
JOIN ifcmaterial m ON w.id = m.entity_id;
```

### Area and Volume Queries
```sql
-- Get wall areas
SELECT Name, Area FROM ifcwall WHERE Area IS NOT NULL;

-- Get total wall area
SELECT SUM(Area) as TotalArea FROM ifcwall WHERE Area IS NOT NULL;

-- Get spaces with volumes
SELECT Name, Volume FROM ifcspace WHERE Volume IS NOT NULL;
```

## Complex Queries

### Spatial Analysis
```sql
-- Get spaces by storey
SELECT s.Name as SpaceName, st.Name as StoreyName
FROM ifcspace s
JOIN ifcbuildingstorey st ON s.ContainedInStructure = st.id;

-- Get elements by building
SELECT e.type, COUNT(*) as Count
FROM ifcelement e
JOIN ifcbuilding b ON e.ContainedInStructure = b.id
GROUP BY e.type;
```

### Material Analysis
```sql
-- Get material usage by element type
SELECT e.type, m.Name as Material, COUNT(*) as Count
FROM ifcelement e
JOIN ifcmaterial m ON e.id = m.entity_id
GROUP BY e.type, m.Name
ORDER BY e.type, COUNT(*) DESC;
```

### Property Set Analysis
```sql
-- Get all property sets for walls
SELECT DISTINCT p.PropertySetName
FROM ifcwall w
JOIN ifcpropertysinglevalue p ON w.id = p.entity_id;

-- Get specific property values
SELECT w.Name, p.Name as PropertyName, p.Value
FROM ifcwall w
JOIN ifcpropertysinglevalue p ON w.id = p.entity_id
WHERE p.PropertySetName = 'Pset_WallCommon';
```

## Advanced Queries

### Hierarchical Queries
```sql
-- Get building hierarchy
SELECT b.Name as Building, st.Name as Storey, s.Name as Space, COUNT(e.id) as ElementCount
FROM ifcbuilding b
JOIN ifcbuildingstorey st ON st.ContainedInStructure = b.id
JOIN ifcspace s ON s.ContainedInStructure = st.id
LEFT JOIN ifcelement e ON e.ContainedInStructure = s.id
GROUP BY b.id, st.id, s.id
ORDER BY b.Name, st.Name, s.Name;
```

### Performance Analysis
```sql
-- Find largest elements by area
SELECT Name, type, Area
FROM ifcelement
WHERE Area IS NOT NULL
ORDER BY Area DESC
LIMIT 10;

-- Find most complex spaces by element count
SELECT s.Name, COUNT(e.id) as ElementCount
FROM ifcspace s
LEFT JOIN ifcelement e ON e.ContainedInStructure = s.id
GROUP BY s.id
ORDER BY ElementCount DESC;
```

## Query Patterns

### Filtering
```sql
-- Filter by name pattern
SELECT * FROM ifcwall WHERE Name LIKE '%exterior%';

-- Filter by property value range
SELECT * FROM ifcwall WHERE Area > 10.0;

-- Filter by multiple conditions
SELECT * FROM ifcwall
WHERE Area > 5.0
  AND IsExternal = 1
  AND Name IS NOT NULL;
```

### Aggregation
```sql
-- Group by type and count
SELECT type, COUNT(*) as Count
FROM ifcelement
GROUP BY type
ORDER BY Count DESC;

-- Group by storey and get totals
SELECT st.Name as Storey, SUM(s.Area) as TotalArea
FROM ifcspace s
JOIN ifcbuildingstorey st ON s.ContainedInStructure = st.id
WHERE s.Area IS NOT NULL
GROUP BY st.id
ORDER BY TotalArea DESC;
```

### Joining Tables
```sql
-- Join elements with their properties
SELECT e.Name, e.type, p.Name as Property, p.Value
FROM ifcelement e
LEFT JOIN ifcpropertysinglevalue p ON e.id = p.entity_id;

-- Join with materials
SELECT e.Name, m.Name as Material
FROM ifcelement e
LEFT JOIN ifcmaterial m ON e.id = m.entity_id;
```

## Common IFC Tables

The SQLite database contains tables for all IFC entity types:

- **Building Elements**: ifcwall, ifcslab, ifcbeam, ifccolumn, ifcdoor, ifcwindow, ifcroof, ifcstair
- **Spaces**: ifcspace, ifczone
- **Building Structure**: ifcbuilding, ifcbuildingstorey, ifcsite
- **Properties**: ifcpropertysinglevalue, ifcpropertyset
- **Materials**: ifcmaterial, ifcmateriallayer
- **Systems**: ifcsystem, ifcdistributionelement
- **Annotations**: ifctext, ifcdimension

Each table contains:
- `id`: Internal SQLite ID
- `expressId`: IFC STEP identifier
- `type`: IFC class name
- All IFC attributes (Name, GlobalId, etc.)
- Related entity references
