// Space Analysis Worker using Pyodide and IfcOpenShell
importScripts("https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js");

let pyodide = null;
let isPyodideReady = false;

// Initialize Pyodide and IfcOpenShell
async function initPyodide() {
    if (isPyodideReady) return;

    try {
        console.log('[Space Analysis Worker] Loading Pyodide...');

        // Load Pyodide - same version as main worker
        pyodide = await loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/"
        });

        console.log('[Space Analysis Worker] Pyodide loaded, installing packages...');

        // Load micropip and numpy packages
        await pyodide.loadPackage(["micropip", "numpy"]);

        // Bypass Emscripten version compatibility check for wheels
        await pyodide.runPythonAsync(`
      import micropip
      from micropip._micropip import WheelInfo
      WheelInfo.check_compatible = lambda self: None
    `);

        console.log('[Space Analysis Worker] Installing IfcOpenShell...');

        // Install lark and IfcOpenShell
        await pyodide.runPythonAsync(`
      import micropip
      # Install lark for stream support
      await micropip.install('lark')
      await micropip.install('https://cdn.jsdelivr.net/gh/IfcOpenShell/wasm-wheels@33b437e5fd5425e606f34aff602c42034ff5e6dc/ifcopenshell-0.8.1+latest-cp312-cp312-emscripten_3_1_58_wasm32.whl')
    `);

        console.log('[Space Analysis Worker] IfcOpenShell installed');

        // Set up Python environment and verify
        await pyodide.runPythonAsync(`
import sys
import json
import ifcopenshell
import ifcopenshell.util.element

print("Python environment ready")
print(f"IfcOpenShell version: {ifcopenshell.version}")
    `);

        isPyodideReady = true;
        console.log('[Space Analysis Worker] Ready for space analysis');

    } catch (error) {
        console.error('[Space Analysis Worker] Initialization error:', error);
        throw error;
    }
}

