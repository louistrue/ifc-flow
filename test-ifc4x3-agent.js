#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 IFC4X3 Support Test Agent Starting...\n');

// Test script to comprehensively test IFC4X3 support in IfcOpenShell 0.8.3
const testScript = `
import sys
import asyncio
import micropip
import json

print("=== IFC4X3 COMPREHENSIVE SUPPORT TEST ===")
print("Python version:", sys.version)
print("Platform:", sys.platform)

# Apply compatibility bypass
def disable_check_compatible(filename):
    return None

print("\\n🔧 Applying compatibility bypass...")
import micropip._utils
micropip._utils.check_compatible = disable_check_compatible

print("\\n📦 Installing IfcOpenShell 0.8.3...")
wheel_url = 'https://cdn.jsdelivr.net/gh/IfcOpenShell/wasm-wheels@main/ifcopenshell-0.8.3+34a1bc6-cp313-cp313-emscripten_4_0_9_wasm32.whl'

try:
    await micropip.install(wheel_url, keep_going=True, deps=False)
    print("✅ IfcOpenShell 0.8.3 installed successfully")
    
    import ifcopenshell
    print(f"📋 IfcOpenShell version: {getattr(ifcopenshell, 'version', 'unknown')}")
    
    # Test 1: Check available schema methods
    print("\\n🔍 TEST 1: Schema Detection Methods")
    print("=" * 50)
    
    schema_methods = []
    available_schemas = []
    
    # Method 1: Direct schema_names()
    if hasattr(ifcopenshell, 'schema_names'):
        try:
            schemas = list(ifcopenshell.schema_names())
            schema_methods.append(f"✅ schema_names(): {schemas}")
            available_schemas.extend(schemas)
        except Exception as e:
            schema_methods.append(f"❌ schema_names() failed: {e}")
    else:
        schema_methods.append("❌ schema_names() not available")
    
    # Method 2: Via wrapper
    if hasattr(ifcopenshell, 'ifcopenshell_wrapper'):
        if hasattr(ifcopenshell.ifcopenshell_wrapper, 'schema_names'):
            try:
                schemas = list(ifcopenshell.ifcopenshell_wrapper.schema_names())
                schema_methods.append(f"✅ wrapper.schema_names(): {schemas}")
                available_schemas.extend(schemas)
            except Exception as e:
                schema_methods.append(f"❌ wrapper.schema_names() failed: {e}")
        else:
            schema_methods.append("❌ wrapper.schema_names() not available")
    else:
        schema_methods.append("❌ ifcopenshell_wrapper not available")
    
    # Method 3: Via schema_by_name
    if hasattr(ifcopenshell, 'schema_by_name'):
        try:
            schemas = list(ifcopenshell.schema_by_name.keys())
            schema_methods.append(f"✅ schema_by_name.keys(): {schemas}")
            available_schemas.extend(schemas)
        except Exception as e:
            schema_methods.append(f"❌ schema_by_name failed: {e}")
    else:
        schema_methods.append("❌ schema_by_name not available")
    
    # Method 4: Check express module
    try:
        import ifcopenshell.express
        if hasattr(ifcopenshell.express, 'schema_by_name'):
            schemas = list(ifcopenshell.express.schema_by_name.keys())
            schema_methods.append(f"✅ express.schema_by_name.keys(): {schemas}")
            available_schemas.extend(schemas)
        else:
            schema_methods.append("❌ express.schema_by_name not available")
    except Exception as e:
        schema_methods.append(f"❌ express module failed: {e}")
    
    for method in schema_methods:
        print(method)
    
    # Remove duplicates
    unique_schemas = list(set(available_schemas))
    print(f"\\n📋 All detected schemas: {unique_schemas}")
    
    # Test 2: Schema Creation Tests
    print("\\n🧪 TEST 2: Schema Creation Tests")
    print("=" * 50)
    
    test_schemas = ['IFC2X3', 'IFC4', 'IFC4X1', 'IFC4X2', 'IFC4X3', 'IFC4X3_ADD1', 'IFC4X3_ADD2']
    schema_results = {}
    
    for schema in test_schemas:
        try:
            # Test 1: Try to get schema by name
            if hasattr(ifcopenshell, 'schema_by_name') and schema in ifcopenshell.schema_by_name:
                schema_obj = ifcopenshell.schema_by_name[schema]
                schema_results[schema] = f"✅ Available via schema_by_name: {type(schema_obj)}"
            else:
                # Test 2: Try to create a file with this schema
                try:
                    test_file = ifcopenshell.file(schema=schema)
                    schema_results[schema] = f"✅ Can create file with schema: {test_file.schema}"
                    test_file = None  # Clean up
                except Exception as create_error:
                    schema_results[schema] = f"❌ Cannot create file: {create_error}"
        except Exception as e:
            schema_results[schema] = f"❌ Error testing: {e}"
    
    for schema, result in schema_results.items():
        print(f"{schema:12} | {result}")
    
    # Test 3: File Opening Tests with Different Schemas
    print("\\n🗂️  TEST 3: File Opening Capability Tests")
    print("=" * 50)
    
    # Create minimal IFC files for each schema and test opening
    file_tests = {}
    
    for schema in ['IFC2X3', 'IFC4', 'IFC4X3_ADD2']:
        try:
            # Create a minimal IFC file content
            ifc_content = f'''ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');
FILE_NAME('test.ifc','2024-01-01T00:00:00',('Test'),('Test'),'IfcOpenShell','IfcOpenShell','');
FILE_SCHEMA(('{schema}'));
ENDSEC;
DATA;
#1=IFCPROJECT('0YvhMWq7X0uvhQ','Test Project','Test Description',$,$,$,$,$,$);
ENDSEC;
END-ISO-10303-21;'''
            
            # Write to virtual filesystem
            with open(f'test_{schema.lower()}.ifc', 'w') as f:
                f.write(ifc_content)
            
            # Try to open the file
            try:
                test_file = ifcopenshell.open(f'test_{schema.lower()}.ifc')
                file_tests[schema] = f"✅ Successfully opened: {test_file.schema}"
                
                # Test basic operations
                try:
                    projects = test_file.by_type('IfcProject')
                    file_tests[schema] += f" | Projects: {len(projects)}"
                except Exception as query_error:
                    file_tests[schema] += f" | Query failed: {query_error}"
                    
            except Exception as open_error:
                file_tests[schema] = f"❌ Failed to open: {open_error}"
                
        except Exception as e:
            file_tests[schema] = f"❌ Test setup failed: {e}"
    
    for schema, result in file_tests.items():
        print(f"{schema:12} | {result}")
    
    # Test 4: Advanced IFC4X3 Features
    print("\\n🚀 TEST 4: IFC4X3 Advanced Features")
    print("=" * 50)
    
    try:
        # Try to create an IFC4X3 file and test advanced features
        ifc4x3_file = ifcopenshell.file(schema='IFC4X3_ADD2')
        
        # Test creating IFC4X3 specific entities
        ifc4x3_tests = []
        
        # Test 1: Basic project creation
        try:
            project = ifc4x3_file.create_entity('IfcProject', 
                GlobalId='test123456789012345678901',
                Name='IFC4X3 Test Project')
            ifc4x3_tests.append(f"✅ Created IfcProject: {project.Name}")
        except Exception as e:
            ifc4x3_tests.append(f"❌ IfcProject creation failed: {e}")
        
        # Test 2: Try IFC4X3 specific entities (if they exist)
        ifc4x3_entities = ['IfcRail', 'IfcRoad', 'IfcBridge', 'IfcTunnel']
        for entity_type in ifc4x3_entities:
            try:
                entity = ifc4x3_file.create_entity(entity_type,
                    GlobalId=f'test{entity_type}123456789012345')
                ifc4x3_tests.append(f"✅ Created {entity_type}")
            except Exception as e:
                ifc4x3_tests.append(f"❌ {entity_type} not available: {e}")
        
        for test_result in ifc4x3_tests:
            print(test_result)
            
    except Exception as e:
        print(f"❌ IFC4X3 file creation failed: {e}")
    
    # Test 5: Module Introspection
    print("\\n🔍 TEST 5: Module Introspection")
    print("=" * 50)
    
    print("Available ifcopenshell attributes:")
    attrs = [attr for attr in dir(ifcopenshell) if not attr.startswith('_')]
    for i, attr in enumerate(attrs[:20]):  # Show first 20
        print(f"  {attr}")
    if len(attrs) > 20:
        print(f"  ... and {len(attrs) - 20} more")
    
    # Check for schema-related attributes
    schema_attrs = [attr for attr in attrs if 'schema' in attr.lower()]
    print(f"\\nSchema-related attributes: {schema_attrs}")
    
    # Final Summary
    print("\\n📊 FINAL SUMMARY")
    print("=" * 50)
    print(f"✅ IfcOpenShell 0.8.3 installed: YES")
    print(f"📋 Detected schemas: {unique_schemas}")
    print(f"🎯 IFC4X3 in detected schemas: {'IFC4X3_ADD2' in unique_schemas or 'IFC4X3' in unique_schemas}")
    
    ifc4x3_support = any('IFC4X3' in schema for schema in unique_schemas)
    if ifc4x3_support:
        print("🎉 CONCLUSION: IFC4X3 IS SUPPORTED!")
    else:
        print("⚠️  CONCLUSION: IFC4X3 support unclear - may need different approach")
    
except Exception as e:
    print(f"❌ Installation failed: {e}")
    print("🔄 This may indicate compatibility issues with the wheel")

print("\\n🏁 IFC4X3 Support Test completed")
`;

