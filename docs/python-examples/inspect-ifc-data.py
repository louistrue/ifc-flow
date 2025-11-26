# Inspect IFC Data Script - Shows Actual Data!
# Explore what's really in your IFC model with real values
# 
# Workflow: IFC Node → Python Node (this script) → Watch Node

result = {
    "model_info": {},
    "element_types": {},
    "sample_elements": [],
    "property_sets_found": [],
    "quantities_found": [],
    "all_properties": {}
}

if input_data and isinstance(input_data, dict):
    print("=== IFC Data Inspection - Showing Actual Data ===")
    
    # Model information
    if "schema" in input_data:
        result["model_info"]["schema"] = input_data["schema"]
        print(f"IFC Schema: {input_data['schema']}")
    
    if "project" in input_data:
        result["model_info"]["project"] = input_data["project"]
        print(f"Project: {input_data['project'].get('Name', 'N/A')}")
    
    # Process elements
    if "elements" in input_data:
        elements = input_data["elements"]
        print(f"\nFound {len(elements)} elements")
        result["model_info"]["total_elements"] = len(elements)
        
        # Count element types with actual counts
        element_types = {}
        for element in elements:
            elem_type = element.get("type", "Unknown")
            element_types[elem_type] = element_types.get(elem_type, 0) + 1
        
        result["element_types"] = element_types
        print(f"\nElement types ({len(element_types)} total):")
        for elem_type, count in sorted(element_types.items(), key=lambda x: -x[1])[:10]:
            print(f"  {elem_type}: {count}")
        
        # Collect all unique property names
        all_prop_names = set()
        all_pset_names = set()
        all_qto_names = set()
        
        for element in elements:
            props = element.get("properties", {})
            all_prop_names.update(props.keys())
            
            psets = element.get("psets", {})
            all_pset_names.update(psets.keys())
            
            qtos = element.get("qtos", {})
            all_qto_names.update(qtos.keys())
        
        result["all_properties"]["property_names"] = sorted(list(all_prop_names))
        result["property_sets_found"] = sorted(list(all_pset_names))
        result["quantities_found"] = sorted(list(all_qto_names))
        
        print(f"\nFound {len(all_prop_names)} unique property names")
        print(f"Found {len(all_pset_names)} property sets")
        print(f"Found {len(all_qto_names)} quantity sets")
        
        # Show detailed sample elements with actual data
        print(f"\n=== Sample Elements (showing first 5) ===")
        sample_count = 0
        for element in elements:
            if sample_count >= 5:
                break
            
            elem_data = {
                "expressId": element.get("expressId"),
                "type": element.get("type"),
                "properties": element.get("properties", {}),
                "psets": element.get("psets", {}),
                "qtos": element.get("qtos", {})
            }
            
            result["sample_elements"].append(elem_data)
            
            print(f"\nElement {sample_count + 1}:")
            print(f"  ID: {elem_data['expressId']}")
            print(f"  Type: {elem_data['type']}")
            
            # Show actual property values
            if elem_data["properties"]:
                print(f"  Properties ({len(elem_data['properties'])}):")
                for key, value in list(elem_data["properties"].items())[:5]:
                    print(f"    {key}: {value}")
            
            # Show actual property sets
            if elem_data["psets"]:
                print(f"  Property Sets ({len(elem_data['psets'])}):")
                for pset_name, pset_data in list(elem_data["psets"].items())[:3]:
                    print(f"    {pset_name}:")
                    for prop_name, prop_value in list(pset_data.items())[:3]:
                        print(f"      {prop_name}: {prop_value}")
            
            # Show actual quantities
            if elem_data["qtos"]:
                print(f"  Quantities ({len(elem_data['qtos'])}):")
                for qto_name, qto_data in list(elem_data["qtos"].items())[:3]:
                    print(f"    {qto_name}:")
                    for qty_name, qty_value in list(qto_data.items())[:3]:
                        print(f"      {qty_name}: {qty_value}")
            
            sample_count += 1
        
        # Find elements with the most properties
        elements_with_props = []
        for element in elements:
            prop_count = len(element.get("properties", {}))
            pset_count = len(element.get("psets", {}))
            if prop_count > 0 or pset_count > 0:
                elements_with_props.append({
                    "expressId": element.get("expressId"),
                    "type": element.get("type"),
                    "name": element.get("properties", {}).get("Name", "N/A"),
                    "property_count": prop_count,
                    "pset_count": pset_count
                })
        
        # Sort by property count and get top 3
        elements_with_props.sort(key=lambda x: -(x["property_count"] + x["pset_count"]))
        result["elements_with_most_properties"] = elements_with_props[:3]
        
        if elements_with_props:
            print(f"\n=== Elements with Most Properties ===")
            for elem in elements_with_props[:3]:
                print(f"  {elem['type']} (ID: {elem['expressId']}): {elem['property_count']} props, {elem['pset_count']} psets")
                print(f"    Name: {elem['name']}")
        
        # Show property set details
        if all_pset_names:
            print(f"\n=== Property Sets Found ===")
            pset_details = {}
            for pset_name in list(all_pset_names)[:10]:
                # Count how many elements have this pset
                count = sum(1 for e in elements if pset_name in e.get("psets", {}))
                pset_details[pset_name] = {
                    "element_count": count,
                    "properties": []
                }
                
                # Get properties from first element that has this pset
                for element in elements:
                    if pset_name in element.get("psets", {}):
                        pset_data = element["psets"][pset_name]
                        pset_details[pset_name]["properties"] = list(pset_data.keys())
                        break
                
                print(f"  {pset_name}: {count} elements")
                if pset_details[pset_name]["properties"]:
                    print(f"    Properties: {', '.join(pset_details[pset_name]['properties'][:5])}")
            
            result["property_set_details"] = pset_details
    
    else:
        print("No elements found in input data")
        result["error"] = "No elements in input data"
    