// Perform space analysis
async function analyzeSpaces(modelData, elements, metric) {
    if (!isPyodideReady) {
        await initPyodide();
    }

    try {
        console.log('[Space Analysis Worker] Starting analysis with metric:', metric);
        console.log('[Space Analysis Worker] Model data size:', modelData.fileBuffer?.byteLength || 0);

        // Convert the ArrayBuffer to a format Python can use
        const fileBuffer = modelData.fileBuffer;
        if (!(fileBuffer instanceof ArrayBuffer)) {
            throw new Error('Model data missing ArrayBuffer (model.fileBuffer).');
        }
        pyodide.FS.writeFile('/temp_model.ifc', new Uint8Array(fileBuffer));

        // Set the elements data in Python globals
        pyodide.globals.set('element_ids', elements.map(e => e.GlobalId || e.id));
        pyodide.globals.set('metric_type', metric);

        console.log('[Space Analysis Worker] Running Python analysis...');

        // Create a JavaScript function that Python can call to send progress
        self.sendProgress = (progressData) => {
            // Convert Python dict/proxy to plain JavaScript object
            let jsData;
            if (progressData && progressData.toJs) {
                // It's a Python object, convert it
                jsData = progressData.toJs({ dict_converter: Object.fromEntries });
            } else if (progressData && typeof progressData === 'object') {
                // It might be a Proxy, extract the properties
                jsData = {
                    message: progressData.message || '',
                    processed: progressData.processed || 0,
                    total: progressData.total || 0,
                    current_space: progressData.current_space || '',
                    percentage: progressData.percentage || 0
                };
            } else {
                jsData = progressData;
            }

            console.log('[Progress Monitor] Sending progress:', jsData);

            // Send progress update to main thread
            self.postMessage({
                type: 'progress',
                progress: jsData
            });
        };

        // Make the function available to Python
        pyodide.registerJsModule("js_progress", {
            send: self.sendProgress
        });

        try {
            // Run the space analysis Python code
            const result = await pyodide.runPythonAsync(`
import ifcopenshell
import ifcopenshell.util.element
import json
import js_progress

# Send initial progress
js_progress.send({
    "message": "Loading IFC model...",
    "processed": 0,
    "total": 100,
    "percentage": 0
})

# Load the IFC model
print("Loading IFC model...")
model = ifcopenshell.open('/temp_model.ifc')
print(f"Model loaded: {model}")

# Get metric type from globals
metric = metric_type
element_ids = list(element_ids)

# Get all spaces (rooms) and zones
spaces = model.by_type("IfcSpace")
zones = model.by_type("IfcZone")
storeys = model.by_type("IfcBuildingStorey")

print(f"Found {len(spaces)} spaces, {len(zones)} zones, {len(storeys)} storeys")

# Send progress about found spaces
js_progress.send({
    "message": f"Found {len(spaces)} spaces, {len(zones)} zones, {len(storeys)} storeys",
    "processed": 0,
    "total": len(spaces),
    "percentage": 0
})

# Build space containment map
space_elements_map = {}
element_space_map = {}
space_properties = {}

# Pre-build storey lookup map for better performance
storey_lookup = {}
space_storey_lookup = {}

# Build element-to-storey mapping
for rel in model.by_type("IfcRelContainedInSpatialStructure"):
    if rel.RelatingStructure.is_a("IfcBuildingStorey"):
        storey_name = rel.RelatingStructure.Name
        for element in rel.RelatedElements:
            storey_lookup[element.GlobalId] = storey_name

# Build space-to-storey mapping (spaces are usually aggregated in storeys)
for rel in model.by_type("IfcRelAggregates"):
    if rel.RelatingObject.is_a("IfcBuildingStorey"):
        storey_name = rel.RelatingObject.Name
        for obj in rel.RelatedObjects:
            if obj.is_a("IfcSpace"):
                space_storey_lookup[obj.GlobalId] = storey_name

# Also check if spaces are contained in storeys (alternative relationship)
for rel in model.by_type("IfcRelContainedInSpatialStructure"):
    if rel.RelatingStructure.is_a("IfcBuildingStorey"):
        storey_name = rel.RelatingStructure.Name
        for element in rel.RelatedElements:
            if element.is_a("IfcSpace"):
                space_storey_lookup[element.GlobalId] = storey_name

print(f"Built storey lookup maps: {len(storey_lookup)} elements, {len(space_storey_lookup)} spaces")

def get_storey_for_element(element):
    """Find which building storey contains this element (optimized)"""
    return storey_lookup.get(element.GlobalId, None)

def get_storey_for_space(space):
    """Find which building storey contains this space (optimized)"""
    return space_storey_lookup.get(space.GlobalId, None)

# Pre-fetch all spatial containment relationships for performance
print("Pre-fetching spatial containment relationships...")

# Send progress for pre-fetching
js_progress.send({
    "message": "Pre-fetching spatial containment relationships...",
    "processed": 0,
    "total": len(spaces),
    "percentage": 0
})

spatial_rels = model.by_type("IfcRelContainedInSpatialStructure")
space_to_elements = {}
element_to_space = {}

# Build lookup maps for faster processing
for rel in spatial_rels:
    relating_structure = rel.RelatingStructure
    if relating_structure.is_a("IfcSpace"):
        space_id = relating_structure.GlobalId
        if space_id not in space_to_elements:
            space_to_elements[space_id] = []
        
        for element in rel.RelatedElements:
            space_to_elements[space_id].append(element)
            element_to_space[element.GlobalId] = relating_structure

print(f"Built spatial lookup maps: {len(space_to_elements)} spaces with elements")

# Pre-fetch all space properties and quantities for better performance
print("Pre-fetching space properties and quantities...")
space_psets_cache = {}
space_quantities_cache = {}

# Always get basic properties for room assignment, but optimize based on metric
# For circulation analysis, we need areas to determine circulation vs program spaces
needs_quantities = metric in ["space_metrics", "occupancy", "circulation"]

# Batch process property sets (much faster than individual calls)
for space in spaces:
    space_id = space.GlobalId
    try:
        # Get psets only when needed
        if needs_quantities:
            psets = ifcopenshell.util.element.get_psets(space)
            space_psets_cache[space_id] = psets.get("Pset_SpaceCommon", {})
            
            if "Qto_SpaceBaseQuantities" in psets:
                quantities = psets["Qto_SpaceBaseQuantities"]
                space_quantities_cache[space_id] = {
                    "area": quantities.get("NetFloorArea", quantities.get("GrossFloorArea", 0)),
                    "volume": quantities.get("NetVolume", quantities.get("GrossVolume", 0)),
                    "height": quantities.get("Height", quantities.get("FinishCeilingHeight", 0)),
                    "perimeter": quantities.get("NetPerimeter", 0)
                }
            else:
                space_quantities_cache[space_id] = {"area": 0, "volume": 0, "height": 0, "perimeter": 0}
        else:
            # For room_assignment only, skip expensive operations but keep structure
            space_psets_cache[space_id] = {}
            space_quantities_cache[space_id] = {}
    except Exception as e:
        print(f"Error getting properties for space {space.Name}: {e}")
        space_psets_cache[space_id] = {}
        space_quantities_cache[space_id] = {"area": 0, "volume": 0, "height": 0, "perimeter": 0} if needs_quantities else {}

print(f"Pre-fetched properties for {len(space_psets_cache)} spaces")

# Process each space efficiently using cached data
processed_count = 0
for space in spaces:
    space_id = space.GlobalId
    space_name = space.Name or f"Space_{space_id[:8]}"
    space_type = space.ObjectType or "Generic"
    
    processed_count += 1
    
    # Send progress update to main thread every 10 spaces (less frequent for better performance)
    if processed_count % 10 == 0 or processed_count == len(spaces):
        progress_message = f"Processing space {processed_count}/{len(spaces)}: {space_name}"
        print(progress_message)
        
        # Send progress update via JavaScript function
        js_progress.send({
            "processed": processed_count,
            "total": len(spaces),
            "current_space": space_name,
            "message": progress_message,
            "percentage": int((processed_count / len(spaces)) * 100)
        })
    
    # Get storey for the space using the correct lookup
    space_storey = get_storey_for_space(space)
    
    # Initialize space data with cached properties
    space_elements_map[space_id] = {
        "name": space_name,
        "type": space_type,
        "description": space.Description or "",
        "longName": space.LongName or "",
        "storey": space_storey,
        "elements": [],
        "properties": space_psets_cache.get(space_id, {}),
        "quantities": space_quantities_cache.get(space_id, {})
    }
    
    # Use pre-built lookup for contained elements (already optimized)
    contained_elements = space_to_elements.get(space_id, [])
    
    # Store the mapping for contained elements using list comprehension (faster)
    if contained_elements:
        # Batch process elements for this space
        space_elements_map[space_id]["elements"] = [
            {
                "id": elem.GlobalId,
                "type": elem.is_a(),
                "name": elem.Name or f"{elem.is_a()}_{elem.GlobalId[:8]}"
            }
            for elem in contained_elements
        ]
        

        
        # Batch update element_space_map
        for elem in contained_elements:
            element_space_map[elem.GlobalId] = {
                "spaceId": space_id,
                "spaceName": space_name,
                "spaceType": space_type,
                "storey": space_storey
            }

# Handle zones (groups of spaces) - optimized
zone_map = {}
if zones:
    print(f"Processing {len(zones)} zones...")
    
    # Pre-fetch zone assignments for performance
    zone_assignments = model.by_type("IfcRelAssignsToGroup")
    zone_to_spaces = {}
    
    for rel in zone_assignments:
        zone = rel.RelatingGroup
        if zone.is_a("IfcZone"):
            zone_id = zone.GlobalId
            if zone_id not in zone_to_spaces:
                zone_to_spaces[zone_id] = []
            
            for obj in rel.RelatedObjects:
                if obj.is_a("IfcSpace"):
                    zone_to_spaces[zone_id].append(obj)
    
    for zone in zones:
        zone_id = zone.GlobalId
        zone_name = zone.Name or f"Zone_{zone_id[:8]}"
        zone_map[zone_id] = {
            "name": zone_name,
            "description": zone.Description or "",
            "spaces": [],
            "type": zone.ObjectType or "Generic"
        }
        
        # Use pre-built lookup for zone spaces
        zone_spaces = zone_to_spaces.get(zone_id, [])
        for space_obj in zone_spaces:
            zone_map[zone_id]["spaces"].append({
                "id": space_obj.GlobalId,
                "name": space_obj.Name or ""
            })

print(f"\\nAnalysis Summary:")
print(f"- Total spaces processed: {len(space_elements_map)}")
print(f"- Total elements mapped: {len(element_space_map)}")
print(f"- Total zones: {len(zone_map)}")

# Calculate space metrics based on requested metric type
result = {}

if metric == "room_assignment":
    # Return element to space mapping
    result = {
        "elementSpaceMap": element_space_map,
        "spaceElementsMap": space_elements_map,
        "zones": zone_map,
        "summary": {
            "totalSpaces": len(spaces),
            "totalZones": len(zones),
            "assignedElements": len(element_space_map),
            "unassignedElements": len(element_ids) - len([eid for eid in element_ids if eid in element_space_map]),
            "spaces": [{"id": s.GlobalId, "name": s.Name or f"Space_{s.GlobalId[:8]}"} for s in spaces]
        }
    }

elif metric == "space_metrics":
    # Calculate and return space metrics
    space_metrics = {}
    total_area = 0
    total_volume = 0
    total_occupancy = 0
    
    for space_id, space_data in space_elements_map.items():
        area = space_data["quantities"].get("area", 0)
        volume = space_data["quantities"].get("volume", 0)
        height = space_data["quantities"].get("height", 2.5)
        
        # Calculate occupancy (1 person per 10 sqm for offices)
        occupancy = max(1, int(area / 10)) if area > 0 else 0
        
        space_metrics[space_id] = {
            "name": space_data["name"],
            "type": space_data["type"],
            "area": area,
            "volume": volume,
            "height": height,
            "occupancy": occupancy,
            "elementCount": len(space_data["elements"])
        }
        
        total_area += area
        total_volume += volume
        total_occupancy += occupancy
    
    result = {
        "spaces": space_metrics,
        "totals": {
            "totalArea": total_area,
            "totalVolume": total_volume,
            "totalOccupancy": total_occupancy,
            "averageArea": total_area / len(spaces) if spaces else 0,
            "spaceCount": len(spaces)
        }
    }

elif metric == "circulation":
    # Analyze circulation vs program space
    circulation_spaces = []
    program_spaces = []
    
    for space in spaces:
        space_type = (space.ObjectType or "").lower()
        space_name = (space.Name or "").lower()
        
        # Identify circulation spaces
        if any(keyword in space_type or keyword in space_name 
               for keyword in ["corridor", "circulation", "hallway", "lobby", "stair", "elevator"]):
            circulation_spaces.append(space)
        else:
            program_spaces.append(space)
    
    # Calculate areas using cached data (much faster)
    circulation_area = 0
    program_area = 0
    
    for space in circulation_spaces:
        space_id = space.GlobalId
        # Use cached quantities instead of calling get_psets again
        quantities = space_quantities_cache.get(space_id, {})
        circulation_area += quantities.get("area", 0)
    
    for space in program_spaces:
        space_id = space.GlobalId
        # Use cached quantities instead of calling get_psets again
        quantities = space_quantities_cache.get(space_id, {})
        program_area += quantities.get("area", 0)
    
    total_area = circulation_area + program_area
    
    result = {
        "circulationArea": circulation_area,
        "programArea": program_area,
        "totalArea": total_area,
        "circulationRatio": circulation_area / total_area if total_area > 0 else 0,
        "circulationSpaces": len(circulation_spaces),
        "programSpaces": len(program_spaces),
        "details": {
            "circulation": [{"id": s.GlobalId, "name": s.Name or "", "type": s.ObjectType or ""} for s in circulation_spaces],
            "program": [{"id": s.GlobalId, "name": s.Name or "", "type": s.ObjectType or ""} for s in program_spaces]
        }
    }

elif metric == "occupancy":
    # Calculate occupancy for all spaces
    occupancy_data = []
    total_occupancy = 0
    total_area = 0
    
    for space in spaces:
        space_id = space.GlobalId
        space_name = space.Name or f"Space_{space_id[:8]}"
        space_type = space.ObjectType or "Generic"
        
        # Get area from cached quantities (much faster)
        quantities = space_quantities_cache.get(space_id, {})
        area = quantities.get("area", 0)
        
        # Calculate occupancy based on space type
        occupancy_factor = 10  # Default: 1 person per 10 sqm
        
        if "meeting" in space_type.lower() or "conference" in space_type.lower():
            occupancy_factor = 2  # Higher density for meeting rooms
        elif "storage" in space_type.lower() or "mechanical" in space_type.lower():
            occupancy_factor = 100  # Very low occupancy for storage/mechanical
        elif "lobby" in space_type.lower() or "reception" in space_type.lower():
            occupancy_factor = 5  # Medium density for lobbies
        
        occupancy = max(1, int(area / occupancy_factor)) if area > 0 else 0
        
        occupancy_data.append({
            "spaceId": space_id,
            "spaceName": space_name,
            "spaceType": space_type,
            "area": area,
            "occupancy": occupancy,
            "occupancyFactor": occupancy_factor
        })
        
        total_occupancy += occupancy
        total_area += area
    
    result = {
        "spaces": occupancy_data,
        "summary": {
            "totalOccupancy": total_occupancy,
            "totalArea": total_area,
            "averageOccupancyDensity": total_area / total_occupancy if total_occupancy > 0 else 0,
            "spaceCount": len(spaces)
        }
    }

else:
    # Default: return basic space information
    result = {
        "spaces": [
            {
                "id": s.GlobalId,
                "name": s.Name or f"Space_{s.GlobalId[:8]}",
                "type": s.ObjectType or "Generic"
            } for s in spaces
        ],
        "zones": [
            {
                "id": z.GlobalId,
                "name": z.Name or f"Zone_{z.GlobalId[:8]}"
            } for z in zones
        ],
        "summary": {
            "totalSpaces": len(spaces),
            "totalZones": len(zones)
        }
    }

# Clean up
import os
os.remove('/temp_model.ifc')

# Return JSON result
json.dumps(result)
    `);

            console.log('[Space Analysis Worker] Analysis complete');

            // Parse and return the result
            return JSON.parse(result);
        } catch (pythonError) {
            throw pythonError;
        }

    } catch (error) {
        console.error('[Space Analysis Worker] Analysis error:', error);
        throw error;
    }
}

// Message handler
self.onmessage = async function (event) {
    const { type, model, elements, metric } = event.data;

    try {
        if (type === 'analyzeSpaces') {
            console.log('[Space Analysis Worker] Received request for space analysis');
            const result = await analyzeSpaces(model, elements, metric);
            console.log('[Space Analysis Worker] Sending result back');
            self.postMessage({ result });
        } else {
            throw new Error(`Unknown message type: ${type}`);
        }
    } catch (error) {
        console.error('[Space Analysis Worker] Error:', error);
        self.postMessage({
            error: error.message || 'Space analysis failed',
            details: error.stack
        });
    }
};

// Initialize on load
console.log('[Space Analysis Worker] Starting initialization...');
initPyodide().catch(error => {
    console.error('[Space Analysis Worker] Failed to initialize:', error);
});