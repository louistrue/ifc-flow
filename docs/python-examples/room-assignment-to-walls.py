"""
Transform Room Assignment Results to Property Mappings for Walls

This script takes room assignment analysis results and transforms them into
a mapping format that the Property Node can use to assign room names to walls.

Input: Room assignment data from Analysis Node (with room_assignment metric)
Output: Mapping of wall GlobalIds to room names for Property Node

Usage:
1. Connect Analysis Node (room_assignment) → Python Node → Property Node → Export Node
2. Set Property Node to:
   - Action: Set
   - Property Name: SpaceName (or RoomName)
   - Target Pset: Pset_WallCommon
"""

import json

# Get input data from the Analysis Node
input_data = inputs.get('input', {})

# Check if this is room assignment data
if 'elementSpaceMap' in input_data:
    element_space_map = input_data['elementSpaceMap']
    
    # Get the model to access element information
    model = inputs.get('model', {})
    elements = model.get('elements', [])
    
    # Create a mapping of element IDs to their GlobalIds and types
    element_lookup = {}
    for elem in elements:
        elem_id = elem.get('id', '')
        global_id = elem.get('properties', {}).get('GlobalId', '')
        elem_type = elem.get('type', '')
        if elem_id and global_id:
            element_lookup[elem_id] = {
                'GlobalId': global_id,
                'type': elem_type
            }
    
    # Create mapping for walls only
    wall_mappings = {}
    walls_found = 0
    other_elements_skipped = 0
    
    for elem_id, space_info in element_space_map.items():
        if elem_id in element_lookup:
            elem_info = element_lookup[elem_id]
            # Only include walls
            if elem_info['type'] == 'IfcWall':
                global_id = elem_info['GlobalId']
                space_name = space_info.get('spaceName', '')
                # Only add mapping if space name is valid
                if space_name and space_name != 'None':
                    wall_mappings[global_id] = space_name
                    walls_found += 1
            else:
                other_elements_skipped += 1
    
    # Output in the format expected by Property Node
    # The Property Node will detect the 'mappings' key and apply element-specific values
    output = {
        'mappings': wall_mappings,
        'metadata': {
            'wallsFound': walls_found,
            'otherElementsSkipped': other_elements_skipped,
            'totalMappings': len(wall_mappings)
        }
    }
    
    print(f"✓ Created mappings for {walls_found} walls")
    print(f"✓ Skipped {other_elements_skipped} non-wall elements")
    print(f"✓ Total room-to-wall mappings: {len(wall_mappings)}")
    
else:
    # Not room assignment data - pass through
    output = input_data
    print("⚠ Input is not room assignment data - passing through")

# Return the transformed data
output
