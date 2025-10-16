# Simple Property Assignment Script
# Easy example for assigning any property to elements
# 
# Workflow: Any Analysis → Python Node (this script) → Property Node → Export

# Simple: Assign a property based on element type
result = {}

if input_data and isinstance(input_data, dict):
    print("Assigning properties to elements...")
    
    # Get elements from input (could be from any analysis)
    elements = input_data.get("elements", [])
    
    if elements:
        print(f"Found {len(elements)} elements")
        
        # Simple example: assign "Category" based on element type
        for element in elements:
            element_id = element.get("expressId") or element.get("id")
            element_type = element.get("type", "")
            
            if element_id and element_type:
                # Assign category based on type
                if "Wall" in element_type:
                    category = "Structure"
                elif "Door" in element_type:
                    category = "Opening"
                elif "Window" in element_type:
                    category = "Opening"
                elif "Furnishing" in element_type:
                    category = "Furniture"
                else:
                    category = "Other"
                
                result[element_id] = category
        
        print(f"Assigned categories to {len(result)} elements")
        print(f"Categories: {list(set(result.values()))}")
    else:
        print("No elements found in input")
else:
    print("No input data")

# Return in format expected by Property Node
result = {"mappings": result}
result


