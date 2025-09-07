#!/usr/bin/env node

console.log('🧪 Direct IFC4X3 Test Agent\n');

// Create a test that runs the same logic as our worker but in a controlled way
const testWorkerCode = `
// Test worker code that mimics our ifcWorker.js behavior
importScripts('https://cdn.jsdelivr.net/pyodide/v0.28.0/full/pyodide.js');

let pyodide = null;

async function testIFC4X3Support() {
    try {
        console.log('🚀 Loading Pyodide...');
        pyodide = await loadPyodide({
            indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.28.0/full/'
        });
        
        console.log('📦 Loading micropip...');
        await pyodide.loadPackage(['micropip']);
        
        console.log('🔧 Applying bypass...');
        await pyodide.runPythonAsync(\`
import micropip
import micropip._utils

def simple_bypass(filename):
    return None

micropip._utils.check_compatible = simple_bypass
        \`);
        
        console.log('📦 Installing IfcOpenShell 0.8.3...');
        await pyodide.runPythonAsync(\`
await micropip.install('https://cdn.jsdelivr.net/gh/IfcOpenShell/wasm-wheels@main/ifcopenshell-0.8.3+34a1bc6-cp313-cp313-emscripten_4_0_9_wasm32.whl', keep_going=True, deps=False)
        \`);
        
        console.log('🧪 Testing IFC4X3 support...');
        const result = await pyodide.runPythonAsync(\`
import ifcopenshell
import json

# Test results
results = {
    "version": getattr(ifcopenshell, 'version', 'unknown'),
    "schemas_detected": [],
    "schema_methods": [],
    "ifc4x3_tests": {}
}

# Test 1: Schema detection
try:
    if hasattr(ifcopenshell, 'schema_names'):
        schemas = list(ifcopenshell.schema_names())
        results["schemas_detected"] = schemas
        results["schema_methods"].append("schema_names")
        print(f"📋 Schemas via schema_names(): {schemas}")
    elif hasattr(ifcopenshell, 'ifcopenshell_wrapper') and hasattr(ifcopenshell.ifcopenshell_wrapper, 'schema_names'):
        schemas = list(ifcopenshell.ifcopenshell_wrapper.schema_names())
        results["schemas_detected"] = schemas
        results["schema_methods"].append("wrapper.schema_names")
        print(f"📋 Schemas via wrapper: {schemas}")
    elif hasattr(ifcopenshell, 'schema_by_name'):
        schemas = list(ifcopenshell.schema_by_name.keys())
        results["schemas_detected"] = schemas
        results["schema_methods"].append("schema_by_name")
        print(f"📋 Schemas via schema_by_name: {schemas}")
except Exception as e:
    results["schema_error"] = str(e)
    print(f"❌ Schema detection error: {e}")

# Test 2: IFC4X3 file creation
ifc4x3_schemas = ['IFC4X3', 'IFC4X3_ADD1', 'IFC4X3_ADD2']
for schema in ifc4x3_schemas:
    try:
        # Try to create a file with this schema
        test_file = ifcopenshell.file(schema=schema)
        results["ifc4x3_tests"][schema] = {
            "file_creation": "SUCCESS",
            "actual_schema": test_file.schema
        }
        print(f"✅ {schema}: File creation successful")
        
        # Try to create a basic project
        try:
            project = test_file.create_entity('IfcProject', 
                GlobalId='test123456789012345678901',
                Name=f'Test {schema} Project')
            results["ifc4x3_tests"][schema]["project_creation"] = "SUCCESS"
            print(f"✅ {schema}: Project creation successful")
        except Exception as proj_error:
            results["ifc4x3_tests"][schema]["project_creation"] = f"FAILED: {proj_error}"
            print(f"❌ {schema}: Project creation failed: {proj_error}")
            
    except Exception as file_error:
        results["ifc4x3_tests"][schema] = {
            "file_creation": f"FAILED: {file_error}"
        }
        print(f"❌ {schema}: File creation failed: {file_error}")

# Test 3: Try to open an IFC4X3_ADD2 file (create minimal one)
try:
    ifc_content = '''ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');
FILE_NAME('test.ifc','2024-01-01T00:00:00',('Test'),('Test'),'IfcOpenShell','IfcOpenShell','');
FILE_SCHEMA(('IFC4X3_ADD2'));
ENDSEC;
DATA;
#1=IFCPROJECT('0YvhMWq7X0uvhQ4YvhMWq7X','Test Project','Test Description',$,$,$,$,$,$);
ENDSEC;
END-ISO-10303-21;'''
    
    with open('test_ifc4x3.ifc', 'w') as f:
        f.write(ifc_content)
    
    # Try to open it
    try:
        test_file = ifcopenshell.open('test_ifc4x3.ifc')
        results["file_opening_test"] = {
            "status": "SUCCESS",
            "schema": test_file.schema,
            "projects": len(test_file.by_type('IfcProject'))
        }
        print(f"✅ IFC4X3_ADD2 file opening: SUCCESS")
        print(f"   Schema: {test_file.schema}")
        print(f"   Projects: {len(test_file.by_type('IfcProject'))}")
    except Exception as open_error:
        results["file_opening_test"] = {
            "status": "FAILED",
            "error": str(open_error)
        }
        print(f"❌ IFC4X3_ADD2 file opening failed: {open_error}")
        
except Exception as setup_error:
    results["file_opening_test"] = {
        "status": "SETUP_FAILED",
        "error": str(setup_error)
    }
    print(f"❌ File setup failed: {setup_error}")

# Summary
print("\\n📊 SUMMARY:")
print(f"Version: {results['version']}")
print(f"Detected schemas: {results['schemas_detected']}")
ifc4x3_supported = any('IFC4X3' in schema for schema in results.get('schemas_detected', []))
print(f"IFC4X3 in detected schemas: {ifc4x3_supported}")

for schema, test_result in results["ifc4x3_tests"].items():
    print(f"{schema}: {test_result.get('file_creation', 'NOT_TESTED')}")

json.dumps(results)
        \`);
        
        const testResults = JSON.parse(result);
        
        console.log('\\n🎯 TEST RESULTS:');
        console.log('================');
        console.log('Version:', testResults.version);
        console.log('Detected schemas:', testResults.schemas_detected);
        console.log('Schema methods:', testResults.schema_methods);
        
        console.log('\\nIFC4X3 Tests:');
        for (const [schema, test] of Object.entries(testResults.ifc4x3_tests)) {
            console.log(\`\${schema}: \${test.file_creation}\`);
            if (test.project_creation) {
                console.log(\`  Project: \${test.project_creation}\`);
            }
        }
        
        if (testResults.file_opening_test) {
            console.log('\\nFile Opening Test:');
            console.log(\`Status: \${testResults.file_opening_test.status}\`);
            if (testResults.file_opening_test.error) {
                console.log(\`Error: \${testResults.file_opening_test.error}\`);
            }
        }
        
        // Determine if IFC4X3 is actually supported
        const ifc4x3InSchemas = testResults.schemas_detected.some(s => s.includes('IFC4X3'));
        const canCreateIFC4X3 = Object.values(testResults.ifc4x3_tests).some(t => t.file_creation === 'SUCCESS');
        
        console.log('\\n🏁 CONCLUSION:');
        if (ifc4x3InSchemas || canCreateIFC4X3) {
            console.log('✅ IFC4X3 IS SUPPORTED by IfcOpenShell 0.8.3!');
            console.log('The error in your application might be due to:');
            console.log('1. Different error handling in the worker');
            console.log('2. File-specific issues');
            console.log('3. Configuration differences');
        } else {
            console.log('❌ IFC4X3 support is limited or not available');
            console.log('This confirms the error you encountered');
        }
        
        return testResults;
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        throw error;
    }
}

// Run the test
testIFC4X3Support().then(results => {
    console.log('\\n✅ Test completed successfully');
    self.postMessage({ type: 'complete', results });
}).catch(error => {
    console.error('❌ Test failed:', error);
    self.postMessage({ type: 'error', error: error.message });
});
`;

// Write the worker code to a file
require('fs').writeFileSync('/tmp/ifc4x3-test-worker.js', testWorkerCode);

console.log('✅ Created direct test worker: /tmp/ifc4x3-test-worker.js');
console.log('');
console.log('🌐 To run this test:');
console.log('1. Open your browser developer tools');
console.log('2. Go to Console tab');
console.log('3. Run this code:');
console.log('');
console.log('```javascript');
console.log('const worker = new Worker("/tmp/ifc4x3-test-worker.js");');
console.log('worker.onmessage = (e) => console.log("Worker result:", e.data);');
console.log('worker.onerror = (e) => console.error("Worker error:", e);');
console.log('```');
console.log('');
console.log('Or open the HTML test file created by the previous agent.');
console.log('');
console.log('🎯 This will definitively show whether IfcOpenShell 0.8.3 supports IFC4X3!');

