# Inspect IFC Data Script
# Simple script to explore what's in your IFC model
# 
# Workflow: IFC Node → Python Node (this script) → Watch Node

# Simple: Show what's available in the IFC data
result = {}

if input_data and isinstance(input_data, dict):
    print("=== IFC Data Inspection ===")
    
    # Show top-level structure
    print(f"Top-level keys: {list(input_data.keys())}")
    
    # Check if it's a model object
    if "elements" in input_data:
        elements = input_data["elements"]
        print(f"\nFound {len(elements)} elements")
        
        # Show element types
        element_types = {}
        for element in elements:
            elem_type = element.get("type", "Unknown")
            element_types[elem_type] = element_types.get(elem_type, 0) + 1
        
        print(f"\nElement types:")
        for elem_type, count in sorted(element_types.items()):
            print(f"  {elem_type}: {count}")
        
        # Show properties from first few elements
        print(f"\nSample element structure:")
        for i, element in enumerate(elements[:3]):
            print(f"\nElement {i+1}:")
            print(f"  ID: {element.get('expressId', 'N/A')}")
            print(f"  Type: {element.get('type', 'N/A')}")
            print(f"  Properties: {list(element.get('properties', {}).keys())}")
            print(f"  Property Sets: {list(element.get('psets', {}).keys())}")
            print(f"  Quantities: {list(element.get('qtos', {}).keys())}")
            
            # Show actual property values
            props = element.get('properties', {})
            if props:
                print(f"  Sample properties:")
                for key, value in list(props.items())[:3]:
                    print(f"    {key}: {value}")
    
    # Check for other model info
    if "schema" in input_data:
        print(f"\nIFC Schema: {input_data['schema']}")
    
    if "project" in input_data:
        project = input_data["project"]
        print(f"\nProject Info:")
        for key, value in project.items():
            print(f"  {key}: {value}")
    
    if "elementCounts" in input_data:
        counts = input_data["elementCounts"]
        print(f"\nElement Counts:")
        for elem_type, count in counts.items():
            print(f"  {elem_type}: {count}")
    
    # Create a summary for the result
    summary = {
        "total_elements": len(input_data.get("elements", [])),
        "element_types": len(element_types) if "elements" in input_data else 0,
        "schema": input_data.get("schema", "Unknown"),
        "has_properties": any(len(elem.get("properties", {})) > 0 for elem in input_data.get("elements", [])),
        "has_psets": any(len(elem.get("psets", {})) > 0 for elem in input_data.get("elements", [])),
        "has_qtos": any(len(elem.get("qtos", {})) > 0 for elem in input_data.get("elements", []))
    }
    
    result = summary
    
else:
    print("No IFC data provided")
    result = {"error": "No input data"}

# Return summary for Watch Node
result


