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

      case "extractGeometry":
        console.log("Starting to extract geometry using GEOM...", {
          elementType: data.elementType,
          includeOpenings: data.includeOpenings,
        });
        await handleExtractGeometry({ ...data, messageId });
        break;

      case "extractQuantities":
        console.log("Starting quantity extraction...", data);
        await handleExtractQuantities(data, messageId);
        break;

      case "runScript":
        console.log("Executing custom Python script...");
        await handleRunScript(data, messageId);
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
          messageId,
          ...modelInfo, // Spread the properties directly instead of nesting
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

// *** Update the handler function for geometry extraction ***
async function handleExtractGeometry({
  elementType,
  includeOpenings,
  arrayBuffer,
  messageId,
}) {
  try {
    console.log("handleExtractGeometry: Starting", {
      elementType,
      includeOpenings,
    });

    await initPyodide();

    if (!arrayBuffer || !(arrayBuffer instanceof ArrayBuffer)) {
      throw new Error(
        "Valid ArrayBuffer not received in handleExtractGeometry."
      );
    }
    console.log(
      `handleExtractGeometry: Received ArrayBuffer with size ${arrayBuffer.byteLength}`
    );

    // *** Mount buffer directly using FS.createDataFile ***
    const VFS_PATH = "/data"; // A directory in VFS
    const VFS_FILENAME = "model.ifc";
    const VFS_FULL_PATH = `${VFS_PATH}/${VFS_FILENAME}`;
    let mountSuccessful = false;
    try {
      // Ensure directory exists
      pyodide.FS.mkdirTree(VFS_PATH);
      // Convert ArrayBuffer to Uint8Array
      const uint8Array = new Uint8Array(arrayBuffer);
      // Mount the data file (read, write, overwrite allowed)
      pyodide.FS.createDataFile(
        VFS_PATH,
        VFS_FILENAME,
        uint8Array,
        true,
        true,
        true
      );
      console.log(
        `handleExtractGeometry: Mounted ArrayBuffer to VFS at ${VFS_FULL_PATH}`
      );
      mountSuccessful = true;
    } catch (mountError) {
      console.error(
        "handleExtractGeometry: Error mounting buffer to VFS:",
        mountError
      );
      throw new Error(
        `Failed to mount IFC data in worker: ${mountError.message}`
      );
    }

    self.postMessage({
      type: "progress",
      message: "Preparing geometry extraction...",
      percentage: 10,
      messageId,
    });

    // Create a namespace for Python execution
    const namespace = pyodide.globals.get("dict")();

    // Set parameters in the namespace
    namespace.set("element_type", elementType);
    namespace.set("include_openings", includeOpenings ? true : false);
    namespace.set("vfs_path", VFS_FULL_PATH);

    // Prepare Python code for geometry extraction
    const pythonCode = `
import sys
import json
import traceback
import os
import ifcopenshell
import numpy as np
from collections import defaultdict

try:
    # Check if file exists in VFS
    if not os.path.exists(vfs_path):
        raise FileNotFoundError(f"File not found at {vfs_path}")
    
    # Load the IFC file
    ifc_file = ifcopenshell.open(vfs_path)
    print(f"Loaded IFC file with schema: {ifc_file.schema}")
    
    # Determine which element types to extract based on input parameter
    element_types_to_extract = []
    if element_type == "all":
        element_types_to_extract = ["IfcWall", "IfcSlab", "IfcBeam", "IfcColumn", 
                                   "IfcDoor", "IfcWindow", "IfcRoof", "IfcStair", 
                                   "IfcStairFlight", "IfcFurnishingElement", "IfcSpace"]
    else:
        # Map user-friendly types to IFC types
        type_map = {
            "walls": ["IFCWALL", "IFCWALLSTANDARDCASE"],
            "slabs": ["IFCSLAB", "IFCROOF"],
            "columns": ["IFCCOLUMN"],
            "beams": ["IFCBEAM"],
            "doors": ["IFCDOOR"],
            "windows": ["IFCWINDOW"],
            "stairs": ["IFCSTAIR", "IFCSTAIRFLIGHT"],
            "furniture": ["IFCFURNISHINGELEMENT"],
            "spaces": ["IFCSPACE"],
            "openings": ["IFCOPENINGELEMENT"],
        }
        
        if element_type in type_map:
            element_types_to_extract = type_map[element_type]
        else:
            # If unknown type, default to all
            element_types_to_extract = ["IfcWall", "IfcSlab", "IfcBeam", "IfcColumn", 
                                       "IfcDoor", "IfcWindow", "IfcRoof", "IfcStair", 
                                       "IfcStairFlight", "IfcFurnishingElement", "IfcSpace"]
    
    # Get all elements of specified types
    all_elements = []
    for element_type in element_types_to_extract:
        try:
            type_elements = ifc_file.by_type(element_type)
            all_elements.extend(type_elements)
            print(f"Found {len(type_elements)} elements of type {element_type}")
        except Exception as e:
            print(f"Error getting elements of type {element_type}: {e}")
    
    # Filter out openings if necessary
    if not include_openings:
        all_elements = [e for e in all_elements if not e.is_a("IfcOpeningElement")]
    
    # Create results array
    result_elements = []
    total_elements = len(all_elements)
    processed_count = 0
    
    # Helper function to extract placement data from an element
    def get_placement_data(element):
        placement_data = {"type": "placement", "position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}
        
        try:
            if hasattr(element, "ObjectPlacement") and element.ObjectPlacement:
                placement = element.ObjectPlacement
                
                # Get local placement coordinates
                if hasattr(placement, "RelativePlacement") and placement.RelativePlacement:
                    rel_placement = placement.RelativePlacement
                    
                    # Get position from location
                    if hasattr(rel_placement, "Location") and rel_placement.Location:
                        location = rel_placement.Location
                        if hasattr(location, "Coordinates"):
                            coords = location.Coordinates
                            placement_data["position"] = [
                                coords[0] if len(coords) > 0 else 0, 
                                coords[1] if len(coords) > 1 else 0, 
                                coords[2] if len(coords) > 2 else 0
                            ]
                            
                    # Try to get rotation information
                    if hasattr(rel_placement, "RefDirection") and rel_placement.RefDirection:
                        ref_dir = rel_placement.RefDirection
                        if hasattr(ref_dir, "DirectionRatios"):
                            # This is a simplification - proper rotation calculation would require more complex math
                            dir_ratios = ref_dir.DirectionRatios
                            if len(dir_ratios) >= 2:
                                # Calculate rotation angle in Z axis from X direction
                                x, y = dir_ratios[0], dir_ratios[1]
                                angle_z = np.arctan2(y, x)
                                placement_data["rotation"] = [0, 0, angle_z]
        except Exception as e:
            print(f"Error extracting placement: {e}")
            
        return placement_data
    
    # Helper function to extract basic dimensions from an element
    def get_dimensions(element):
        # Default dimensions
        dims = {"x": 1.0, "y": 1.0, "z": 1.0}
        
        try:
            # Try to get dimensions from representation
            if hasattr(element, "Representation") and element.Representation:
                rep = element.Representation
                
                # Look through representations for useful info
                if hasattr(rep, "Representations"):
                    for representation in rep.Representations:
                        rep_id = representation.RepresentationIdentifier if hasattr(representation, "RepresentationIdentifier") else None
                        
                        # Check for quantitative information in property sets
                        if hasattr(element, "IsDefinedBy"):
                            for definition in element.IsDefinedBy:
                                if definition.is_a("IfcRelDefinesByProperties"):
                                    prop_set = definition.RelatingPropertyDefinition
                                    
                                    # Look for quantity sets
                                    if prop_set.is_a("IfcElementQuantity"):
                                        for quantity in prop_set.Quantities:
                                            if quantity.is_a("IfcQuantityLength"):
                                                if quantity.Name == "Length" or quantity.Name == "Width" or quantity.Name == "Height":
                                                    if quantity.Name == "Length":
                                                        dims["x"] = float(quantity.LengthValue)
                                                    elif quantity.Name == "Width":
                                                        dims["y"] = float(quantity.LengthValue)
                                                    elif quantity.Name == "Height":
                                                        dims["z"] = float(quantity.LengthValue)
        except Exception as e:
            print(f"Error getting dimensions: {e}")
            
        # Apply default dimensions based on element type if not found
        if element.is_a("IfcWall") and dims["x"] == 1.0 and dims["y"] == 1.0 and dims["z"] == 1.0:
            dims = {"x": 5.0, "y": 0.3, "z": 3.0}  # Typical wall
        elif element.is_a("IfcSlab") and dims["x"] == 1.0 and dims["y"] == 1.0 and dims["z"] == 1.0:
            dims = {"x": 10.0, "y": 10.0, "z": 0.3}  # Typical slab
        elif element.is_a("IfcDoor") and dims["x"] == 1.0 and dims["y"] == 1.0 and dims["z"] == 1.0:
            dims = {"x": 1.0, "y": 0.2, "z": 2.1}  # Typical door
        elif element.is_a("IfcWindow") and dims["x"] == 1.0 and dims["y"] == 1.0 and dims["z"] == 1.0:
            dims = {"x": 1.5, "y": 0.1, "z": 1.5}  # Typical window
        elif element.is_a("IfcBeam") and dims["x"] == 1.0 and dims["y"] == 1.0 and dims["z"] == 1.0:
            dims = {"x": 5.0, "y": 0.3, "z": 0.5}  # Typical beam
        elif element.is_a("IfcColumn") and dims["x"] == 1.0 and dims["y"] == 1.0 and dims["z"] == 1.0:
            dims = {"x": 0.5, "y": 0.5, "z": 3.0}  # Typical column
            
        return dims
    
    # Process each element to extract simplified geometry
    for element in all_elements:
        try:
            processed_count += 1
            
            # Extract placement data
            placement_data = get_placement_data(element)
            
            # Extract dimensions
            dimensions = get_dimensions(element)
            
            # Create simplified cuboid vertices based on dimensions
            x, y, z = dimensions["x"], dimensions["y"], dimensions["z"]
            
            # Create a simple box - 8 vertices
            verts = [
                # Bottom face
                [-x/2, -y/2, 0],    # 0
                [x/2, -y/2, 0],     # 1
                [x/2, y/2, 0],      # 2
                [-x/2, y/2, 0],     # 3
                # Top face
                [-x/2, -y/2, z],    # 4
                [x/2, -y/2, z],     # 5
                [x/2, y/2, z],      # 6
                [-x/2, y/2, z]      # 7
            ]
            
            # Create simple box faces - 6 faces, each is a quad (4 vertices)
            faces = [
                [0, 1, 2, 3],  # Bottom face
                [4, 5, 6, 7],  # Top face
                [0, 1, 5, 4],  # Front face
                [2, 3, 7, 6],  # Back face
                [0, 3, 7, 4],  # Left face
                [1, 2, 6, 5]   # Right face
            ]
            
            # Basic element data structure
            element_data = {
                "id": f"{element.is_a()}-{element.id()}",
                "expressId": element.id(),
                "type": element.is_a(),
                "properties": {
                    "GlobalId": element.GlobalId if hasattr(element, "GlobalId") else None,
                    "Name": element.Name if hasattr(element, "Name") else None
                },
                "geometry": {
                    "type": "simplified",
                    "vertices": verts,
                    "faces": faces,
                    "dimensions": dimensions,
                    "placement": placement_data
                }
            }
            
            # Add additional IFC properties if available
            try:
                # Try to extract property sets if available
                if hasattr(element, "IsDefinedBy"):
                    property_values = {}
                    for definition in element.IsDefinedBy:
                        if definition.is_a("IfcRelDefinesByProperties"):
                            property_set = definition.RelatingPropertyDefinition
                            if property_set.is_a("IfcPropertySet"):
                                for prop in property_set.HasProperties:
                                    if prop.is_a("IfcPropertySingleValue") and prop.NominalValue:
                                        property_values[prop.Name] = prop.NominalValue.wrappedValue
                    
                    # Add extracted properties
                    element_data["properties"].update(property_values)
            except Exception as props_error:
                print(f"Error extracting properties: {props_error}")
            
            # Add to results
            result_elements.append(element_data)
            
            # Store progress info for JS to retrieve
            progress_info = {
                "processed": processed_count,
                "total": total_elements,
                "percentage": int((processed_count / total_elements) * 100)
            }
            
        except Exception as element_error:
            print(f"Error processing element {element.id()}: {element_error}")
            continue
    
    # Convert results to JSON
    result_json = json.dumps(result_elements)
    
    # Final progress info
    progress_info = {
        "processed": processed_count,
        "total": total_elements,
        "percentage": 100
    }
    
    # Success flag
    success = True
    
except Exception as e:
    print(f"Error in geometry extraction: {e}")
    print(traceback.format_exc())
    result_json = json.dumps([{"error": str(e)}])
    success = False
    progress_info = {"processed": 0, "total": 0, "percentage": 0}
`;

    // Send initial progress update from JavaScript
    self.postMessage({
      type: "progress",
      message: "Loading IFC file...",
      percentage: 20,
      messageId,
    });

    // Execute the Python code with our namespace
    try {
      // Send progress updates at regular intervals during processing
      const progressUpdater = setInterval(() => {
        try {
          // Try to get progress info from namespace if available
          if (namespace.has("progress_info")) {
            const progressInfo = namespace.get("progress_info");
            if (progressInfo) {
              const percentage = Math.min(
                40 + Math.floor(progressInfo.percentage * 0.6),
                99
              );
              self.postMessage({
                type: "progress",
                message: `Processing element ${progressInfo.processed}/${progressInfo.total}...`,
                percentage: percentage,
                messageId,
              });
            }
          }
        } catch (e) {
          // Ignore errors in progress updates
          console.log("Progress update error (non-critical):", e);
        }
      }, 500); // Check progress every 500ms

      // Run the Python code
      await pyodide.runPythonAsync(pythonCode, { globals: namespace });

      // Clear the progress updater
      clearInterval(progressUpdater);

      // Get the result from the namespace
      const success = namespace.get("success");

      if (!success) {
        throw new Error("Geometry extraction failed in Python");
      }

      const resultJson = namespace.get("result_json");
      const elements = JSON.parse(resultJson);

      console.log(
        `handleExtractGeometry: Extracted geometry for ${elements.length} elements`
      );

      // Clean up VFS file
      if (mountSuccessful) {
        try {
          pyodide.FS.unlink(VFS_FULL_PATH);
          console.log(
            `handleExtractGeometry: Cleaned up VFS file ${VFS_FULL_PATH}`
          );
        } catch (unlinkError) {
          console.warn(
            `handleExtractGeometry: Could not unlink ${VFS_FULL_PATH}`,
            unlinkError
          );
        }
      }

      // Clean up namespace
      namespace.destroy();

      self.postMessage({
        type: "progress",
        message: "Geometry extraction complete!",
        percentage: 100,
        messageId,
      });

      // Send the results back to the main thread
      self.postMessage({
        type: "geometry",
        elements: elements,
        messageId,
      });
    } catch (error) {
      console.error("handleExtractGeometry: Python execution error:", error);

      // Clean up
      if (mountSuccessful) {
        try {
          pyodide.FS.unlink(VFS_FULL_PATH);
        } catch (e) { }
      }

      // Clear any progress interval that might be running
      if (typeof progressUpdater !== "undefined") {
        clearInterval(progressUpdater);
      }

      namespace.destroy();

      throw new Error(`Python geometry extraction failed: ${error.message}`);
    }
  } catch (error) {
    console.error("handleExtractGeometry JavaScript Error:", error);
    const errorMessage =
      error instanceof Error ? error.message : error.toString();

    // Clean up VFS file on outer error too
    if (typeof mountSuccessful !== "undefined" && mountSuccessful) {
      try {
        if (pyodide) pyodide.FS.unlink(VFS_FULL_PATH);
      } catch (e) { }
    }

    // Clear any progress interval that might be running
    if (typeof progressUpdater !== "undefined") {
      clearInterval(progressUpdater);
    }

    self.postMessage({
      type: "error",
      message: `Geometry extraction failed: ${errorMessage}`,
      messageId,
    });
  }
}