function runPyodideTest() {
    return new Promise((resolve, reject) => {
        console.log('🚀 Starting Pyodide-based IFC4X3 test...\n');

        // Create HTML test file
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>IFC4X3 Support Test</title>
    <script src="https://cdn.jsdelivr.net/pyodide/v0.28.0/full/pyodide.js"></script>
</head>
<body>
    <h1>IFC4X3 Support Test</h1>
    <div id="output"></div>
    <script>
        async function runTest() {
            const output = document.getElementById('output');
            
            function log(message) {
                console.log(message);
                output.innerHTML += message.replace(/\\n/g, '<br>') + '<br>';
            }
            
            try {
                log('🚀 Loading Pyodide...');
                const pyodide = await loadPyodide({
                    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.28.0/full/"
                });
                
                await pyodide.loadPackage(["micropip"]);
                
                const result = await pyodide.runPythonAsync(\`${testScript.replace(/`/g, '\\`')}\`);
                
                log('✅ Test completed successfully');
                
            } catch (error) {
                log('❌ Test failed: ' + error.message);
                console.error(error);
            }
        }
        
        runTest();
    </script>
</body>
</html>
        `;

        fs.writeFileSync('/tmp/ifc4x3-test.html', htmlContent);
        console.log('✅ Created test file: /tmp/ifc4x3-test.html');
        console.log('🌐 Open this file in your browser to run the comprehensive IFC4X3 test');

        resolve();
    });
}

async function runNodeTest() {
    console.log('🔧 Running Node.js compatibility analysis...\n');

    // Check if we can access the wheel directly
    const https = require('https');
    const url = require('url');

    const wheelUrl = 'https://cdn.jsdelivr.net/gh/IfcOpenShell/wasm-wheels@main/ifcopenshell-0.8.3+34a1bc6-cp313-cp313-emscripten_4_0_9_wasm32.whl';

    console.log('📦 Checking IfcOpenShell 0.8.3 wheel availability...');

    const parsedUrl = url.parse(wheelUrl);
    const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.path,
        method: 'HEAD'
    };

    return new Promise((resolve) => {
        const req = https.request(options, (res) => {
            if (res.statusCode === 200) {
                console.log(`✅ Wheel is available (${res.headers['content-length']} bytes)`);
                console.log(`📋 Content-Type: ${res.headers['content-type']}`);
                console.log(`📅 Last-Modified: ${res.headers['last-modified']}`);

                // Analyze wheel metadata
                const wheelName = wheelUrl.split('/').pop();
                console.log(`\\n📋 Wheel Analysis: ${wheelName}`);
                console.log('   - Version: 0.8.3+34a1bc6');
                console.log('   - Python: cp313 (Python 3.13)');
                console.log('   - Platform: emscripten_4_0_9_wasm32');
                console.log('   - Emscripten: v4.0.9');

                console.log('\\n🎯 Expected IFC4X3 Support:');
                console.log('   - According to docs: ✅ Parsing support for IFC4X3');
                console.log('   - Geometric support: ⚠️  Limited (mainly IFC2X3, IFC4)');
                console.log('   - File reading: ✅ Should work');
                console.log('   - Entity creation: ✅ Should work');

            } else {
                console.log(`❌ Wheel not available (HTTP ${res.statusCode})`);
            }
            resolve();
        });

        req.on('error', (err) => {
            console.log(`❌ Request error: ${err.message}`);
            resolve();
        });

        req.setTimeout(5000, () => {
            console.log('⏰ Request timeout');
            req.abort();
            resolve();
        });

        req.end();
    });
}

async function main() {
    try {
        console.log('🔍 IFC4X3 Support Investigation Starting...\n');

        // Run Node.js analysis
        await runNodeTest();

        console.log('\\n' + '='.repeat(60));

        // Generate Pyodide test
        await runPyodideTest();

        console.log('\\n📋 NEXT STEPS:');
        console.log('1. Open /tmp/ifc4x3-test.html in your browser');
        console.log('2. Check the browser console for detailed test results');
        console.log('3. The test will show exactly what IFC4X3 features are supported');

        console.log('\\n🎯 HYPOTHESIS:');
        console.log('Based on documentation, IfcOpenShell 0.8.3 SHOULD support:');
        console.log('✅ IFC4X3 file parsing and reading');
        console.log('✅ IFC4X3 entity creation and manipulation');
        console.log('⚠️  Limited geometric processing (mainly for IFC2X3/IFC4)');
        console.log('');
        console.log('The error you saw might be due to:');
        console.log('1. Specific IFC4X3_ADD2 entities not fully implemented');
        console.log('2. Geometric processing limitations');
        console.log('3. Configuration issue in our implementation');

    } catch (error) {
        console.error('❌ Test error:', error.message);
        process.exit(1);
    }
}

main();

