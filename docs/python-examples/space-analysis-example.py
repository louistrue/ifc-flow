# Space Analysis Example for Python Node
# This script demonstrates how to perform space analysis using IfcOpenShell
# in the Python node. Copy this code into a Python node to use it.

import ifcopenshell
import ifcopenshell.util.element
import json

# The IFC model is provided as 'ifc_file' by the system
model = ifc_file

# Initialize result structure
result = {
    "spaces": [],
    "elements_in_spaces": {},
    "unassigned_elements": [],
    "zones": [],
    "summary": {}
}

try:
    # Get all spaces, zones, and building storeys
    spaces = model.by_type("IfcSpace")
    zones = model.by_type("IfcZone")
    storeys = model.by_type("IfcBuildingStorey")
    
    print(f"Found {len(spaces)} spaces, {len(zones)} zones, {len(storeys)} storeys")
    
    # Process each space
    space_data = []
    element_space_map = {}
    
    for space in spaces:
        space_info = {
            "id": space.GlobalId,
            "name": space.Name or f"Space_{space.GlobalId[:8]}",
            "type": space.ObjectType or "Generic",
            "description": space.Description or "",
            "storey": None,
            "elements": [],
            "area": 0,
            "volume": 0,
            "height": 0
        }
        
        # Find which storey contains this space
        for rel in model.by_type("IfcRelAggregates"):
            if space in rel.RelatedObjects and rel.RelatingObject.is_a("IfcBuildingStorey"):
                space_info["storey"] = rel.RelatingObject.Name
                break
        
        # Get space properties and quantities
        try:
            psets = ifcopenshell.util.element.get_psets(space)
            
            # Extract quantities if available
            if "Qto_SpaceBaseQuantities" in psets:
                quantities = psets["Qto_SpaceBaseQuantities"]
                space_info["area"] = quantities.get("NetFloorArea", 0)
                space_info["volume"] = quantities.get("NetVolume", 0)
                space_info["height"] = quantities.get("Height", 0)
            
            # Extract common properties
            if "Pset_SpaceCommon" in psets:
                common = psets["Pset_SpaceCommon"]
                space_info["occupancy_type"] = common.get("OccupancyType", "")
                space_info["occupancy_number"] = common.get("OccupancyNumber", 0)
        except Exception as e:
            print(f"Error getting properties for space {space.Name}: {e}")
        
        # Find elements contained in this space
        contained_elements = []
        for rel in model.by_type("IfcRelContainedInSpatialStructure"):
            if rel.RelatingStructure == space:
                for element in rel.RelatedElements:
                    element_info = {
                        "id": element.GlobalId,
                        "type": element.is_a(),
                        "name": element.Name or f"{element.is_a()}_{element.GlobalId[:8]}"
                    }
                    contained_elements.append(element_info)
                    
                    # Map element to space
                    element_space_map[element.GlobalId] = {
                        "space_id": space.GlobalId,
                        "space_name": space_info["name"],
                        "space_type": space_info["type"],
                        "storey": space_info["storey"]
                    }
        
        space_info["elements"] = contained_elements
        space_info["element_count"] = len(contained_elements)
        space_data.append(space_info)
    
    # Process zones
    zone_data = []
    for zone in zones:
        zone_info = {
            "id": zone.GlobalId,
            "name": zone.Name or f"Zone_{zone.GlobalId[:8]}",
            "type": zone.ObjectType or "Generic",
            "description": zone.Description or "",
            "spaces": []
        }
        
        # Find spaces in this zone
        for rel in model.by_type("IfcRelAssignsToGroup"):
            if rel.RelatingGroup == zone:
                for obj in rel.RelatedObjects:
                    if obj.is_a("IfcSpace"):
                        zone_info["spaces"].append({
                            "id": obj.GlobalId,
                            "name": obj.Name or ""
                        })
        
        zone_data.append(zone_info)
    
    # Find unassigned elements (not in any space)
    all_elements = model.by_type("IfcElement")
    unassigned = []
    
    for element in all_elements:
        if element.GlobalId not in element_space_map:
            # Check if it's in a storey at least
            in_storey = False
            for rel in model.by_type("IfcRelContainedInSpatialStructure"):
                if element in rel.RelatedElements:
                    in_storey = True
                    break
            
            if not in_storey:
                unassigned.append({
                    "id": element.GlobalId,
                    "type": element.is_a(),
                    "name": element.Name or f"{element.is_a()}_{element.GlobalId[:8]}"
                })
    
    # Calculate summary statistics
    total_area = sum(s["area"] for s in space_data)
    total_volume = sum(s["volume"] for s in space_data)
    avg_height = sum(s["height"] for s in space_data) / len(space_data) if space_data else 0
    
    # Categorize spaces by type
    space_types = {}
    for space in space_data:
        space_type = space["type"]
        if space_type not in space_types:
            space_types[space_type] = {
                "count": 0,
                "total_area": 0,
                "spaces": []
            }
        space_types[space_type]["count"] += 1
        space_types[space_type]["total_area"] += space["area"]
        space_types[space_type]["spaces"].append(space["name"])
    
    # Identify circulation spaces
    circulation_keywords = ["corridor", "hallway", "lobby", "stair", "elevator", "circulation"]
    circulation_spaces = []
    program_spaces = []
    
    for space in space_data:
        is_circulation = any(
            keyword in (space["name"] or "").lower() or 
            keyword in (space["type"] or "").lower() 
            for keyword in circulation_keywords
        )
        
        if is_circulation:
            circulation_spaces.append(space)
        else:
            program_spaces.append(space)
    
    circulation_area = sum(s["area"] for s in circulation_spaces)
    program_area = sum(s["area"] for s in program_spaces)
    
    # Build final result
    result = {
        "spaces": space_data,
        "element_space_map": element_space_map,
        "zones": zone_data,
        "unassigned_elements": unassigned,
        "summary": {
            "total_spaces": len(spaces),
            "total_zones": len(zones),
            "total_storeys": len(storeys),
            "assigned_elements": len(element_space_map),
            "unassigned_elements": len(unassigned),
            "total_area": round(total_area, 2),
            "total_volume": round(total_volume, 2),
            "average_height": round(avg_height, 2),
            "space_types": space_types,
            "circulation": {
                "count": len(circulation_spaces),
                "area": round(circulation_area, 2),
                "percentage": round(circulation_area / total_area * 100, 1) if total_area > 0 else 0
            },
            "program": {
                "count": len(program_spaces),
                "area": round(program_area, 2),
                "percentage": round(program_area / total_area * 100, 1) if total_area > 0 else 0
            }
        }
    }
    
    # Print summary for debugging
    print(f"Analysis complete:")
    print(f"- {len(spaces)} spaces analyzed")
    print(f"- {len(element_space_map)} elements assigned to spaces")
    print(f"- {len(unassigned)} unassigned elements")
    print(f"- Total area: {total_area:.2f} m²")
    print(f"- Circulation: {circulation_area:.2f} m² ({result['summary']['circulation']['percentage']:.1f}%)")
    print(f"- Program: {program_area:.2f} m² ({result['summary']['program']['percentage']:.1f}%)")
    
except Exception as e:
    print(f"Error during space analysis: {e}")
    import traceback
    traceback.print_exc()
    result = {
        "error": str(e),
        "message": "Space analysis failed. Check that the IFC file contains space definitions."
    }

# The result will be available as output from the Python node
result
