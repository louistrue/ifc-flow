# Space Analysis to Property Values Transform (Advanced)
# This script transforms space analysis output into a format suitable for the Property Node
# Allows setting multiple properties from space analysis data
# 
# Use this in a Python node between Space Analysis and Property Node:
# Space Analysis → Python Node (this script) → Property Node (Set action)

# CONFIGURATION: Choose what to extract from space analysis
# Options: "spaceName", "spaceType", "storey", "spaceId", or a custom format
PROPERTY_TO_EXTRACT = "spaceName"  # Default: room name

# You can also create custom formats:
# - "spaceName_storey" -> "B102 (Level 1)"
# - "storey_spaceName" -> "Level 1 - B102"
# - "spaceType_spaceName" -> "Generic: B102"

def format_property_value(space_info, format_type):
    """
    Format the property value based on the format type
    """
    space_name = space_info.get("spaceName", "")
    space_type = space_info.get("spaceType", "")
    storey = space_info.get("storey", "")
    space_id = space_info.get("spaceId", "")
    
    # Handle different format types
    if format_type == "spaceName":
        return space_name
    elif format_type == "spaceType":
        return space_type
    elif format_type == "storey":
        return storey
    elif format_type == "spaceId":
        return space_id
    elif format_type == "spaceName_storey":
        return f"{space_name} ({storey})" if storey else space_name
    elif format_type == "storey_spaceName":
        return f"{storey} - {space_name}" if storey else space_name
    elif format_type == "spaceType_spaceName":
        return f"{space_type}: {space_name}" if space_type else space_name
    else:
        # Default to space name
        return space_name

# Initialize result as a mapping of element ID to property value
result = {}

try:
    # Get the analysis data from the previous node
    if input_data and isinstance(input_data, dict):
        print("Converting space analysis data to property values...")
        print(f"Property format: {PROPERTY_TO_EXTRACT}")
        
        # Extract elementSpaceMap from the analysis node output
        element_space_map = input_data.get("elementSpaceMap", {})
        
        if not element_space_map:
            print("Warning: No elementSpaceMap found in input data")
            result = {}
        else:
            print(f"Found {len(element_space_map)} element assignments")
            
            # Convert each element assignment to a mapping: elementId -> propertyValue
            for element_id, space_info in element_space_map.items():
                property_value = format_property_value(space_info, PROPERTY_TO_EXTRACT)
                
                if property_value:
                    result[element_id] = property_value
            
            print(f"Property mapping ready: {len(result)} elements")
            unique_values = len(set(result.values()))
            print(f"- Elements: {len(result)}")
            print(f"- Unique values: {unique_values}")
            print(f"Sample mapping:")
            for i, (elem_id, value) in enumerate(list(result.items())[:3]):
                print(f"  {elem_id}: {value}")
    else:
        print("No input data provided")
        result = {}
    
except Exception as e:
    print(f"Error during transformation: {e}")
    import traceback
    traceback.print_exc()
    # Return empty mapping on error
    result = {}

# Return the result wrapped in the format expected by Property Node
# The Property Node expects: { "mappings": { "elementId": "value", ... } }
# This tells it to use element-specific values instead of setting the same value for all
result = {"mappings": result}
result

