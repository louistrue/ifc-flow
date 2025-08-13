# Data Transform Node Examples

The Data Transform Node provides a visual, code-free way to transform data from any upstream node. It replaces the need for custom Python scripts in many common scenarios.

## Replacing Room Assignment Transform Script

### Before: Python Script Approach
```python
# room-assignment-transform.py
if input_data and isinstance(input_data, dict) and 'elementSpaceMap' in input_data:
    element_space_map = input_data['elementSpaceMap']
    
    # Get wall GlobalIds from the IFC model
    wall_global_ids = set()
    if model and hasattr(model, 'by_type'):
        walls = model.by_type('IfcWall')
        for wall in walls:
            if hasattr(wall, 'GlobalId'):
                wall_global_ids.add(wall.GlobalId)
    
    # Create mapping for walls only
    wall_mappings = {}
    for global_id, space_info in element_space_map.items():
        if global_id in wall_global_ids:
            space_name = space_info.get('spaceName', '')
            if space_name and space_name != 'None':
                wall_mappings[global_id] = space_name
    
    result = {
        'mappings': wall_mappings,
        'metadata': { ... }
    }
```

### After: Data Transform Node
**Workflow:** IFC → Analysis (room_assignment) → **Data Transform** → Property → Export

**Data Transform Configuration:**
1. **Preset:** "Room Assignment → Wall Mappings"
2. **Steps:**
   - Filter: `type` in `["IfcWall", "IfcWallStandardCase"]`
   - To Mapping: `GlobalId` → `spaceName`, skip empty values

**Result:** Same `{ mappings: { GlobalId: spaceName } }` output, ready for Property Node.

## Common Transform Patterns

### 1. Element Type Grouping
**Input:** Array of IFC elements
**Steps:**
- Group By: `type`
- Aggregates: `id` → `count`

**Output:** 
```json
{
  "IfcWall": { "type": "IfcWall", "items": [...], "id_count": 45 },
  "IfcDoor": { "type": "IfcDoor", "items": [...], "id_count": 12 }
}
```

### 2. Property Value Extraction
**Input:** Property node results
**Steps:**
- Pick: `["properties.GlobalId", "propertyInfo.value"]`
- To Mapping: `properties.GlobalId` → `propertyInfo.value`

**Output:** `{ mappings: { "GlobalId": "PropertyValue" } }`

### 3. Space Analysis Summary
**Input:** Analysis node (space_metrics)
**Steps:**
- Map: `{ name: "name", area: "quantities.area", type: "type" }`
- Sort: `area` desc
- Limit: 10

**Output:** Top 10 spaces by area with clean field names.

### 4. CSV Data Integration
**Input A:** IFC elements, **Input B:** Parameter node (CSV data)
**Steps:**
- Join: `properties.GlobalId` (left join)
- Pick: `["properties.GlobalId", "type", "csvField1", "csvField2"]`

**Output:** Elements enriched with CSV data.

## Advanced Configurations

### Multi-Step Pipeline Example
```json
{
  "steps": [
    {
      "type": "filter",
      "config": {
        "conditions": [
          { "path": "type", "operator": "in", "value": ["IfcWall", "IfcSlab"] },
          { "path": "properties.IsExternal", "operator": "equals", "value": true }
        ],
        "logic": "and"
      }
    },
    {
      "type": "map",
      "config": {
        "mappings": {
          "elementId": { "source": "properties.GlobalId" },
          "elementType": { "source": "type", "transform": "title" },
          "isExternal": { "source": "properties.IsExternal", "default": false }
        }
      }
    },
    {
      "type": "groupBy",
      "config": {
        "keyPath": "elementType",
        "aggregates": { "elementId": "count" }
      }
    }
  ]
}
```

## Benefits Over Python Scripts

1. **Visual Configuration:** No code required, visual step-by-step pipeline
2. **Live Preview:** See input/output counts and sample data in real-time
3. **Reusable:** Save and share transform configurations
4. **Safe:** No code execution, just data transformations
5. **Fast:** Pure TypeScript execution, no Python worker overhead
6. **Debuggable:** Step-by-step execution with warnings and error messages

## Migration Guide

### From Python to Data Transform

1. **Identify the transformation logic** in your Python script
2. **Choose appropriate steps:**
   - Data filtering → Filter step
   - Field mapping → Map step
   - Creating property mappings → To Mapping step
   - Grouping/aggregation → Group By step
3. **Configure each step** using the visual editor
4. **Test with sample data** using the preview functionality
5. **Connect to downstream nodes** (Property, Export, etc.)

### Common Python Patterns → Transform Steps

| Python Pattern | Transform Step | Configuration |
|---|---|---|
| `if element.type in ['IfcWall']` | Filter | `type` in `["IfcWall"]` |
| `{id: element.GlobalId for element in elements}` | To Mapping | `GlobalId` → `GlobalId` |
| `element.properties.get('Name', 'Default')` | Map | `name: { source: "properties.Name", default: "Default" }` |
| `elements.sort(key=lambda x: x.area)` | Sort | `area` asc |
| `elements[:10]` | Limit | limit: 10 |
| `str(value).upper()` | Map | transform: "upper" |

The Data Transform Node provides the same power as Python scripts but with a visual, user-friendly interface that's accessible to non-programmers while being faster and safer to execute.
