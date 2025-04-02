/* global importScripts */

// Import Pyodide
importScripts("https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js");

let pyodide = null;
// Create a cache to store the loaded IFC model data
let ifcModelCache = null;

// Initialize Pyodide with IfcOpenShell
async function initPyodide() {
  if (pyodide !== null) {
    return pyodide;
  }

  self.postMessage({
    type: "progress",
    message: "Loading Pyodide...",
    percentage: 5,
  });

  try {
    // Load Pyodide
    pyodide = await loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/",
    });

    self.postMessage({
      type: "progress",
      message: "Installing required packages...",
      percentage: 30,
    });

    // Load micropip for package installation and numpy for computations
    await pyodide.loadPackage(["micropip", "numpy"]);

    // Bypass Emscripten version compatibility check for wheels
    await pyodide.runPythonAsync(`
      import micropip
      from micropip._micropip import WheelInfo
      WheelInfo.check_compatible = lambda self: None
    `);

    // Install IfcOpenShell 0.8.1
    self.postMessage({
      type: "progress",
      message: "Installing IfcOpenShell 0.8.1...",
      percentage: 50,
    });

    await pyodide.runPythonAsync(`
      import micropip
      # Install lark for stream support
      await micropip.install('lark')
      await micropip.install('https://cdn.jsdelivr.net/gh/IfcOpenShell/wasm-wheels@33b437e5fd5425e606f34aff602c42034ff5e6dc/ifcopenshell-0.8.1+latest-cp312-cp312-emscripten_3_1_58_wasm32.whl')
    `);

    // Initialize the module for caching IFC models
    await pyodide.runPythonAsync(`
      import sys
      import ifcopenshell      
    `);

    self.postMessage({
      type: "progress",
      message: "IfcOpenShell loaded successfully",
      percentage: 100,
    });

    return pyodide;
  } catch (error) {
    self.postMessage({
      type: "error",
      message: `Failed to load Pyodide: ${error.message}`,
      stack: error.stack,
    });
    throw error;
  }
}

