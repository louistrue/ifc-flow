# Space Analysis CSV Transform Script
# This script transforms space analysis output into CSV format for export
# Use this in a Python node after running space analysis

import json
import csv
import io
from typing import Dict, List, Any, Union

def flatten_dict(data: Dict[str, Any], parent_key: str = '', sep: str = '_') -> Dict[str, Any]:
    """
    Flatten a nested dictionary into a single level dictionary.
    """
    items = []
    for k, v in data.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key, sep=sep).items())
        elif isinstance(v, list):
            # Convert lists to JSON strings for CSV compatibility
            items.append((new_key, json.dumps(v) if v else ""))
        else:
            items.append((new_key, v))
    return dict(items)

def extract_object_values(obj: Any) -> Any:
    """
    Extract actual values from objects that might be showing as [object Ob].
    """
    if obj is None:
        return ""
    elif isinstance(obj, (str, int, float, bool)):
        return obj
    elif isinstance(obj, dict):
        # For dictionaries, try to extract meaningful values
        if 'name' in obj:
            return obj['name']
        elif 'id' in obj:
            return obj['id']
        elif 'value' in obj:
            return obj['value']
        else:
            # Return the first non-empty string value
            for key, value in obj.items():
                if isinstance(value, str) and value.strip():
                    return value
            # If no string values, return JSON representation
            return json.dumps(obj)
    elif isinstance(obj, list):
        if not obj:
            return ""
        # For lists, try to extract the first meaningful value
        if len(obj) == 1:
            return extract_object_values(obj[0])
        else:
            # Return JSON representation for multiple items
            return json.dumps([extract_object_values(item) for item in obj])
    else:
        # For other object types, try to convert to string
        try:
            return str(obj)
        except:
            return ""

