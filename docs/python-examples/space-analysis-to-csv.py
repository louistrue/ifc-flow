# Space Analysis to CSV Export
# This script transforms space analysis output into CSV-ready format
# Use this in a Python node after running space analysis
# Does NOT need IFC model - works purely with analysis node output

# Initialize result as an array for CSV export
result = []

try:
    # Get the analysis data from the previous node
    if input_data and isinstance(input_data, dict):
        print("Converting space analysis data to CSV format...")
        
        # Extract elementSpaceMap from the analysis node output
        element_space_map = input_data.get("elementSpaceMap", {})
        
        if not element_space_map:
            print("Warning: No elementSpaceMap found in input data")
            result = []
        else:
            print(f"Found {len(element_space_map)} element assignments")
            
            # Convert each element assignment to a CSV row
            for element_id, space_info in element_space_map.items():
                csv_row = {
                    "element_id": element_id,
                    "space_id": space_info.get("spaceId", ""),
                    "space_name": space_info.get("spaceName", ""),
                    "space_type": space_info.get("spaceType", ""),
                    "storey": space_info.get("storey", "")
                }
                result.append(csv_row)
            
            print(f"CSV export ready: {len(result)} rows")
            unique_spaces = len(set(row['space_name'] for row in result))
            unique_storeys = len(set(row['storey'] for row in result if row['storey']))
            print(f"- Elements: {len(result)}")
            print(f"- Spaces: {unique_spaces}")
            print(f"- Storeys: {unique_storeys}")
    else:
        print("No input data provided")
        result = []
    
except Exception as e:
    print(f"Error during CSV transformation: {e}")
    import traceback
    traceback.print_exc()
    # Return empty array on error
    result = []

# Return the result as an array of objects for CSV export
result