else:
    print("No IFC data provided")
    result = {"error": "No input data"}

# Return detailed data for Watch Node
print(f"\n=== Summary ===")
print(f"Returning {len(result.get('sample_elements', []))} sample elements")
print(f"Found {len(result.get('property_sets_found', []))} property sets")
print(f"Found {len(result.get('all_properties', {}).get('property_names', []))} unique properties")

# Create CSV-friendly flattened version
csv_data = []

# Add model info as first row
csv_data.append({
    "category": "Model Info",
    "key": "Schema",
    "value": result.get("model_info", {}).get("schema", "N/A"),
    "details": ""
})
csv_data.append({
    "category": "Model Info",
    "key": "Total Elements",
    "value": result.get("model_info", {}).get("total_elements", 0),
    "details": ""
})

# Add element types
for elem_type, count in result.get("element_types", {}).items():
    csv_data.append({
        "category": "Element Types",
        "key": elem_type,
        "value": count,
        "details": ""
    })

# Add property sets
for pset_name in result.get("property_sets_found", []):
    pset_detail = result.get("property_set_details", {}).get(pset_name, {})
    prop_list = ", ".join(pset_detail.get("properties", [])[:5])
    csv_data.append({
        "category": "Property Sets",
        "key": pset_name,
        "value": pset_detail.get("element_count", 0),
        "details": f"Properties: {prop_list}"
    })

# Add quantities
for qto_name in result.get("quantities_found", []):
    csv_data.append({
        "category": "Quantities",
        "key": qto_name,
        "value": "",
        "details": ""
    })

# Add sample elements (flattened)
for i, elem in enumerate(result.get("sample_elements", [])):
    # Element header
    csv_data.append({
        "category": f"Sample Element {i+1}",
        "key": "Type",
        "value": elem.get("type", "N/A"),
        "details": f"ID: {elem.get('expressId', 'N/A')}"
    })
    
    # Properties
    for prop_name, prop_value in list(elem.get("properties", {}).items())[:5]:
        csv_data.append({
            "category": f"Sample Element {i+1}",
            "key": f"Property: {prop_name}",
            "value": str(prop_value)[:50],  # Truncate long values
            "details": ""
        })
    
    # Property sets
    for pset_name, pset_data in list(elem.get("psets", {}).items())[:2]:
        for prop_name, prop_value in list(pset_data.items())[:3]:
            csv_data.append({
                "category": f"Sample Element {i+1}",
                "key": f"Pset {pset_name}: {prop_name}",
                "value": str(prop_value)[:50],
                "details": ""
            })

# Add elements with most properties
for elem in result.get("elements_with_most_properties", []):
    csv_data.append({
        "category": "Top Elements",
        "key": f"{elem.get('type', 'N/A')} (ID: {elem.get('expressId', 'N/A')})",
        "value": f"{elem.get('property_count', 0)} props, {elem.get('pset_count', 0)} psets",
        "details": elem.get("name", "N/A")
    })

# Return CSV-ready array directly for export
# This format works best for CSV export - array of flat objects
# For detailed inspection, check the console output or use a separate script
result = csv_data

# If you want both formats, uncomment below and comment above:
# result = {
#     "detailed": detailed_result,  # Full nested structure for Watch Node
#     "csv_ready": csv_data  # Flattened table for CSV export
# }

result