def transform_space_analysis_to_csv_data(input_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Transform space analysis output into array of objects for CSV export node.
    """
    if not input_data or not isinstance(input_data, dict):
        return []
    
    # Process different types of data from space analysis
    csv_data = []
    
    # 1. Process spaces data
    if 'spaces' in input_data and isinstance(input_data['spaces'], list):
        for space in input_data['spaces']:
            if isinstance(space, dict):
                # Flatten space data
                flat_space = flatten_dict(space)
                
                # Extract and clean values
                row = {}
                for key, value in flat_space.items():
                    clean_value = extract_object_values(value)
                    row[key] = clean_value
                
                # Add data type identifier
                row['data_type'] = 'space'
                csv_data.append(row)
    
    # 2. Process element space mappings
    if 'element_space_map' in input_data and isinstance(input_data['element_space_map'], dict):
        for element_id, space_info in input_data['element_space_map'].items():
            if isinstance(space_info, dict):
                row = {
                    'data_type': 'element_space_mapping',
                    'element_id': element_id
                }
                
                # Flatten space info
                flat_info = flatten_dict(space_info)
                for key, value in flat_info.items():
                    clean_value = extract_object_values(value)
                    row[f'space_{key}'] = clean_value
                
                csv_data.append(row)
    
    # 3. Process zones data
    if 'zones' in input_data and isinstance(input_data['zones'], list):
        for zone in input_data['zones']:
            if isinstance(zone, dict):
                # Flatten zone data
                flat_zone = flatten_dict(zone)
                
                # Extract and clean values
                row = {}
                for key, value in flat_zone.items():
                    clean_value = extract_object_values(value)
                    row[key] = clean_value
                
                # Add data type identifier
                row['data_type'] = 'zone'
                csv_data.append(row)
    
    # 4. Process unassigned elements
    if 'unassigned_elements' in input_data and isinstance(input_data['unassigned_elements'], list):
        for element in input_data['unassigned_elements']:
            if isinstance(element, dict):
                row = {
                    'data_type': 'unassigned_element'
                }
                
                # Flatten element data
                flat_element = flatten_dict(element)
                for key, value in flat_element.items():
                    clean_value = extract_object_values(value)
                    row[key] = clean_value
                
                csv_data.append(row)
    
    # 5. Process summary data
    if 'summary' in input_data and isinstance(input_data['summary'], dict):
        summary_row = {
            'data_type': 'summary'
        }
        
        # Flatten summary data
        flat_summary = flatten_dict(input_data['summary'])
        for key, value in flat_summary.items():
            clean_value = extract_object_values(value)
            summary_row[key] = clean_value
        
        csv_data.append(summary_row)
    
    return csv_data

def create_space_summary_data(input_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Create a simplified array of objects with just the most important space analysis data.
    """
    if not input_data or not isinstance(input_data, dict):
        return []
    
    summary_data = []
    
    # Process spaces
    if 'spaces' in input_data and isinstance(input_data['spaces'], list):
        for space in input_data['spaces']:
            if isinstance(space, dict):
                # Extract element types
                element_types = []
                if 'elements' in space and isinstance(space['elements'], list):
                    element_types = list(set([elem.get('type', '') for elem in space['elements'] if isinstance(elem, dict)]))
                
                # Find zone information
                zone_id = ""
                zone_name = ""
                if 'zones' in input_data and isinstance(input_data['zones'], list):
                    for zone in input_data['zones']:
                        if isinstance(zone, dict) and 'spaces' in zone:
                            for zone_space in zone['spaces']:
                                if isinstance(zone_space, dict) and zone_space.get('id') == space.get('id'):
                                    zone_id = zone.get('id', '')
                                    zone_name = zone.get('name', '')
                                    break
                
                summary_data.append({
                    'space_id': space.get('id', ''),
                    'space_name': space.get('name', ''),
                    'space_type': space.get('type', ''),
                    'storey': space.get('storey', ''),
                    'area': space.get('area', 0),
                    'volume': space.get('volume', 0),
                    'element_count': space.get('element_count', 0),
                    'element_types': '; '.join(element_types),
                    'zone_id': zone_id,
                    'zone_name': zone_name
                })
    
    return summary_data

# Main execution
try:
    # Check if we have input data from a previous node
    if 'input_data' in locals() and input_data:
        print(f"Input data type: {type(input_data)}")
        print(f"Input data keys: {list(input_data.keys()) if isinstance(input_data, dict) else 'Not a dict'}")
        
        # Handle different types of input data
        if isinstance(input_data, dict):
            # Debug: Print all keys to understand the structure
            print(f"Available keys: {list(input_data.keys())}")
            
            # Check if this is space analysis data with elementSpaceMap
            if 'elementSpaceMap' in input_data and isinstance(input_data['elementSpaceMap'], dict):
                print("Detected elementSpaceMap data - converting to CSV format")
                csv_data = []
                
                for element_id, space_info in input_data['elementSpaceMap'].items():
                    if isinstance(space_info, dict):
                        csv_data.append({
                            'element_id': element_id,
                            'space_name': space_info.get('spaceName', ''),
                            'space_type': space_info.get('spaceType', ''),
                            'space_id': space_info.get('spaceId', ''),
                            'storey': space_info.get('storey', '')
                        })
                
                result = csv_data
                print(f"ElementSpaceMap CSV data: {len(csv_data)} rows")
                
            # Check if this is space analysis data
            elif 'spaces' in input_data or 'element_space_map' in input_data:
                print("Detected space analysis data")
                # Create both detailed and summary data arrays for CSV export
                detailed_data = transform_space_analysis_to_csv_data(input_data)
                summary_data = create_space_summary_data(input_data)
                
                # Return the summary data as the main result (most useful for CSV export)
                result = summary_data
                
                print("CSV transformation complete!")
                print(f"Summary data: {len(summary_data)} rows")
                print(f"Detailed data: {len(detailed_data)} rows")
                
            # Check if this is room assignment data (from add-room-info-example.py)
            elif 'details' in input_data and isinstance(input_data['details'], list):
                print("Detected room assignment data - converting to CSV format")
                csv_data = []
                
                for detail in input_data['details']:
                    if isinstance(detail, dict) and 'space_assignment' in detail:
                        space_assignment = detail['space_assignment']
                        csv_data.append({
                            'element_id': detail.get('id', ''),
                            'element_type': detail.get('type', ''),
                            'element_name': detail.get('name', ''),
                            'space_name': space_assignment.get('space_name', ''),
                            'space_type': space_assignment.get('space_type', ''),
                            'space_id': space_assignment.get('space_id', ''),
                            'storey': space_assignment.get('storey', '')
                        })
                
                result = csv_data
                print(f"Room assignment CSV data: {len(csv_data)} rows")
                
            # Check if this is elements_by_space data from room assignment
            elif 'elements_by_space' in input_data and isinstance(input_data['elements_by_space'], dict):
                print("Detected elements_by_space data - converting to CSV format")
                csv_data = []
                
                for space_name, elements in input_data['elements_by_space'].items():
                    for element in elements:
                        csv_data.append({
                            'space_name': space_name,
                            'element_id': element.get('id', ''),
                            'element_type': element.get('type', ''),
                            'element_name': element.get('name', '')
                        })
                
                result = csv_data
                print(f"Elements by space CSV data: {len(csv_data)} rows")
                
            # Check if this is summary data from room assignment
            elif 'summary' in input_data and isinstance(input_data['summary'], dict):
                print("Detected summary data - converting to CSV format")
                summary = input_data['summary']
                csv_data = [{
                    'total_processed': summary.get('total_processed', 0),
                    'successfully_updated': summary.get('successfully_updated', 0),
                    'skipped': summary.get('skipped', 0),
                    'spaces_found': summary.get('spaces_found', 0),
                    'storeys_found': summary.get('storeys_found', 0)
                }]
                
                result = csv_data
                print(f"Summary CSV data: {len(csv_data)} rows")
                
                
            else:
                print("Unknown data format - attempting to flatten")
                print(f"Input data structure: {input_data}")
                
                # Try to flatten any object data
                csv_data = []
                if isinstance(input_data, dict):
                    # Convert single object to array
                    csv_data.append(input_data)
                elif isinstance(input_data, list):
                    csv_data = input_data
                
                result = csv_data
                print(f"Flattened CSV data: {len(csv_data)} rows")
        
        elif isinstance(input_data, list):
            print("Detected list input - using directly")
            result = input_data
            print(f"List CSV data: {len(input_data)} rows")
            
        else:
            print("Unknown input type - creating single row")
            result = [{'value': str(input_data)}]
        
    else:
        # If no input data, return empty array instead of error object
        print("No input data provided")
        result = []
        
except Exception as e:
    print(f"Error during CSV transformation: {e}")
    import traceback
    traceback.print_exc()
    result = {
        "error": str(e),
        "message": "Failed to transform space analysis data to CSV format"
    }

# Return the result - this should be an array of objects for CSV export node
result
