#!/usr/bin/env node

console.log('🔍 Testing IfcOpenShell Schema Support...\n');

// Create a test HTML file to run in browser with Pyodide
const testHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>IFC Schema Support Test</title>
    <script src="https://cdn.jsdelivr.net/pyodide/v0.28.0/full/pyodide.js"></script>
</head>
<body>
    <h1>IFC Schema Support Test</h1>
    <div id="output"></div>
    <script>
        async function main() {
            const output = document.getElementById('output');
            
            function log(message) {
                console.log(message);
                output.innerHTML += message + '<br>';
            }
            
            try {
                log('🚀 Loading Pyodide...');
                const pyodide = await loadPyodide({
                    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.28.0/full/"
                });
                
                log('✅ Pyodide loaded');
                
                // Load micropip
                await pyodide.loadPackage(["micropip"]);
                log('✅ Micropip loaded');
                
                // Apply bypass
                await pyodide.runPythonAsync(\`
import micropip
def simple_bypass(filename):
    return None
import micropip._utils
micropip._utils.check_compatible = simple_bypass
                \`);
                log('✅ Bypass applied');
                
                // Install IfcOpenShell 0.8.3
                log('📦 Installing IfcOpenShell 0.8.3...');
                await pyodide.runPythonAsync(\`
await micropip.install('https://cdn.jsdelivr.net/gh/IfcOpenShell/wasm-wheels@main/ifcopenshell-0.8.3+34a1bc6-cp313-cp313-emscripten_4_0_9_wasm32.whl', keep_going=True, deps=False)
                \`);
                log('✅ IfcOpenShell installed');
                
                // Test schema support
                const result = await pyodide.runPythonAsync(\`
import ifcopenshell
import json

result = {
    "version": getattr(ifcopenshell, 'version', 'unknown'),
    "schemas": [],
    "schema_methods": [],
    "attributes": []
}

# Test different ways to get schemas
try:
    if hasattr(ifcopenshell, 'schema_names'):
        result["schemas"] = list(ifcopenshell.schema_names())
        result["schema_methods"].append("schema_names()")
except Exception as e:
    result["schema_methods"].append(f"schema_names() failed: {e}")

try:
    if hasattr(ifcopenshell, 'ifcopenshell_wrapper'):
        if hasattr(ifcopenshell.ifcopenshell_wrapper, 'schema_names'):
            wrapper_schemas = list(ifcopenshell.ifcopenshell_wrapper.schema_names())
            result["schemas"].extend(wrapper_schemas)
            result["schema_methods"].append("ifcopenshell_wrapper.schema_names()")
except Exception as e:
    result["schema_methods"].append(f"wrapper.schema_names() failed: {e}")

try:
    if hasattr(ifcopenshell, 'schema_by_name'):
        schema_dict_keys = list(ifcopenshell.schema_by_name.keys())
        result["schemas"].extend(schema_dict_keys)
        result["schema_methods"].append("schema_by_name.keys()")
except Exception as e:
    result["schema_methods"].append(f"schema_by_name failed: {e}")

# Remove duplicates
result["schemas"] = list(set(result["schemas"]))

# Get all attributes of ifcopenshell module
result["attributes"] = [attr for attr in dir(ifcopenshell) if not attr.startswith('_')]

# Test if we can create schemas directly
schema_tests = {}
for schema in ['IFC2X3', 'IFC4', 'IFC4X1', 'IFC4X2', 'IFC4X3', 'IFC4X3_ADD2']:
    try:
        # Try to get schema by name
        if hasattr(ifcopenshell, 'schema_by_name') and schema in ifcopenshell.schema_by_name:
            schema_tests[schema] = "Available via schema_by_name"
        else:
            # Try to create a schema instance
            try:
                test_schema = ifcopenshell.create_entity(schema + ".IfcProject")
                schema_tests[schema] = "Can create entities"
            except:
                schema_tests[schema] = "Not supported"
    except Exception as e:
        schema_tests[schema] = f"Error: {e}"

result["schema_tests"] = schema_tests

json.dumps(result)
                \`);
                
                const data = JSON.parse(result);
                
                log('📋 IfcOpenShell Version: ' + data.version);
                log('📋 Available Schemas: ' + JSON.stringify(data.schemas));
                log('📋 Schema Methods: ' + JSON.stringify(data.schema_methods));
                log('📋 Schema Tests: ' + JSON.stringify(data.schema_tests, null, 2));
                log('📋 Module Attributes: ' + data.attributes.slice(0, 10).join(', ') + '...');
                
                // Test IFC4X3_ADD2 specifically
                log('\\n🧪 Testing IFC4X3_ADD2 support...');
                const ifc4x3Test = await pyodide.runPythonAsync(\`
try:
    # Try to parse IFC4X3_ADD2 schema definition
    import ifcopenshell.express.schema
    
    # Check if IFC4X3_ADD2 is in the schema registry
    if hasattr(ifcopenshell.express.schema, 'schema_by_name'):
        schemas = ifcopenshell.express.schema.schema_by_name
        if 'IFC4X3_ADD2' in schemas:
            "IFC4X3_ADD2 found in express schema registry"
        else:
            f"IFC4X3_ADD2 not in registry. Available: {list(schemas.keys())}"
    else:
        "No schema registry found"
except Exception as e:
    f"Error testing IFC4X3_ADD2: {e}"
                \`);
                
                log('🧪 IFC4X3_ADD2 Test Result: ' + ifc4x3Test);
                
            } catch (error) {
                log('❌ Error: ' + error.message);
            }
        }
        
        main();
    </script>
</body>
</html>
`;

require('fs').writeFileSync('/tmp/schema-test.html', testHtml);
console.log('✅ Created test file: /tmp/schema-test.html');
console.log('🌐 Open this file in your browser to run the test');
console.log('📋 The test will show detailed schema support information');

