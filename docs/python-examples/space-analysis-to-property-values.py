# Space Analysis to Property Values Transform
# This script transforms space analysis output into a format suitable for the Property Node
# to set room-related properties on elements
# 
# Use this in a Python node between Space Analysis and Property Node:
# Space Analysis → Python Node (this script) → Property Node (Set action)

# Initialize result as a mapping of element ID to room name
result = {}

try:
    # Get the analysis data from the previous node
    if input_data and isinstance(input_data, dict):
        print("Converting space analysis data to property values...")
        
        # Extract elementSpaceMap from the analysis node output
        element_space_map = input_data.get("elementSpaceMap", {})
        
        if not element_space_map:
            print("Warning: No elementSpaceMap found in input data")
            result = {}
        else:
            print(f"Found {len(element_space_map)} element assignments")
            
            # Convert each element assignment to a mapping: elementId -> roomName
            # The property node will use this to set different values per element
            for element_id, space_info in element_space_map.items():
                # You can change what property to extract:
                # - spaceName: the room name (e.g., "B102")
                # - spaceType: the space type (e.g., "Generic")
                # - storey: the building storey (e.g., "Level 1")
                # - spaceId: the unique space ID
                
                room_name = space_info.get("spaceName", "")
                if room_name:
                    result[element_id] = room_name
            
            print(f"Property mapping ready: {len(result)} elements")
            unique_rooms = len(set(result.values()))
            print(f"- Elements: {len(result)}")
            print(f"- Unique rooms: {unique_rooms}")
            print(f"Sample mapping: {dict(list(result.items())[:3])}")
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

