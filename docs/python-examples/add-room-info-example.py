# Add Room Information to Elements Example
# This script shows how to add space/room assignments as properties to elements
# Use this in a Python node after running space analysis

import ifcopenshell
import ifcopenshell.util.element

# Access the IFC model and input data
model = ifc_file

# If you have input_data from a previous node (e.g., space analysis results)
# it will be available as input_data
space_assignments = None
if input_data and isinstance(input_data, dict):
    # Check if we have space assignment data
    if "elementSpaceMap" in input_data:
        space_assignments = input_data["elementSpaceMap"]
    elif "element_space_map" in input_data:
        space_assignments = input_data["element_space_map"]

# Initialize result
result = {
    "elements_updated": 0,
    "elements_skipped": 0,
    "details": []
}

try:
    if not space_assignments:
        # If no input data, perform our own space analysis
        print("No space assignment data provided, performing analysis...")
        
        spaces = model.by_type("IfcSpace")
        space_assignments = {}
        
        for space in spaces:
            space_name = space.Name or f"Space_{space.GlobalId[:8]}"
            space_type = space.ObjectType or "Generic"
            
            # Find storey
            storey_name = None
            for rel in model.by_type("IfcRelAggregates"):
                if space in rel.RelatedObjects and rel.RelatingObject.is_a("IfcBuildingStorey"):
                    storey_name = rel.RelatingObject.Name
                    break
            
            # Find elements in this space
            for rel in model.by_type("IfcRelContainedInSpatialStructure"):
                if rel.RelatingStructure == space:
                    for element in rel.RelatedElements:
                        space_assignments[element.GlobalId] = {
                            "spaceName": space_name,
                            "spaceType": space_type,
                            "spaceId": space.GlobalId,
                            "storey": storey_name
                        }
    
    # Now add the space information as properties to elements
    print(f"Adding space assignments to {len(space_assignments)} elements...")
    
    for element_guid, space_info in space_assignments.items():
        try:
            # Find the element in the model
            element = model.by_guid(element_guid)
            if not element:
                result["elements_skipped"] += 1
                continue
            
            # Create a custom property set for space assignment
            # Note: In a real implementation, you would use the IFC API to create proper property sets
            # This is a simplified example showing the concept
            
            element_info = {
                "id": element.GlobalId,
                "type": element.is_a(),
                "name": element.Name or "",
                "space_assignment": {
                    "space_name": space_info.get("spaceName", ""),
                    "space_type": space_info.get("spaceType", ""),
                    "space_id": space_info.get("spaceId", ""),
                    "storey": space_info.get("storey", "")
                }
            }
            
            result["details"].append(element_info)
            result["elements_updated"] += 1
            
            # In practice, you would use ifcopenshell.api to add properties:
            # import ifcopenshell.api
            # ifcopenshell.api.run("pset.add_pset", model, 
            #     product=element, 
            #     name="Pset_SpaceAssignment",
            #     properties={
            #         "AssignedToSpace": space_info.get("spaceName", ""),
            #         "SpaceType": space_info.get("spaceType", ""),
            #         "BuildingStorey": space_info.get("storey", "")
            #     }
            # )
            
        except Exception as e:
            print(f"Error processing element {element_guid}: {e}")
            result["elements_skipped"] += 1
    
    # Create a summary
    result["summary"] = {
        "total_processed": len(space_assignments),
        "successfully_updated": result["elements_updated"],
        "skipped": result["elements_skipped"],
        "spaces_found": len(set(s.get("spaceName", "") for s in space_assignments.values())),
        "storeys_found": len(set(s.get("storey", "") for s in space_assignments.values() if s.get("storey")))
    }
    
    # Group elements by space for easy viewing
    elements_by_space = {}
    for detail in result["details"]:
        space_name = detail["space_assignment"]["space_name"]
        if space_name not in elements_by_space:
            elements_by_space[space_name] = []
        elements_by_space[space_name].append({
            "id": detail["id"],
            "type": detail["type"],
            "name": detail["name"]
        })
    
    result["elements_by_space"] = elements_by_space
    
    print(f"Space assignment complete:")
    print(f"- Updated: {result['elements_updated']} elements")
    print(f"- Skipped: {result['elements_skipped']} elements")
    print(f"- Spaces: {result['summary']['spaces_found']}")
    print(f"- Storeys: {result['summary']['storeys_found']}")
    
except Exception as e:
    print(f"Error during space assignment: {e}")
    import traceback
    traceback.print_exc()
    result = {
        "error": str(e),
        "message": "Failed to add space assignments to elements"
    }

# Return the result
result
