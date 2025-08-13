# Debug script to check what spatial elements exist in the IFC file
# Use this in a Python node to understand the IFC structure

import ifcopenshell

# The IFC model is provided as 'ifc_file' by the system
model = ifc_file

# Check what we have
result = {
    "file_info": {
        "schema": str(model.schema) if hasattr(model, 'schema') else "Unknown",
        "total_elements": len(list(model))
    },
    "spatial_elements": {},
    "spatial_relationships": {},
    "sample_elements": []
}

# Check for all spatial element types
spatial_types = [
    "IfcSpace",
    "IfcZone", 
    "IfcBuildingStorey",
    "IfcBuilding",
    "IfcSite",
    "IfcSpatialZone",
]

for spatial_type in spatial_types:
    elements = model.by_type(spatial_type)
    if elements:
        result["spatial_elements"][spatial_type] = {
            "count": len(elements),
            "examples": []
        }
        # Get first 3 examples
        for elem in elements[:3]:
            result["spatial_elements"][spatial_type]["examples"].append({
                "id": elem.GlobalId,
                "name": elem.Name if hasattr(elem, 'Name') else None,
                "type": elem.ObjectType if hasattr(elem, 'ObjectType') else None
            })

# Check spatial containment relationships
rel_types = [
    "IfcRelContainedInSpatialStructure",
    "IfcRelAggregates",
    "IfcRelAssignsToGroup"
]

for rel_type in rel_types:
    rels = model.by_type(rel_type)
    if rels:
        result["spatial_relationships"][rel_type] = len(rels)

# Get sample of regular elements to see what we're working with
element_types = ["IfcWall", "IfcSlab", "IfcColumn", "IfcBeam", "IfcDoor", "IfcWindow"]
for elem_type in element_types:
    elems = model.by_type(elem_type)
    if elems and len(elems) > 0:
        sample = elems[0]
        elem_info = {
            "type": elem_type,
            "count": len(elems),
            "sample": {
                "id": sample.GlobalId,
                "name": sample.Name if hasattr(sample, 'Name') else None,
                "contained_in": None
            }
        }
        
        # Check if this element is contained in any spatial structure
        for rel in model.by_type("IfcRelContainedInSpatialStructure"):
            if sample in rel.RelatedElements:
                containing = rel.RelatingStructure
                elem_info["sample"]["contained_in"] = {
                    "type": containing.is_a(),
                    "name": containing.Name if hasattr(containing, 'Name') else None,
                    "id": containing.GlobalId
                }
                break
        
        result["sample_elements"].append(elem_info)

# If no spaces found, check if elements are at least assigned to storeys
if not result["spatial_elements"].get("IfcSpace"):
    storeys = model.by_type("IfcBuildingStorey")
    if storeys:
        result["storey_analysis"] = {
            "count": len(storeys),
            "storeys": []
        }
        for storey in storeys:
            storey_info = {
                "name": storey.Name if hasattr(storey, 'Name') else None,
                "id": storey.GlobalId,
                "contained_elements": 0
            }
            
            # Count elements in this storey
            for rel in model.by_type("IfcRelContainedInSpatialStructure"):
                if rel.RelatingStructure == storey:
                    storey_info["contained_elements"] = len(rel.RelatedElements)
            
            result["storey_analysis"]["storeys"].append(storey_info)

# Summary message
if result["spatial_elements"].get("IfcSpace"):
    result["message"] = f"Found {result['spatial_elements']['IfcSpace']['count']} spaces in the model"
elif result["spatial_elements"].get("IfcBuildingStorey"):
    result["message"] = f"No spaces found, but model has {result['spatial_elements']['IfcBuildingStorey']['count']} building storeys"
else:
    result["message"] = "No spatial structure found in this IFC file"

result
