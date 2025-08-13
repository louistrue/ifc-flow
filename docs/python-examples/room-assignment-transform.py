"""
Transform Room Assignment Results to Property Mappings for Walls
Uses GlobalId as the key for element identification (IFC standard)
"""

import json

print("=== Room Assignment Transform (GlobalId) ===")

# Check if this is room assignment data
if input_data and isinstance(input_data, dict) and 'elementSpaceMap' in input_data:
    print("✓ Found room assignment data")
    element_space_map = input_data['elementSpaceMap']
    print(f"  Element-space map has {len(element_space_map)} entries")
    
    # The elementSpaceMap already uses GlobalIds as keys!
    # We just need to filter for walls
    
    # Get wall GlobalIds from the IFC model
    wall_global_ids = set()
    
    if model and hasattr(model, 'by_type'):
        # Get all walls from the IFC model
        walls = model.by_type('IfcWall')
        for wall in walls:
            if hasattr(wall, 'GlobalId'):
                wall_global_ids.add(wall.GlobalId)
        print(f"  Found {len(wall_global_ids)} walls in IFC model")
    
    # Create mapping for walls only
    wall_mappings = {}
    walls_found = 0
    other_elements_skipped = 0
    
    # Show first few entries for debugging
    sample_count = 0
    
    for global_id, space_info in element_space_map.items():
        # Check if this GlobalId belongs to a wall
        if global_id in wall_global_ids:
            space_name = space_info.get('spaceName', '')
            # Only add mapping if space name is valid
            if space_name and space_name != 'None':
                wall_mappings[global_id] = space_name
                walls_found += 1
                if sample_count < 3:  # Show first 3 mappings
                    print(f"    Wall {global_id[:8]}... → Room: {space_name}")
                    sample_count += 1
        else:
            other_elements_skipped += 1
    
    print(f"\n✓ Summary:")
    print(f"  - Created mappings for {walls_found} walls")
    print(f"  - Skipped {other_elements_skipped} non-wall elements")
    print(f"  - Total wall-to-room mappings: {len(wall_mappings)}")
    
    # Output in the format expected by Property Node
    result = {
        'mappings': wall_mappings,
        'metadata': {
            'wallsFound': walls_found,
            'otherElementsSkipped': other_elements_skipped,
            'totalMappings': len(wall_mappings)
        }
    }
    
else:
    print("⚠ Input is not room assignment data")
    # Pass through empty mappings
    result = {
        'mappings': {},
        'metadata': {
            'error': 'No room assignment data found'
        }
    }

print("=== Transform Complete ===")

# The result variable is what gets returned
result