// Main message handler
self.onmessage = async (event) => {
  try {
    const { action, data, messageId } = event.data;
    console.log(`Worker received message: ${action}`, { data, messageId });

    switch (action) {
      case "init":
        await initPyodide();
        self.postMessage({ type: "initialized", messageId });
        break;

      case "loadIfc":
        console.log("Starting to load IFC file...", {
          filename: data.filename,
          size: data.arrayBuffer.byteLength,
        });
        await handleLoadIfc({ ...data, messageId });
        break;

      case "extractData":
        console.log("Starting to extract data...", { types: data.types });
        await handleExtractData({ ...data, messageId });
        break;

      case "exportIfc":
        console.log("Starting to export modified IFC file...", {
          filename: data.fileName,
          elementCount: data.model.elements.length,
        });
        await handleExportIfc({ ...data, messageId });
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error("Worker onmessage error:", error);
    self.postMessage({
      type: "error",
      message: error.message,
      stack: error.stack,
      messageId: event.data?.messageId,
    });
  }
};

// Handle loading an IFC file
async function handleLoadIfc({ arrayBuffer, filename, messageId }) {
  try {
    console.log("handleLoadIfc: Starting to process file", {
      filename,
      size: arrayBuffer.byteLength,
    });

    // Make sure Pyodide is initialized
    await initPyodide();
    console.log("handleLoadIfc: Pyodide initialized");

    self.postMessage({
      type: "progress",
      message: "Reading IFC file...",
      percentage: 60,
      messageId,
    });

    try {
      console.log("handleLoadIfc: Writing file to Pyodide filesystem");
      // Create a virtual file in the Pyodide file system
      const uint8Array = new Uint8Array(arrayBuffer);
      pyodide.FS.writeFile("model.ifc", uint8Array);
      console.log("handleLoadIfc: File written to filesystem");

      // Use IfcOpenShell to load the file and extract basic information
      self.postMessage({
        type: "progress",
        message: "Processing IFC with IfcOpenShell...",
        percentage: 80,
        messageId,
      });

      // Additional progress message to indicate the potentially long processing step
      self.postMessage({
        type: "progress",
        message:
          "Analyzing IFC structure, this might take a while for large files...",
        percentage: 90,
        messageId,
      });

      // Add error handling for Python execution
      try {
        console.log("handleLoadIfc: Running Python to process IFC");

        // Create a dedicated namespace for this operation
        const namespace = pyodide.globals.get("dict")();

        // First run the imports and setup
        await pyodide.runPythonAsync(
          `
          import ifcopenshell
          import json
          import sys
          import traceback
        `,
          { globals: namespace }
        );

        // Then process the IFC file and store result in a variable
        await pyodide.runPythonAsync(
          `
          try:
              print("Python: Loading IFC file...")
              # Load the IFC file from the virtual filesystem
              ifc_file = ifcopenshell.open('model.ifc')
              print("Python: IFC file loaded successfully")
              
              # Extract schema and basic info
              schema = ifc_file.schema
              print(f"Python: Schema identified as {schema}")
              
              # Get project info
              projects = ifc_file.by_type("IfcProject")
              project_info = None
              if projects:
                  project = projects[0]
                  project_info = {
                      "GlobalId": project.GlobalId,
                      "Name": project.Name or "Unnamed Project",
                      "Description": project.Description or ""
                  }
                  print(f"Python: Project info extracted: {project_info}")
              
              # Count elements by type
              element_counts = {}
              for ifc_class in [
                  "IfcWall", "IfcSlab", "IfcBeam", "IfcColumn", "IfcDoor", 
                  "IfcWindow", "IfcRoof", "IfcStair", "IfcFurnishingElement"
              ]:
                  elements = ifc_file.by_type(ifc_class)
                  element_counts[ifc_class] = len(elements)
                  print(f"Python: Count for {ifc_class}: {len(elements)}")
              
              # Create result object
              result_obj = {
                  "filename": "${filename}",
                  "schema": schema,
                  "project": project_info,
                  "element_counts": element_counts,
                  "total_elements": sum(element_counts.values()),
                  "model_id": "${filename}"
              }
              print("Python: Result object created")
              
              # Store as JSON in a variable - don't return it yet
              result_json = json.dumps(result_obj)
              print("Python: JSON serialization complete")
              
              # Store a success flag
              success = True
              error_msg = None
              error_trace = None
          except Exception as e:
              print(f"Python ERROR: {str(e)}")
              error_msg = str(e)
              error_trace = traceback.format_exc()
              print(f"Python TRACEBACK: {error_trace}")
              success = False
              result_json = None
        `,
          { globals: namespace }
        );

        // Check if there was an error
        const success = namespace.get("success");
        console.log("Python execution success:", success);

        if (!success) {
          const errorMsg = namespace.get("error_msg");
          const errorTrace = namespace.get("error_trace");
          throw new Error(`Python error: ${errorMsg}\n${errorTrace}`);
        }

        // Get the actual result from the namespace
        const result = namespace.get("result_json");
        console.log("Got result from Python namespace:", !!result);

        if (!result) {
          throw new Error("Python execution did not produce a result");
        }

        // Parse the result JSON
        const modelInfo = JSON.parse(result);
        // Store model info in the JavaScript side cache as well
        ifcModelCache = {
          filename: modelInfo.filename,
          schema: modelInfo.schema,
        };

        console.log("handleLoadIfc: Model info extracted and cached", {
          schema: modelInfo.schema,
          filename: modelInfo.filename,
          totalElements: modelInfo.total_elements,
          modelId: modelInfo.model_id,
          jsCache: JSON.stringify(ifcModelCache),
        });

        // Clean up
        namespace.destroy();

        // Final progress update
        self.postMessage({
          type: "progress",
          message: "File processed successfully!",
          percentage: 100,
          messageId,
        });

        // Send the result back
        self.postMessage({
          type: "loadComplete",
          modelInfo: modelInfo,
          messageId,
        });
        console.log("handleLoadIfc: Sent loadComplete message");
      } catch (pythonError) {
        console.error("Python execution error:", pythonError);
        throw new Error(`Python error: ${pythonError.message}`);
      }
    } catch (fileProcessingError) {
      console.error("Error processing IFC file:", fileProcessingError);
      throw fileProcessingError;
    }
  } catch (error) {
    console.error("handleLoadIfc error:", error);
    self.postMessage({
      type: "error",
      message: `Error loading IFC file: ${error.message}`,
      stack: error.stack,
      messageId,
    });
  }
}

// Extract more detailed information from the IFC file
async function handleExtractData({ types = ["IfcWall"], messageId }) {
  try {
    console.log("handleExtractData: Starting to extract data for types", types);

    // Make sure Pyodide is initialized
    await initPyodide();
    console.log("handleExtractData: Pyodide initialized");

    self.postMessage({
      type: "progress",
      message: "Converting IFC to structured data...",
      percentage: 60,
      messageId,
    });

    // Create a Python array of the requested types
    const typesStr = JSON.stringify(types);
    console.log(`handleExtractData: Processing types: ${typesStr}`);

    // Add error handling for Python execution
    try {
      console.log(
        "handleExtractData: Running Python to extract elements using IfcOpenShell 0.8.1"
      );

      // Create a dedicated namespace for this operation
      const namespace = pyodide.globals.get("dict")();

      // First run the imports and setup
      await pyodide.runPythonAsync(
        `
        import sys
        print("Python version:", sys.version)
        
        # Explicitly load numpy - need to handle multiple approaches
        try:
            import numpy as np
            print("Numpy already imported, version:", np.__version__)
        except ImportError:
            print("Numpy not found, attempting to load...")
            try:
                print("Loading numpy via micropip...")
                import micropip
                await micropip.install('numpy')
                import numpy as np
                print("Successfully loaded numpy via micropip, version:", np.__version__)
            except Exception as e:
                print(f"Failed to load numpy via micropip: {e}")
                try:
                    print("Loading numpy via pyodide.loadPackage...")
                    import pyodide
                    await pyodide.loadPackage('numpy')
                    import numpy as np
                    print("Successfully loaded numpy via loadPackage, version:", np.__version__)
                except Exception as e:
                    print(f"Failed to load numpy via loadPackage: {e}")
                    print("Will try to proceed without numpy, but this may cause issues")
        
        import ifcopenshell
        try:
            import ifcopenshell.util.element
            print("ifcopenshell.util.element successfully imported")
        except Exception as e:
            print(f"Error importing ifcopenshell.util.element: {e}")
            print("Will use basic element properties only")
        
        import json
        import traceback
        import os
      `,
        { globals: namespace }
      );

      // Set the types in the namespace
      namespace.set("types_str", typesStr);

      // Then process the IFC elements with fallback for numpy dependency issues
      await pyodide.runPythonAsync(
        `
        try:
            print("Python: Loading IFC file for structured extraction")
            # Load the IFC file (always from filesystem)
            if not os.path.exists('model.ifc'):
                raise FileNotFoundError("The 'model.ifc' file does not exist in the virtual filesystem.")
            ifc_file = ifcopenshell.open('model.ifc')
            print("Python: IFC file loaded successfully")
            
            # Parse requested types
            requested_types = json.loads(types_str)
            print(f"Python: Requested types: {requested_types}")
            
            # Helper function to extract common properties from an element
            def extract_common_properties(element):
                """Extract properties without relying on ifcopenshell.util.element"""
                properties = {}
                
                # Basic properties available on all IFC elements
                if hasattr(element, "GlobalId"):
                    properties["GlobalId"] = element.GlobalId
                if hasattr(element, "Name"):
                    properties["Name"] = element.Name or f"Unnamed {element.is_a()}"
                if hasattr(element, "Description"):
                    properties["Description"] = element.Description
                
                # Try to get property sets directly (slower but no external dependencies)
                try:
                    psets = {}
                    for definition in element.IsDefinedBy:
                        if definition.is_a('IfcRelDefinesByProperties'):
                            property_set = definition.RelatingPropertyDefinition
                            if property_set.is_a('IfcPropertySet'):
                                # Store the property values in a dictionary
                                pset_name = property_set.Name
                                psets[pset_name] = {}
                                for prop in property_set.HasProperties:
                                    if prop.is_a('IfcPropertySingleValue'):
                                        # Get the property name and value
                                        prop_name = prop.Name
                                        if prop.NominalValue:
                                            prop_value = prop.NominalValue.wrappedValue
                                            psets[pset_name][prop_name] = prop_value
                                            
                                            # Copy important properties to the top level
                                            if pset_name == "Pset_WallCommon" or prop_name in ["IsExternal", "FireRating", "LoadBearing"]:
                                                properties[prop_name] = prop_value
                except Exception as e:
                    print(f"Error getting property sets: {e}")
                
                return properties, psets
            
            # Helper function to convert IFC element to structured dictionary
            def element_to_dict(element):
                # Create element dictionary with basic properties
                element_dict = {
                    "id": f"{element.is_a()}-{element.id()}",
                    "expressId": element.id(),
                    "type": element.is_a()
                }
                
                # First try using the util module if available
                has_util = 'ifcopenshell.util.element' in sys.modules
                
                if has_util:
                    try:
                        # Get properties using the utility function
                        element_dict["properties"] = {
                            "GlobalId": element.GlobalId,
                            "Name": element.Name or f"Unnamed {element.is_a()}"
                        }
                        
                        # Get normal property sets (non-quantity sets)
                        element_dict["psets"] = ifcopenshell.util.element.get_psets(element, psets_only=True)
                        
                        # Get quantity sets 
                        element_dict["qtos"] = ifcopenshell.util.element.get_psets(element, qtos_only=True)
                        
                        # Copy important properties to the top level for easy access
                        for pset_name, pset in element_dict["psets"].items():
                            for prop_name, prop_value in pset.items():
                                # Add common properties to the root level for easy access
                                if pset_name == "Pset_WallCommon" or prop_name in ["IsExternal", "FireRating", "LoadBearing"]:
                                    element_dict["properties"][prop_name] = prop_value
                        
                        # Copy important quantities to properties
                        if "qtos" in element_dict:
                            for qto_name, qto in element_dict["qtos"].items():
                                for q_name, q_value in qto.items():
                                    if q_name in ["Length", "Width", "Height", "Area", "Volume"]:
                                        element_dict["properties"][q_name] = q_value
                        
                        return element_dict
                    except Exception as e:
                        print(f"Error using util methods: {e}")
                        print("Falling back to basic extraction...")
                
                # Fallback: Get properties directly without util module
                properties, psets = extract_common_properties(element)
                element_dict["properties"] = properties
                element_dict["psets"] = psets
                
                return element_dict
            
            # Extract elements of requested types
            elements = []
            all_elements = []
            
            # If requested_types contains '*' or 'all', get all element types
            if '*' in requested_types or 'all' in requested_types:
                print("Extracting all element types")
                requested_types = ['IfcWall', 'IfcSlab', 'IfcBeam', 'IfcColumn', 'IfcDoor', 
                                  'IfcWindow', 'IfcRoof', 'IfcStair', 'IfcFurnishingElement',
                                  'IfcSpace', 'IfcBuildingElementProxy']
            
            # Collect all requested elements
            for ifc_type in requested_types:
                print(f"Processing elements of type {ifc_type}")
                try:
                    type_elements = ifc_file.by_type(ifc_type)
                    all_elements.extend(type_elements)
                    print(f"Found {len(type_elements)} elements of type {ifc_type}")
                except Exception as e:
                    print(f"Error getting elements of type {ifc_type}: {e}")
            
            # Convert all elements to dictionaries
            processed_count = 0
            for element in all_elements:
                try:
                    element_dict = element_to_dict(element)
                    elements.append(element_dict)
                    processed_count += 1
                except Exception as e:
                    print(f"Error converting element {element.id()} to dictionary: {e}")
            
            print(f"Successfully extracted {processed_count} elements")
            
            # Store as JSON in a variable
            elements_json = json.dumps(elements)
            print(f"JSON serialization complete: {len(elements_json)} characters")
            
            # Store success flag
            success = True
            error_msg = None
            error_trace = None
        except Exception as e:
            print(f"Python ERROR: {str(e)}")
            error_msg = str(e)
            error_trace = traceback.format_exc()
            print(f"Python TRACEBACK: {error_trace}")
            success = False
            elements_json = None
      `,
        { globals: namespace }
      );

      // Check if there was an error
      const success = namespace.get("success");
      console.log("Python extraction success:", success);

      if (!success) {
        const errorMsg = namespace.get("error_msg");
        const errorTrace = namespace.get("error_trace");
        throw new Error(`Python error: ${errorMsg}\n${errorTrace}`);
      }

      // Get the actual result from the namespace
      const elementsJson = namespace.get("elements_json");
      console.log("Got elements from Python namespace:", !!elementsJson);

      if (!elementsJson) {
        throw new Error(
          "Python execution did not produce a result for elements"
        );
      }

      // Parse the result JSON
      const elements = JSON.parse(elementsJson);
      console.log(
        `handleExtractData: Successfully processed ${elements.length} elements`
      );

      // Clean up
      namespace.destroy();

      // Final progress update
      self.postMessage({
        type: "progress",
        message: "Elements processed successfully!",
        percentage: 100,
        messageId,
      });

      // Send the result back
      self.postMessage({
        type: "dataExtracted",
        elements: elements,
        messageId,
      });
      console.log("handleExtractData: Sent dataExtracted message");
    } catch (pythonError) {
      console.error("Python execution error:", pythonError);
      throw new Error(`Python error: ${pythonError.message}`);
    }
  } catch (error) {
    console.error("handleExtractData error:", error);
    self.postMessage({
      type: "error",
      message: `Error extracting data: ${error.message}`,
      stack: error.stack,
      messageId,
    });
  }
}

// Add this new handler function after the handleExtractData function
async function handleExportIfc(data) {
  const { model, fileName, messageId, arrayBuffer } = data;

  try {
    self.postMessage({
      type: "progress",
      message: "Preparing to export modified IFC file...",
      percentage: 10,
      messageId,
    });

    // Get the proper model ID to look up in the cache
    // Try to use model ID from the model data, or from ifcModelCache, or fileName as fallback
    const modelId = (ifcModelCache && ifcModelCache.filename) || fileName;

    // Also try the original filename if available
    const originalFilename =
      (ifcModelCache && ifcModelCache.filename) || fileName;

    console.log("Export - Model info:", {
      modelId: modelId,
      originalFilename: originalFilename,
      elements: model.elements ? model.elements.length : 0,
      sourceFilename: ifcModelCache?.filename,
      jsCache: JSON.stringify(ifcModelCache),
    });

    // Get or initialize pyodide
    const pyodide = await initPyodide();

    // Create a namespace to avoid polluting the global space
    const namespace = pyodide.globals.get("dict")();

    // Add model data to Python scope
    namespace.set("model_json", JSON.stringify(model));
    namespace.set("export_filename", fileName || "exported.ifc");
    namespace.set("model_id", modelId);

    self.postMessage({
      type: "progress",
      message: "Applying changes to IFC model...",
      percentage: 30,
      messageId,
    });

    // Ensure the original IFC file buffer was passed from the main thread
    if (!arrayBuffer || !(arrayBuffer instanceof ArrayBuffer)) {
      throw new Error(
        "Original IFC file buffer was not provided or is invalid. Cannot export."
      );
    }

    try {
      // Write the provided buffer to the filesystem
      console.log(
        "handleExportIfc: Writing provided IFC data to model.ifc before modification..."
      );
      pyodide.FS.writeFile("model.ifc", new Uint8Array(arrayBuffer));
      console.log("handleExportIfc: Successfully wrote model.ifc");
    } catch (fsError) {
      console.error(
        "handleExportIfc: Error writing model.ifc to Pyodide filesystem:",
        fsError
      );
      throw new Error(
        `Failed to prepare IFC file in virtual filesystem: ${fsError.message}`
      );
    }

    try {
      await pyodide.runPythonAsync(
        `
        import json
        import traceback
        import ifcopenshell
        import ifcopenshell.guid
        import tempfile
        import sys
        import os
        import re
        
        try:
            print("Starting IFC export...")
            
            # Parse the model JSON into Python objects
            model_data = json.loads(model_json)
            print(f"Loaded model data with {len(model_data['elements'])} elements")
            
            # Load the IFC file from the filesystem
            ifc_file = None
            
            if os.path.exists('model.ifc'):
                print("Found 'model.ifc' file in filesystem, opening...")
                try:
                    # Open the original file that was previously loaded
                    ifc_file = ifcopenshell.open('model.ifc')
                    print(f"Opened original IFC file with schema {ifc_file.schema}")
                except Exception as e:
                    print(f"Error opening original IFC file: {e}")
                    raise RuntimeError(f"Failed to open 'model.ifc': {e}")
            else:
                # This should ideally not happen if load was successful
                raise FileNotFoundError("The 'model.ifc' file does not exist in the virtual filesystem. Cannot export.")

            # We should not create a new file, we must modify the existing one.
            # If ifc_file is None here, something went wrong earlier.
            if not ifc_file:
                raise RuntimeError("IFC file object is None after attempting to load from filesystem.")
            
            # Create a temporary file to store the modified IFC
            ifc_temp = tempfile.NamedTemporaryFile(suffix=".ifc", delete=False)
            temp_path = ifc_temp.name
            ifc_temp.close()
            
            print("Applying property modifications...")
            
            # Process elements with property changes
            modified_count = 0 # Initialize the counter

            # Collect information about all elements for easier lookup by express ID or GlobalId
            element_lookup = {}
            all_entities_by_id = {}
            all_products_by_guid = {}
            try:
                # Iterate directly over the file object to get entities
                all_products = ifc_file.by_type('IfcProduct')

                # Create lookup tables
                for entity in ifc_file: # Iterate directly over the file object
                    if hasattr(entity, 'id') and entity.id():
                        all_entities_by_id[entity.id()] = entity

                for product in all_products:
                    if hasattr(product, 'GlobalId') and product.GlobalId:
                        all_products_by_guid[product.GlobalId] = product
            except Exception as e:
                print(f"Error creating element lookup: {e}")
            
            # Map of element identifiers to their modified properties
            property_changes = {}
            
            # Extract the property changes from the model data
            for element_data in model_data['elements']:
                # Skip elements without property changes
                if 'propertyInfo' not in element_data:
                    continue
                    
                # Get the property information
                prop_info = element_data.get('propertyInfo', {})
                
                # Skip if no property exists or isn't meaningful
                if not prop_info.get('exists', False) and 'value' not in prop_info:
                    continue
                
                # Look for identifiers in this order:
                # 1. Express ID (numeric index)
                # 2. GlobalId from properties
                # 3. ID string from element data ('IfcType-ExpressId')
                element_id = None
                element_global_id = None
                element_type = element_data.get('type')
                
                express_id = element_data.get('expressId')
                
                if express_id:
                    element_id = express_id
                elif 'properties' in element_data and 'GlobalId' in element_data['properties']:
                    element_global_id = element_data['properties']['GlobalId']
                    element_id = element_global_id # Use GlobalId as primary lookup if expressId is missing
                elif 'id' in element_data and isinstance(element_data['id'], str) and '-' in element_data['id']:
                    try:
                        parts = element_data['id'].split('-')
                        element_id = int(parts[-1]) # Extract express ID from string like 'IfcWall-139'
                        if not element_type:
                            element_type = parts[0]
                    except ValueError:
                        print(f"Could not parse express ID from element 'id': {element_data['id']}")
                
                # Skip if we can't identify the element
                if not element_id and not element_global_id:
                    print(f"WARNING: Element not found in IFC file using ID: {element_id}, Express ID: {express_id}, Global ID: {element_global_id}. Skipping modification.")
                    continue # Skip to the next element
                
                # Store the property change
                property_changes[element_id] = {
                    'propName': prop_info.get('name', ''),
                    'psetName': prop_info.get('psetName', ''),
                    'value': prop_info.get('value'),
                    'type': element_data.get('type', 'IfcProduct'),
                    'expressId': express_id,
                    'globalId': element_data.get('properties', {}).get('GlobalId'),
                    'elementName': element_data.get('properties', {}).get('Name', f"Element {element_id or element_global_id}")
                }
            
            print(f"Found {len(property_changes)} elements with property changes")
            
            # Apply the property changes to the IFC file
            for element_id, change in property_changes.items():
                try:
                    # Find the element first by direct lookup
                    element = None
                    express_id_to_find = change.get('expressId')
                    global_id_to_find = change.get('globalId')
                    
                    # Prioritize lookup by express ID if available and valid
                    if express_id_to_find and isinstance(express_id_to_find, int):
                        element = all_entities_by_id.get(express_id_to_find)
                    
                    # If not found by express ID, try GlobalId
                    if not element and global_id_to_find:
                        element = all_products_by_guid.get(global_id_to_find)

                    # Last resort: if element_id was a string like 'IfcWall-139'
                    if not element and isinstance(element_id, int) and element_id != express_id_to_find:
                        element = all_entities_by_id.get(element_id)

                    # Check if the element exists
                    if not element:
                        print(f"WARNING: Element not found in IFC file using ID: {element_id}, Express ID: {express_id_to_find}, Global ID: {global_id_to_find}. Skipping modification.")
                        continue # Skip to the next element
                    
                    try:
                        # Get the property name and value using the correct keys
                        prop_name = change['propName']
                        prop_value = change['value']
                        pset_name = change['psetName']
                        
                        # Skip if no property name or pset name
                        if not prop_name or not pset_name:
                            print(f"Skipping property change - missing property name or pset name")
                            continue
                        
                        print(f"Modifying {element.is_a()}{change.get('elementName', '')} (GlobalId: {change.get('globalId', 'unknown')}) - Setting {pset_name}.{prop_name} = {prop_value}")
                        
                        # Wrap the entire property modification in a try-except block
                        try:
                            # Check if the property set exists
                            existing_pset = None
                            
                            # Find existing property set
                            try:
                                if hasattr(element, 'IsDefinedBy'):
                                    for definition in element.IsDefinedBy:
                                        try:
                                            if definition.is_a('IfcRelDefinesByProperties'):
                                                property_set = definition.RelatingPropertyDefinition
                                                if property_set.is_a('IfcPropertySet') and property_set.Name == pset_name:
                                                    existing_pset = property_set
                                                    break
                                        except Exception as e:
                                            print(f"Error checking property set: {e}")
                            except Exception as e:
                                print(f"Error finding property sets: {e}")
                            
                            # If property set exists, update or add the property
                            if existing_pset:
                                # Check if property exists
                                existing_prop = None
                                try:
                                    for prop in existing_pset.HasProperties:
                                        try:
                                            if prop.is_a('IfcPropertySingleValue') and prop.Name == prop_name:
                                                existing_prop = prop
                                                break
                                        except Exception as e:
                                            print(f"Error checking property: {e}")
                                except Exception as e:
                                    print(f"Error iterating properties: {e}")
                                
                                # Update existing property
                                if existing_prop:
                                    try:
                                        # Create appropriate value type based on Python type
                                        if isinstance(prop_value, bool):
                                            existing_prop.NominalValue = ifc_file.create_entity("IfcBoolean", prop_value)
                                        elif isinstance(prop_value, (int, float)):
                                            existing_prop.NominalValue = ifc_file.create_entity("IfcReal", float(prop_value))
                                        elif isinstance(prop_value, str):
                                            # --- Check if string represents a boolean ---
                                            lower_val = prop_value.lower()
                                            if lower_val == 'true':
                                                existing_prop.NominalValue = ifc_file.create_entity("IfcBoolean", True)
                                            elif lower_val == 'false':
                                                existing_prop.NominalValue = ifc_file.create_entity("IfcBoolean", False)
                                            else:
                                                # Otherwise, treat as regular text
                                                existing_prop.NominalValue = ifc_file.create_entity("IfcText", prop_value)
                                        else:
                                            # For complex types, convert to string
                                            existing_prop.NominalValue = ifc_file.create_entity("IfcText", str(prop_value))
                                        print(f"Updated existing property {prop_name}")
                                    except Exception as e:
                                        print(f"Error updating property value: {e}")
                                else:
                                    # Create new property
                                    try:
                                        new_prop = None
                                        
                                        # Create the appropriate property based on value type
                                        if isinstance(prop_value, bool):
                                            new_prop = ifc_file.create_entity("IfcPropertySingleValue", Name=prop_name)
                                            new_prop.NominalValue = ifc_file.create_entity("IfcBoolean", prop_value)
                                        elif isinstance(prop_value, (int, float)):
                                            new_prop = ifc_file.create_entity("IfcPropertySingleValue", Name=prop_name)
                                            new_prop.NominalValue = ifc_file.create_entity("IfcReal", float(prop_value))
                                        elif isinstance(prop_value, str):
                                            # --- Check if string represents a boolean ---
                                            lower_val = prop_value.lower()
                                            if lower_val == 'true':
                                                new_prop = ifc_file.create_entity("IfcPropertySingleValue", Name=prop_name)
                                                new_prop.NominalValue = ifc_file.create_entity("IfcBoolean", True)
                                            elif lower_val == 'false':
                                                new_prop = ifc_file.create_entity("IfcPropertySingleValue", Name=prop_name)
                                                new_prop.NominalValue = ifc_file.create_entity("IfcBoolean", False)
                                            else:
                                                # Otherwise, treat as regular text
                                                new_prop = ifc_file.create_entity("IfcPropertySingleValue", Name=prop_name)
                                                new_prop.NominalValue = ifc_file.create_entity("IfcText", prop_value)
                                        elif prop_value is None:
                                            # Skip null values
                                            continue
                                        else:
                                            # For complex types, convert to string
                                            new_prop = ifc_file.create_entity("IfcPropertySingleValue", Name=prop_name)
                                            new_prop.NominalValue = ifc_file.create_entity("IfcText", str(prop_value))
                                        
                                        # Add property to property set
                                        existing_pset.HasProperties = list(existing_pset.HasProperties) + [new_prop]
                                        print(f"Added new property {prop_name} to existing property set")
                                    except Exception as e:
                                        print(f"Error creating new property: {e}")
                            else:
                                # Create new property set
                                try:
                                    print(f"Creating new property set {pset_name} for {element.is_a()}")
                                    
                                    # Create property
                                    new_prop = None
                                    
                                    # Create the appropriate property based on value type
                                    if isinstance(prop_value, bool):
                                        new_prop = ifc_file.create_entity("IfcPropertySingleValue", Name=prop_name)
                                        new_prop.NominalValue = ifc_file.create_entity("IfcBoolean", prop_value)
                                    elif isinstance(prop_value, (int, float)):
                                        new_prop = ifc_file.create_entity("IfcPropertySingleValue", Name=prop_name)
                                        new_prop.NominalValue = ifc_file.create_entity("IfcReal", float(prop_value))
                                    elif isinstance(prop_value, str):
                                        new_prop = ifc_file.create_entity("IfcPropertySingleValue", Name=prop_name)
                                        new_prop.NominalValue = ifc_file.create_entity("IfcText", prop_value)
                                    elif prop_value is None:
                                        # Skip null values
                                        continue
                                    else:
                                        # For complex types, convert to string
                                        new_prop = ifc_file.create_entity("IfcPropertySingleValue", Name=prop_name)
                                        new_prop.NominalValue = ifc_file.create_entity("IfcText", str(prop_value))
                                    
                                    # Create property set
                                    pset = ifc_file.create_entity(
                                        "IfcPropertySet",
                                        GlobalId=ifcopenshell.guid.new(),
                                        Name=pset_name,
                                        HasProperties=[new_prop]
                                    )
                                    
                                    # Relate property set to element
                                    rel_props = ifc_file.create_entity(
                                        "IfcRelDefinesByProperties",
                                        GlobalId=ifcopenshell.guid.new()
                                    )
                                    rel_props.RelatingPropertyDefinition = pset
                                    rel_props.RelatedObjects = [element]
                                    print(f"Created new property set {pset_name} with property {prop_name}")
                                except Exception as e:
                                    print(f"Error creating property set: {e}")
                            
                            # Increment counter only if modification was attempted
                            modified_count += 1
                        except Exception as e:
                            print(f"Error during property modification: {e}")
                    except Exception as e:
                        print(f"Error handling property change for element: {e}")
                except Exception as e:
                    print(f"Error handling element {change['globalId']}: {e}")
            
            print(f"Modified {modified_count} elements with property changes")
            
            # Save the IFC file
            print(f"Writing modified IFC file to {temp_path}")
            ifc_file.write(temp_path)
            
            # Read the file back as bytes
            with open(temp_path, 'rb') as f:
                ifc_bytes = f.read()
            
            # Convert bytes to JS-friendly format
            import base64
            ifc_base64 = base64.b64encode(ifc_bytes).decode('utf-8')
            
            # Clean temporary file (though it may not actually delete in WASM environment)
            try:
                os.unlink(temp_path)
            except:
                pass
                
            success = True
            error_msg = None
            error_trace = None
            
        except Exception as e:
            print(f"Python ERROR during export: {str(e)}")
            error_msg = str(e)
            error_trace = traceback.format_exc()
            print(f"Python TRACEBACK: {error_trace}")
            success = False
            ifc_base64 = None
      `,
        { globals: namespace }
      );

      // Check if there was an error
      const success = namespace.get("success");
      console.log("Python export success:", success);

      if (!success) {
        const errorMsg = namespace.get("error_msg");
        const errorTrace = namespace.get("error_trace");
        throw new Error(
          `Python error during export: ${errorMsg}\n${errorTrace}`
        );
      }

      // Get the base64 encoded IFC data
      const ifcBase64 = namespace.get("ifc_base64");

      self.postMessage({
        type: "progress",
        message: "IFC export complete, preparing download...",
        percentage: 90,
        messageId,
      });

      // Create a download URL from the base64 data
      const binaryString = atob(ifcBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "application/ifc" });

      // Clean up
      namespace.destroy();

      // Final progress update
      self.postMessage({
        type: "progress",
        message: "IFC file ready for download!",
        percentage: 100,
        messageId,
      });

      // Send the result back for download
      self.postMessage({
        type: "ifcExported",
        fileName: fileName || "exported.ifc",
        data: blob,
        messageId,
      });
    } catch (pythonError) {
      console.error("Python execution error during export:", pythonError);
      throw new Error(`Python export error: ${pythonError.message}`);
    }
  } catch (error) {
    console.error("handleExportIfc error:", error);
    self.postMessage({
      type: "error",
      message: `Error exporting IFC: ${error.message}`,
      messageId,
    });
  }
}
