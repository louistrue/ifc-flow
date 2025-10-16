# Simple Room Assignment Script
# Easy example for assigning room names to elements
# 
# Workflow: Space Analysis → Python Node (this script) → Property Node → Export

# Simple: Just get room names from space analysis
result = {}

if input_data and isinstance(input_data, dict):
    print("Getting room assignments...")
    
    # Get the element-to-room mapping from space analysis
    element_space_map = input_data.get("elementSpaceMap", {})
    
    if element_space_map:
        print(f"Found {len(element_space_map)} elements with room assignments")
        
        # Create simple mapping: element ID → room name
        for element_id, space_info in element_space_map.items():
            room_name = space_info.get("spaceName", "")
            if room_name:
                result[element_id] = room_name
        
        print(f"Assigned {len(result)} elements to rooms")
        print(f"Sample rooms: {list(set(result.values()))[:5]}")
    else:
        print("No room assignments found")
else:
    print("No input data")

# Return in format expected by Property Node
result = {"mappings": result}
result