// Add the new function
async function handleExtractQuantities(data, messageId) {
  try {
    self.postMessage({
      type: "progress",
      message: "Starting quantity extraction...",
      percentage: 10,
      messageId,
    });

    await initPyodide();

    // Prepare parameters
    const { elementIds = [], quantityType = "area", groupBy = "none", arrayBuffer } = data;
    const quantityTypeLower = quantityType.toLowerCase();
    const idsJson = JSON.stringify(elementIds);

    // --- Write the file buffer to VFS --- 
    if (!arrayBuffer || !(arrayBuffer instanceof ArrayBuffer)) {
      throw new Error("ArrayBuffer for IFC file was not provided or is invalid.");
    }
    try {
      console.log("Writing provided IFC data to model.ifc for quantity extraction...");
      pyodide.FS.writeFile("model.ifc", new Uint8Array(arrayBuffer));
      console.log("Successfully wrote model.ifc for quantity extraction.");
    } catch (fsError) {
      console.error("Error writing model.ifc to Pyodide filesystem:", fsError);
      throw new Error(`Failed to prepare IFC file in VFS: ${fsError.message}`);
    }
    // -------------------------------------

    // Create a namespace for Python execution
    const namespace = pyodide.globals.get("dict")();
    namespace.set("element_ids_json", idsJson);
    namespace.set("quantity_type", quantityTypeLower);
    namespace.set("group_by", groupBy);

    // Python code for quantity extraction
    const pythonCode = `
import ifcopenshell
import ifcopenshell.util.unit
import json
import traceback
import os

try:
    # Load the IFC file
    if not os.path.exists('model.ifc'):
        raise FileNotFoundError("The 'model.ifc' file does not exist in the virtual filesystem.")
    
    ifc_file = ifcopenshell.open('model.ifc')
    print(f"Loaded IFC file for quantity extraction")
    
    element_ids = json.loads(element_ids_json)
    quantity_type = quantity_type.lower()
    group_by_option = group_by.lower()
    
    unit_symbol = ""
    
    # Helper: get unit symbol for quantity type
    def get_unit_symbol_for_quantity(ifc_file, quantity_type):
        unit_type_map = {
            "area": "AREAUNIT",
            "volume": "VOLUMEUNIT",
            "length": "LENGTHUNIT",
            # No standard unit type for count
        }
        unit_type = unit_type_map.get(quantity_type)
        if not unit_type:
            return "" # Return empty string for count or unknown types
            
        # Get the project unit entity
        unit_entity = ifcopenshell.util.unit.get_project_unit(ifc_file, unit_type)
        
        if unit_entity:
            # Get the symbol from the unit entity
            return ifcopenshell.util.unit.get_unit_symbol(unit_entity)
        else:
            # Fallback if no project unit is defined
            print(f"Warning: No default project unit found for {unit_type}")
            return unit_type # Return the type name as fallback
            
    # Determine the unit symbol
    unit_symbol = get_unit_symbol_for_quantity(ifc_file, quantity_type)
    print(f"Determined unit symbol: {unit_symbol}")
    
    # Helper: extract quantity from element
    def extract_quantity(element, quantity_type):
        # Try QTO first
        for rel in getattr(element, "IsDefinedBy", []):
            if rel.is_a("IfcRelDefinesByProperties"):
                prop_def = rel.RelatingPropertyDefinition
                if prop_def.is_a("IfcElementQuantity"):
                    for q in getattr(prop_def, "Quantities", []):
                        if quantity_type == "area" and q.is_a("IfcQuantityArea"):
                            return getattr(q, "AreaValue", None)
                        elif quantity_type == "volume" and q.is_a("IfcQuantityVolume"):
                            return getattr(q, "VolumeValue", None)
                        elif quantity_type == "length" and q.is_a("IfcQuantityLength"):
                            return getattr(q, "LengthValue", None)
        # Fallback: count as 1 if type is count
        if quantity_type == "count":
            return 1
        return None

    # Process elements and collect quantities
    processed = 0
    element_quantities = []
    
    for eid in element_ids:
        try:
            element = ifc_file.by_id(eid)
            if not element:
                continue
                
            value = extract_quantity(element, quantity_type)
            if value is None:
                continue

            # Get grouping value based on chosen groupBy option
            group_value = "All" 
            if group_by_option == "type":
                # Use element type without Ifc prefix for readability
                element_type = element.is_a()
                if element_type:
                    # Remove "Ifc" prefix if present
                    if element_type.startswith("Ifc"):
                        element_type = element_type[3:]
                    group_value = element_type
                    
            elif group_by_option == "level":
                # Try to find the building storey
                for rel in ifc_file.by_type("IfcRelContainedInSpatialStructure"):
                    if not hasattr(rel, "RelatedElements") or not rel.RelatedElements:
                        continue
                        
                    if not hasattr(rel, "RelatingStructure") or not rel.RelatingStructure:
                        continue
                        
                    is_in_relation = False
                    for related_element in rel.RelatedElements:
                        if related_element.id() == eid:
                            is_in_relation = True
                            break
                            
                    if is_in_relation and rel.RelatingStructure.is_a("IfcBuildingStorey"):
                        storey_name = getattr(rel.RelatingStructure, "Name", None) or f"Level {rel.RelatingStructure.id()}"
                        group_value = storey_name
                        break
                        
            elif group_by_option == "material":
                # Try to find material information
                material_name = "Unknown"
                
                for rel in ifc_file.by_type("IfcRelAssociatesMaterial"):
                    if not hasattr(rel, "RelatedObjects") or not rel.RelatedObjects:
                        continue
                    is_related = False
                    for related_obj in rel.RelatedObjects:
                        if related_obj.id() == eid:
                            is_related = True
                            break
                    if is_related and hasattr(rel, "RelatingMaterial"):
                        material = rel.RelatingMaterial
                        if material.is_a("IfcMaterial"):
                            material_name = getattr(material, "Name", "Unknown Material")
                        elif material.is_a("IfcMaterialList"):
                            if material.Materials and len(material.Materials) > 0:
                                material_name = getattr(material.Materials[0], "Name", "Unknown Material")
                        elif material.is_a("IfcMaterialLayerSetUsage") and hasattr(material, "ForLayerSet"):
                            layer_set = material.ForLayerSet
                            if hasattr(layer_set, "MaterialLayers") and layer_set.MaterialLayers:
                                first_layer = layer_set.MaterialLayers[0]
                                if hasattr(first_layer, "Material") and first_layer.Material:
                                    material_name = getattr(first_layer.Material, "Name", "Unknown Material")
                        group_value = material_name
                        break
            
            element_quantities.append({
                "expressId": eid,
                "quantity": value,
                "group": group_value
            })
            
            processed += 1
            if processed % 20 == 0:
                progress = int(10 + 80 * processed / max(1, len(element_ids)))
                globals()["progress_info"] = {"processed": processed, "total": len(element_ids), "percentage": progress}
        except Exception as elem_err:
            print(f"Error processing element {eid}: {elem_err}")
            continue
    
    # Group the results by the selected groupBy option
    grouped_quantities = {}
    for item in element_quantities:
        group = item["group"]
        quantity = item["quantity"]
        if group not in grouped_quantities:
            grouped_quantities[group] = 0
        grouped_quantities[group] += quantity
    if not grouped_quantities:
        grouped_quantities["All"] = 0
    
    total_quantity = sum(grouped_quantities.values())
    globals()["progress_info"] = {"processed": processed, "total": len(element_ids), "percentage": 90}
    
    # Create the result object using the unit_symbol
    result = {
        "groups": grouped_quantities,
        "unit": unit_symbol,  # Use the determined symbol here
        "total": total_quantity,
        "groupBy": group_by_option
    }
    
    result_json = json.dumps(result)
    success = True
    error_msg = None
    error_trace = None
except Exception as e:
    result = {
        "groups": {"Error": 0},
        "unit": "",
        "total": 0,
        "error": str(e)
    }
    result_json = json.dumps(result)
    success = False
    error_msg = str(e)
    error_trace = traceback.format_exc()
`;

    // Progress updater
    const progressUpdater = setInterval(() => {
      try {
        if (namespace.has("progress_info")) {
          const progressInfo = namespace.get("progress_info");
          if (progressInfo) {
            self.postMessage({
              type: "progress",
              message: `Extracted ${progressInfo.processed}/${progressInfo.total} elements...`,
              percentage: progressInfo.percentage,
              messageId,
            });
          }
        }
      } catch (e) { }
    }, 500);

    // Run the Python code
    await pyodide.runPythonAsync(pythonCode, { globals: namespace });
    clearInterval(progressUpdater);

    const success = namespace.get("success");
    if (!success) {
      const errorMsg = namespace.get("error_msg");
      const errorTrace = namespace.get("error_trace");
      throw new Error(`Python error: ${errorMsg}\n${errorTrace}`);
    }

    const resultJson = namespace.get("result_json");
    const results = JSON.parse(resultJson);

    namespace.destroy();

    self.postMessage({
      type: "progress",
      message: "Quantity extraction complete!",
      percentage: 100,
      messageId,
    });

    self.postMessage({
      type: "quantityResults",
      messageId,
      data: results,
    });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: `Error extracting quantities: ${error.message}`,
      messageId,
    });
  }
}

async function handleRunScript(data, messageId) {
  try {
    await initPyodide();
    const { script = "", input } = data;
    const namespace = pyodide.globals.get("dict")();
    namespace.set("input_json", JSON.stringify(input));
    namespace.set("user_script", script);
    await pyodide.runPythonAsync(
      `import json, io, sys, traceback
input_data = json.loads(input_json)
stdout_buf = io.StringIO()
_stdout = sys.stdout
sys.stdout = stdout_buf
result = None
try:
    exec(user_script, globals(), locals())
    result = locals().get('result', None)
except Exception as e:
    result = {"error": str(e), "trace": traceback.format_exc()}
sys.stdout = _stdout
console_output = stdout_buf.getvalue()
result_json = json.dumps(result)
`,
      { globals: namespace }
    );
    const outputJson = namespace.get("result_json");
    const consoleOut = namespace.get("console_output");
    namespace.destroy();
    self.postMessage({
      type: "scriptResult",
      messageId,
      result: JSON.parse(outputJson),
      console: consoleOut,
    });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: `Script error: ${error.message}`,
      messageId,
    });
  }
}
