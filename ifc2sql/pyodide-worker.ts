// Web Worker for Pyodide and IfcOpenShell processing
// This runs in a separate thread to avoid blocking the main UI

export interface PyodideMessage {
  type: "init" | "process" | "progress" | "complete" | "error" | "execute_query" | "export_sqlite" | "sqlite_export"
  data?: any
  progress?: number
  step?: string
  query?: string
}

export interface ProcessingResult {
  tables: string[]
  totalEntities: number
  schema: string
  sqliteData: ArrayBuffer
  entities: Record<string, any[]>
  properties: any[]
}

// This would be the actual worker implementation
export const createPyodideWorker = async () => {
  const response = await fetch("/ifc2sql.py")
  if (!response.ok) {
    throw new Error('Failed to fetch ifc2sql.py: ' + response.status + ' ' + response.statusText)
  }
  const ifc2sqlCode = await response.text()

  // Encode the Python code as base64 to avoid template literal issues
  const encodedIfc2sqlCode = btoa(unescape(encodeURIComponent(ifc2sqlCode)))

  const workerCode = `
    let pyodide = null;
    let sqliteDbPath = null;

    self.onmessage = async function(e) {
      const { type, data } = e.data;
      
      try {
        switch (type) {
          case 'init':
            await initializePyodide();
            break;
          case 'process':
            await processIfcFile(data.fileBuffer, data.fileName);
            break;
          case 'execute_query':
            await executeQuery(data.query);
            break;
          case 'export_sqlite':
            await exportSQLiteDatabase();
            break;
        }
      } catch (error) {
        console.error('[v0] Worker error:', error);
        self.postMessage({
          type: 'error',
          data: { message: error.message, stack: error.stack }
        });
      }
    };

    async function initializePyodide() {
      try {
        // Starting Pyodide initialization silently
        self.postMessage({ type: 'progress', progress: 5, step: 'Loading Pyodide...' });
        
        importScripts('https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js');
        pyodide = await loadPyodide({
          indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.23.4/full/'
        });
        
        // Pyodide loaded successfully
        self.postMessage({ type: 'progress', progress: 20, step: 'Installing base packages...' });
        
        await pyodide.loadPackage(['micropip', 'numpy']);
        // Base packages loaded silently
        
        self.postMessage({ type: 'progress', progress: 30, step: 'Installing shapely...' });
        await pyodide.loadPackage(['shapely']);

        self.postMessage({ type: 'progress', progress: 35, step: 'Installing typing-extensions...' });
        await pyodide.loadPackage(['typing-extensions']);

        self.postMessage({ type: 'progress', progress: 37, step: 'Installing sqlite3...' });
        await pyodide.loadPackage(['sqlite3']);
        
        self.postMessage({ type: 'progress', progress: 40, step: 'Installing IfcOpenShell...' });
        
        await pyodide.runPythonAsync(\`
import micropip

# Applying compatibility bypass patch...
print("Applying compatibility bypass patch...")

# Import the WheelInfo class and patch it before any wheel operations
from micropip._micropip import WheelInfo

# Override the check_compatible method to always pass
def bypass_compatibility_check(self):
    print(f"Bypassing compatibility check for wheel: {getattr(self, 'name', 'unknown')}")
    return None

# Apply the monkey-patch
WheelInfo.check_compatible = bypass_compatibility_check
print("Compatibility check bypassed successfully")

# Install lark dependency first
print("Installing lark dependency...")
await micropip.install('lark')
print("Lark installed successfully")

print("Installing IfcOpenShell wheel...")
await micropip.install('https://cdn.jsdelivr.net/gh/IfcOpenShell/wasm-wheels@33b437e5fd5425e606f34aff602c42034ff5e6dc/ifcopenshell-0.8.1+latest-cp312-cp312-emscripten_3_1_58_wasm32.whl')
print("IfcOpenShell installed successfully")

print("Installing ifcpatch dependency...")
try:
    await micropip.install('ifcpatch', keep_going=True)
    print("ifcpatch installed successfully")
except Exception as e:
    print(f"Warning: ifcpatch installation had issues: {e}")
    print("Continuing without ifcpatch - using direct ifcopenshell.sql instead")
        \`);
        
        // IfcOpenShell installed successfully
        self.postMessage({ type: 'progress', progress: 60, step: 'Loading ifc2sql.py module...' });
        
        // Loading ifc2sql.py module silently
        
        await pyodide.runPythonAsync(\`
import ifcopenshell
import json
import tempfile
import os
import sys
import base64
import sqlite3

print(f"IfcOpenShell version: {ifcopenshell.version}")

print("Loading official ifc2sql.py Patcher class...")
# Decode the base64 encoded Python code
encoded_code = "${encodedIfc2sqlCode}"
ifc2sql_code = base64.b64decode(encoded_code).decode('utf-8')
exec(ifc2sql_code)
print("Official ifc2sql Patcher class loaded successfully")

def process_ifc_to_sqlite(file_content, filename):
    """Process IFC file using the official ifc2sql.py Patcher class"""
    print(f"Processing IFC file: {filename}")
    print(f"File size: {len(file_content)} bytes")
    
    try:
        # Write file content to temporary file
        temp_ifc_path = '/tmp/model.ifc'
        with open(temp_ifc_path, 'wb') as f:
            f.write(bytes(file_content))
        print(f"IFC file written to: {temp_ifc_path}")
        
        # Open IFC file with IfcOpenShell
        print("Opening IFC file with IfcOpenShell...")
        ifc_file = ifcopenshell.open(temp_ifc_path)
        print("IFC file opened successfully")
        print(f"Schema: {ifc_file.schema}")
        
        sqlite_db_path = '/tmp/model.db'
        
        print("Creating SQLite database using official ifc2sql.py Patcher...")
        
        # Remove existing database if present
        if os.path.exists(sqlite_db_path):
            os.remove(sqlite_db_path)
        
        # Create the official Patcher instance with comprehensive options
        patcher = Patcher(
            file=ifc_file,
            sql_type="SQLite",
            database=sqlite_db_path,
            full_schema=False,  # Only create tables for classes in the dataset
            is_strict=False,    # Don't enforce strict null constraints
            should_expand=False,  # Keep ifc_id as primary key
            should_get_inverses=True,   # Get inverse relationships
            should_get_psets=True,      # Get property sets
            should_get_geometry=False,   # Skip geometry for browser performance
            should_skip_geometry_data=True  # Skip geometry representation tables
        )
        
        print("Executing official ifc2sql patch...")
        patcher.patch()
        
        output_path = patcher.get_output()
        print(f"SQLite database created at: {output_path}")
        
        print("Opening SQLite database with ifcopenshell.sql.sqlite...")
        db = ifcopenshell.sql.sqlite(output_path)
        print(f"Database opened successfully. Schema: {db.schema}")
        
        # Extract entity information from major types only for performance
        print("Extracting key entity information...")
        entities = {}
        total_entities = 0

        # Get all available entity types from the database
        cursor = db.db.cursor()
        cursor.execute("SELECT DISTINCT ifc_class FROM id_map ORDER BY ifc_class")
        available_types = [row[0] for row in cursor.fetchall()]

        # Process major architectural/building elements, materials, quantities, and classifications
        major_types = [
            'IfcBuilding', 'IfcBuildingStorey', 'IfcWall', 'IfcSlab', 'IfcColumn', 'IfcBeam', 'IfcDoor', 'IfcWindow', 'IfcFurniture', 'IfcSpace',
            'IfcMaterial', 'IfcMaterialConstituent', 'IfcMaterialConstituentSet', 'IfcMaterialLayer', 'IfcMaterialLayerSet',
            'IfcQuantityLength', 'IfcQuantityVolume', 'IfcQuantityArea', 'IfcQuantityCount', 'IfcQuantityWeight', 'IfcPhysicalComplexQuantity',
            'IfcClassification', 'IfcClassificationReference', 'IfcRelAssociatesMaterial', 'IfcMaterialDefinition'
        ]
        types_to_process = [t for t in available_types if t in major_types]

        print(f"Processing {len(types_to_process)} major entity types")

        # Process each major entity type
        for ifc_type in types_to_process:
            try:
                elements = db.by_type(ifc_type)
                if elements:
                    entities[ifc_type] = []
                    limit = len(elements)
                    
                    for element in elements[:limit]:
                        try:
                            # Use get_info() to get ALL attributes, with robust error handling
                            try:
                                # Try get_info() first - this is the standard way to get all attributes
                                # Use recursive=True and scalar_only=False to resolve "Empty Object" references
                                entity_info = element.get_info(recursive=True, scalar_only=False)

                                # Ensure essential fields are present (get_info() might miss some)
                                entity_info.update({
                                    'id': element.id(),
                                    'Type': element.is_a(),
                                    'Name': getattr(element, 'Name', None) or str(element.id())
                                })

                                # Add GlobalId if not present
                                if 'GlobalId' not in entity_info:
                                    entity_info['GlobalId'] = getattr(element, 'GlobalId', None)

                                # Add other common IFC attributes that might be missing
                                common_attrs = ['ObjectType', 'Tag', 'PredefinedType', 'Description', 'LongName']
                                for attr_name in common_attrs:
                                    if attr_name not in entity_info and hasattr(element, attr_name):
                                        try:
                                            attr_value = getattr(element, attr_name)
                                            if attr_value is not None:
                                                entity_info[attr_name] = attr_value
                                        except:
                                            pass

                            except Exception as get_info_error:
                                # get_info() failed, use fallback approach
                                entity_info = {
                                    'id': element.id(),
                                    'Type': element.is_a(),
                                    'Name': getattr(element, 'Name', None) or str(element.id()),
                                    'GlobalId': getattr(element, 'GlobalId', None)
                                }

                                # Add common attributes even in fallback
                                common_attrs = ['ObjectType', 'Tag', 'PredefinedType', 'Description', 'LongName']
                                for attr_name in common_attrs:
                                    if hasattr(element, attr_name):
                                        try:
                                            attr_value = getattr(element, attr_name)
                                            if attr_value is not None:
                                                entity_info[attr_name] = attr_value
                                        except:
                                            pass

                            # Now enhance with direct attribute access for any missing data
                            try:
                                attr_count = element.attribute_count()

                                # Get all attribute names to ensure we don't miss any
                                all_attr_names = set()
                                for i in range(attr_count):
                                    try:
                                        attr = element.attribute_by_index(i)
                                        attr_name = attr.name()
                                        all_attr_names.add(attr_name)
                                    except:
                                        continue

                                # Ensure all attributes are represented using proper IFC access
                                for i in range(attr_count):
                                    try:
                                        attr = element.attribute_by_index(i)
                                        attr_name = attr.name()

                                        # Skip if we already have this attribute from get_info()
                                        if attr_name in entity_info and entity_info[attr_name] is not None:
                                            continue

                                        # Use proper IFC attribute access
                                        raw_value = element[i]
                                        if raw_value is not None:
                                            entity_info[attr_name] = raw_value
                                            print(f"Added missing attribute {attr_name}: {type(raw_value)}")
                                    except Exception as attr_access_error:
                                        print(f"Attribute access failed for index {i}: {attr_access_error}")
                                        continue

                                print(f"After attribute access, entity_info keys: {list(entity_info.keys())}")

                                # Enhanced processing for complex IFC relationships
                                for i in range(attr_count):
                                    try:
                                        attr = element.attribute_by_index(i)
                                        attr_name = attr.name()

                                        if attr_name in ['ObjectPlacement', 'Representation', 'OwnerHistory']:
                                            raw_value = element[i]
                                            if raw_value is not None and hasattr(raw_value, 'id') and hasattr(raw_value, 'is_a'):
                                                # Enhanced entity reference with additional details
                                                entity_ref = {
                                                    'id': raw_value.id(),
                                                    'type': raw_value.is_a(),
                                                    'name': getattr(raw_value, 'Name', None) or str(raw_value.id())
                                                }

                                                # Add specific details for common IFC objects
                                                if attr_name == 'ObjectPlacement':
                                                    try:
                                                        if hasattr(raw_value, 'RelativePlacement'):
                                                            rel_placement = raw_value.RelativePlacement
                                                            if hasattr(rel_placement, 'Location'):
                                                                location = rel_placement.Location
                                                                if hasattr(location, 'Coordinates'):
                                                                    coords = location.Coordinates
                                                                    if hasattr(coords, '__len__') and len(coords) >= 3:
                                                                        entity_ref['coordinates'] = [float(coords[0]), float(coords[1]), float(coords[2])]
                                                    except:
                                                        pass

                                                elif attr_name == 'Representation':
                                                    try:
                                                        if hasattr(raw_value, 'Representations'):
                                                            reps = raw_value.Representations
                                                            entity_ref['representation_count'] = len(reps) if hasattr(reps, '__len__') else 0
                                                    except:
                                                        pass

                                                elif attr_name == 'OwnerHistory':
                                                    try:
                                                        if hasattr(raw_value, 'OwningUser'):
                                                            user = raw_value.OwningUser
                                                            if hasattr(user, 'ThePerson'):
                                                                person = user.ThePerson
                                                                if hasattr(person, 'GivenName'):
                                                                    entity_ref['user'] = f"{getattr(person, 'GivenName', '')} {getattr(person, 'FamilyName', '')}".strip()
                                                    except:
                                                        pass

                                                entity_info[attr_name] = entity_ref

                                    except:
                                        continue

                            except Exception as extraction_error:
                                # Keep the entity_info we got from get_info(), don't lose data
                                pass

                            # Add specific quantity values for better display
                            if element.is_a().startswith('IfcQuantity'):
                                if hasattr(element, 'LengthValue') and element.LengthValue is not None:
                                    entity_info['LengthValue'] = element.LengthValue
                                if hasattr(element, 'AreaValue') and element.AreaValue is not None:
                                    entity_info['AreaValue'] = element.AreaValue
                                if hasattr(element, 'VolumeValue') and element.VolumeValue is not None:
                                    entity_info['VolumeValue'] = element.VolumeValue
                                if hasattr(element, 'CountValue') and element.CountValue is not None:
                                    entity_info['CountValue'] = element.CountValue
                                if hasattr(element, 'WeightValue') and element.WeightValue is not None:
                                    entity_info['WeightValue'] = element.WeightValue

                            # Add material-specific attributes
                            if element.is_a().startswith('IfcMaterial'):
                                if hasattr(element, 'Category'):
                                    entity_info['Category'] = element.Category
                                if hasattr(element, 'Description'):
                                    entity_info['Description'] = element.Description
                                if hasattr(element, 'Name'):
                                    entity_info['MaterialName'] = element.Name
                                entity_info['MaterialType'] = element.is_a()

                            # Add material layer attributes
                            if element.is_a().startswith('IfcMaterialLayer'):
                                if hasattr(element, 'LayerThickness'):
                                    entity_info['LayerThickness'] = element.LayerThickness
                                if hasattr(element, 'Material'):
                                    entity_info['Material'] = element.Material
                                entity_info['LayerType'] = element.is_a()

                            # Add material relationship attributes
                            if element.is_a().startswith('IfcRelAssociatesMaterial'):
                                if hasattr(element, 'RelatingMaterial'):
                                    entity_info['RelatingMaterial'] = element.RelatingMaterial
                                entity_info['RelationshipType'] = element.is_a()

                            # Processing complete for this entity

                            entities[ifc_type].append(entity_info)
                            total_entities += 1
                        except Exception as entity_error:
                            print(f"Failed to process entity {ifc_type}: {entity_error}")
                            # Skip problematic entities silently for performance
                            continue
                    
            except Exception as e:
                print(f"Error processing {ifc_type}: {e}")
        
        # Get property sets data - simplified for performance
        print("Extracting key properties...")
        cursor.execute("SELECT COUNT(*) FROM psets")
        total_pset_count = cursor.fetchone()[0]

        # Only extract properties for major entity types
        major_type_ids = set()
        for ifc_type in types_to_process:
            if ifc_type in entities:
                for entity in entities[ifc_type]:
                    major_type_ids.add(entity['id'])

        # Process in batches to avoid SQLite parameter limit
        pset_data = []
        if major_type_ids:
            batch_size = 500  # SQLite limit is around 999 parameters
            ids_list = list(major_type_ids)
            for i in range(0, len(ids_list), batch_size):
                batch_ids = ids_list[i:i + batch_size]
                placeholders = ','.join('?' * len(batch_ids))
                cursor.execute(f"SELECT ifc_id, pset_name, name, value FROM psets WHERE ifc_id IN ({placeholders}) ORDER BY ifc_id", batch_ids)
                pset_data.extend(cursor.fetchall())

        # Enhanced property extraction with metadata
        properties = []
        for entity_id, pset_name, prop_name, prop_value in pset_data:
            property_info = {
                'entity_id': entity_id,
                'pset_name': pset_name,
                'property_name': prop_name,
                'property_value': prop_value,
                'property_type': 'Unknown',
                'unit': None,
                'category': 'Property'
            }

            # Determine property type and unit based on name and value
            if isinstance(prop_value, (int, float)):
                if any(keyword in prop_name.upper() for keyword in ['LENGTH', 'WIDTH', 'HEIGHT', 'DEPTH', 'THICKNESS', 'DIAMETER']):
                    property_info['property_type'] = 'Length'
                    property_info['unit'] = 'mm'
                    property_info['category'] = 'Dimension'
                elif any(keyword in prop_name.upper() for keyword in ['AREA', 'SURFACE']):
                    property_info['property_type'] = 'Area'
                    property_info['unit'] = 'm²'
                    property_info['category'] = 'Dimension'
                elif any(keyword in prop_name.upper() for keyword in ['VOLUME', 'CAPACITY']):
                    property_info['property_type'] = 'Volume'
                    property_info['unit'] = 'm³'
                    property_info['category'] = 'Dimension'
                elif any(keyword in prop_name.upper() for keyword in ['MASS', 'WEIGHT']):
                    property_info['property_type'] = 'Mass'
                    property_info['unit'] = 'kg'
                    property_info['category'] = 'Physical'
                elif any(keyword in prop_name.upper() for keyword in ['COST', 'PRICE', 'VALUE']):
                    property_info['property_type'] = 'Cost'
                    property_info['unit'] = 'EUR'
                    property_info['category'] = 'Economic'
                elif any(keyword in prop_name.upper() for keyword in ['COUNT', 'QUANTITY', 'NUMBER']):
                    property_info['property_type'] = 'Count'
                    property_info['unit'] = 'pcs'
                    property_info['category'] = 'Quantity'
                elif any(keyword in prop_name.upper() for keyword in ['LOAD', 'FORCE', 'STRESS']):
                    property_info['property_type'] = 'Force'
                    property_info['unit'] = 'kN'
                    property_info['category'] = 'Structural'
                else:
                    property_info['property_type'] = 'Numeric'
                    property_info['category'] = 'General'

            elif isinstance(prop_value, str):
                if prop_value.startswith('#'):
                    property_info['property_type'] = 'Entity Reference'
                    property_info['category'] = 'Reference'
                elif any(keyword in prop_name.upper() for keyword in ['MATERIAL', 'FINISH', 'COLOR', 'TYPE']):
                    property_info['property_type'] = 'Material'
                    property_info['category'] = 'Material'
                elif any(keyword in prop_name.upper() for keyword in ['CODE', 'STANDARD', 'SPECIFICATION']):
                    property_info['property_type'] = 'Code'
                    property_info['category'] = 'Specification'
                elif any(keyword in prop_name.upper() for keyword in ['NAME', 'DESCRIPTION', 'LABEL']):
                    property_info['property_type'] = 'Text'
                    property_info['category'] = 'Identification'
                else:
                    property_info['property_type'] = 'Text'
                    property_info['category'] = 'General'

            elif isinstance(prop_value, bool):
                property_info['property_type'] = 'Boolean'
                property_info['category'] = 'Condition'
            else:
                property_info['property_type'] = 'Complex'
                property_info['category'] = 'Complex'

            # Add property set category based on name
            if 'QTO_' in pset_name.upper() or 'QUANTITY' in pset_name.upper():
                property_info['pset_category'] = 'Quantity'
            elif 'PSET_' in pset_name.upper():
                property_info['pset_category'] = 'Property Set'
            elif any(keyword in pset_name.upper() for keyword in ['MATERIAL', 'FINISH', 'COLOR']):
                property_info['pset_category'] = 'Material'
            elif any(keyword in pset_name.upper() for keyword in ['STRUCTURAL', 'LOAD', 'FORCE']):
                property_info['pset_category'] = 'Structural'
            else:
                property_info['pset_category'] = 'General'

            properties.append(property_info)

        print(f"Extracted {len(properties)} key properties (from {total_pset_count} total)")
        
        # Prepare result
        result = {
            'tables': list(entities.keys()),
            'totalEntities': total_entities,
            'schema': ifc_file.schema,
            'entities': entities,
            'properties': properties,
            'processingMethod': 'Official ifc2sql.py Patcher with ifcopenshell.sql.sqlite',
            'fileName': filename
        }
        
        print("Processing completed successfully using official ifc2sql.py")
        print(f"Total entities processed: {total_entities}")
        print(f"Entity types found: {len(entities)}")
        print(f"Properties extracted: {len(properties)}")
        
        return result
        
    except Exception as e:
        print(f"Critical error processing IFC file: {e}")
        import traceback
        traceback.print_exc()
        raise Exception(f"Failed to process IFC file '{filename}': {str(e)}")

print("IFC processing environment initialized with official ifc2sql.py")
        \`);
        
        // Official ifc2sql.py environment initialized successfully
        self.postMessage({ type: 'progress', progress: 100, step: 'Ready for processing' });
        self.postMessage({ type: 'init', data: { ready: true } });
        
      } catch (error) {
        console.error('[v0] Initialization failed:', error);
        self.postMessage({
          type: 'error',
          data: { 
            message: 'Failed to initialize IfcOpenShell: ' + error.message,
            stack: error.stack 
          }
        });
      }
    }

    async function processIfcFile(fileBuffer, fileName) {
      try {
        // Processing file: ' + fileName + ' silently
        self.postMessage({ type: 'progress', progress: 60, step: 'Processing with official ifc2sql.py' });
        
        // Convert ArrayBuffer to bytes for Python
        const uint8Array = new Uint8Array(fileBuffer);
        pyodide.globals.set('file_content', uint8Array);
        pyodide.globals.set('file_name', fileName);
        
        self.postMessage({ type: 'progress', progress: 80, step: 'Converting to SQLite using official Patcher' });
        
        // Execute the processing function
        await pyodide.runPythonAsync(\`
print("[DEBUG] About to call process_ifc_to_sqlite with official ifc2sql.py...")
processing_result = process_ifc_to_sqlite(file_content, file_name)
print("[DEBUG] Official ifc2sql.py processing completed successfully")

global sqlite_db_path
sqlite_db_path = '/tmp/model.db'
print(f"[DEBUG] SQLite database path set to: {sqlite_db_path}")
        \`);
        
        sqliteDbPath = '/tmp/model.db';
        
        // Get the result from Python
        const result = pyodide.globals.get('processing_result');
        
        if (!result) {
          throw new Error('No result returned from Python processing');
        }
        
        let jsResult;
        try {
          // Convert to JS with proper dict converter
          jsResult = result.toJs ? result.toJs({ dict_converter: Object.fromEntries }) : result;

          // Debug: Basic info about the result
          if (!jsResult.entities || Object.keys(jsResult.entities).length === 0) {
            console.warn('[v0] Warning: No entities found in processing result');
          }

          // Convert PyProxy objects to plain JavaScript objects for worker communication
          const convertPyProxyToJS = (obj, depth = 0) => {
            if (!obj || typeof obj !== 'object') {
              return obj;
            }

            // Prevent infinite recursion
            if (depth > 10) {
              console.warn('[v0] Max depth reached, returning string representation');
              return String(obj);
            }

            // Handle PyProxy objects specifically
            if (obj.constructor && obj.constructor.name === 'PyProxy') {
              try {
                const converted = obj.toJs ? obj.toJs({ dict_converter: Object.fromEntries }) : String(obj);
                return convertPyProxyToJS(converted, depth + 1);
              } catch (e) {
                console.error('[v0] Error converting PyProxy:', e);
                return String(obj);
              }
            }

            // Handle arrays
            if (Array.isArray(obj)) {
              return obj.map(item => convertPyProxyToJS(item, depth + 1));
            }

            // Handle regular objects - preserve all properties
            const result = {};
            for (const [key, value] of Object.entries(obj)) {
              // Special handling for complex IFC objects
              // (logging removed to reduce console spam)
              result[key] = convertPyProxyToJS(value, depth + 1);
            }
            return result;
          };

          jsResult = convertPyProxyToJS(jsResult);

          // Final JSON serialization with special handling for complex objects
          jsResult = JSON.parse(JSON.stringify(jsResult, (key, value) => {
            // Last chance to handle any remaining proxy objects
            if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'PyProxy') {
              return value.toJs ? value.toJs() : String(value);
            }
            // Ensure complex IFC objects are preserved
            // (complex object preservation handled silently)
            return value;
          }));

          // Processing completed silently
        } catch (conversionError) {
          console.error('[v0] Error converting Python result:', conversionError);
          throw new Error('Failed to convert Python result to JavaScript: ' + conversionError.message);
        }
        
        if (jsResult && jsResult.error) {
          throw new Error('Python processing error: ' + jsResult.message);
        }
        
        // IFC processing completed successfully using official ifc2sql.py
        self.postMessage({ type: 'progress', progress: 100, step: 'Processing Complete' });
        self.postMessage({ type: 'complete', data: jsResult });
        
      } catch (error) {
        console.error('[v0] File processing failed:', error);
        self.postMessage({
          type: 'error',
          data: { 
            message: 'Failed to process IFC file: ' + error.message,
            stack: error.stack 
          }
        });
      }
    }

    async function executeQuery(query) {
      try {
        // Executing SQL query silently
        
        if (!pyodide) {
          throw new Error('Pyodide not initialized');
        }
        
        if (!sqliteDbPath) {
          throw new Error('No SQLite database available. Please process an IFC file first.');
        }
        
        // Set the query in Python scope
        pyodide.globals.set('sql_query', query);
        
        // Execute the query using Python
        await pyodide.runPythonAsync(\`
import sqlite3
import json

try:
    print(f"Executing query: {sql_query}")
    
    if 'sqlite_db_path' not in globals():
        sqlite_db_path = '/tmp/model.db'
        print(f"Using default database path: {sqlite_db_path}")
    else:
        print(f"Using existing database path: {sqlite_db_path}")
    
    # Connect to the SQLite database
    conn = sqlite3.connect(sqlite_db_path)
    conn.row_factory = sqlite3.Row  # Enable column access by name
    cursor = conn.cursor()
    
    # Execute the query
    cursor.execute(sql_query)
    
    # Fetch all results
    rows = cursor.fetchall()
    
    # Convert to list of dictionaries
    query_results = []
    for row in rows:
        row_dict = {}
        for key in row.keys():
            value = row[key]
            # Handle None values and ensure JSON serializable
            if value is None:
                row_dict[key] = None
            elif isinstance(value, (int, float, str, bool)):
                row_dict[key] = value
            else:
                row_dict[key] = str(value)
        query_results.append(row_dict)
    
    conn.close()
    
    print(f"Query executed successfully, returned {len(query_results)} rows")
    
except Exception as e:
    print(f"Query execution error: {e}")
    import traceback
    traceback.print_exc()
    query_results = {"error": str(e)}
        \`);
        
        // Get the results from Python
        const results = pyodide.globals.get('query_results');
        
        if (!results) {
          throw new Error('No results returned from query execution');
        }
        
        let jsResults;
        try {
          // Convert to JavaScript
          jsResults = results.toJs ? results.toJs({ dict_converter: Object.fromEntries }) : results;
          
          // Deep serialize to ensure no proxy objects remain
          const serializedResults = JSON.parse(JSON.stringify(jsResults, (key, value) => {
            if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'PyProxy') {
              return value.toJs ? value.toJs() : String(value);
            }
            return value;
          }));
          
          jsResults = serializedResults;
        } catch (conversionError) {
          console.error('[v0] Error converting query results:', conversionError);
          throw new Error('Failed to convert query results to JavaScript: ' + conversionError.message);
        }
        
        if (jsResults && jsResults.error) {
          throw new Error('SQL execution error: ' + jsResults.error);
        }
        
        // Query executed successfully
        self.postMessage({ type: 'query_result', data: jsResults });
        
      } catch (error) {
        console.error('[v0] Query execution failed:', error);
        self.postMessage({
          type: 'error',
          data: {
            message: 'Failed to execute query: ' + error.message,
            stack: error.stack
          }
        });
      }
    }

    async function exportSQLiteDatabase() {
      try {
        // Exporting SQLite database silently

        if (!pyodide) {
          throw new Error('Pyodide not initialized');
        }

        if (!sqliteDbPath) {
          throw new Error('No SQLite database available. Please process an IFC file first.');
        }

        // Read the SQLite database file from Pyodide's virtual filesystem
        const bytes = pyodide.FS.readFile(sqliteDbPath);

        // Send the database bytes back to the main thread
        // Use transferrable ArrayBuffer for better performance
        self.postMessage({
          type: 'sqlite_export',
          data: bytes
        }, [bytes.buffer]);

      } catch (error) {
        console.error('[v0] SQLite export failed:', error);
        self.postMessage({
          type: 'error',
          data: {
            message: 'Failed to export SQLite database: ' + (error && error.message ? error.message : String(error)),
            stack: error && error.stack ? error.stack : undefined
          }
        });
      }
    }
  `

  const blob = new Blob([workerCode], { type: "application/javascript" })
  return new Worker(URL.createObjectURL(blob))
}
