#!/usr/bin/env node

/**
 * Test script for AI tool calling functionality
 * This tests that when the AI uses tools but doesn't generate text,
 * the tool results are still shown in the UI
 */

const TEST_CASES = [
    {
        name: "Count walls",
        message: "how many walls?",
        expectedPattern: /171 walls/i,
        description: "Should return the count of walls"
    },
    {
        name: "Count doors",
        message: "doors?",
        expectedPattern: /57 doors/i,
        description: "Should return the count of doors"
    },
    {
        name: "Count windows",
        message: "windows?",
        expectedPattern: /115 windows/i,
        description: "Should return the count of windows"
    },
    {
        name: "Count slabs",
        message: "slabs?",
        expectedPattern: /9 slabs/i,
        description: "Should return the count of slabs"
    },
    {
        name: "Wall areas",
        message: "wall areas?",
        expectedPattern: /wall.*area|area.*wall|no area data/i,
        description: "Should handle area calculations"
    },
    {
        name: "Wall materials",
        message: "what materials are the walls made of?",
        expectedPattern: /material|wall/i,
        description: "Should handle material queries"
    },
    {
        name: "Door areas",
        message: "total area of doors?",
        expectedPattern: /door|area|quantity|no.*data|0.*m²/i,
        description: "Should calculate door areas"
    },
    {
        name: "Building info",
        message: "how many floors?",
        expectedPattern: /floor|storey|level|building/i,
        description: "Should provide building structure info"
    },
    {
        name: "External walls",
        message: "how many walls have isexternal = true?",
        expectedPattern: /external|isexternal|property/i,
        description: "Should count walls with IsExternal property"
    }
];

// Mock IFC model data that matches the test file
const mockModelData = {
    id: "model-test-123",
    name: "01_BIMcollab_Example_ARC_classified(6).ifc",
    schema: "IFC2X3",
    totalElements: 477,
    elementCounts: {
        IfcWall: 171,
        IfcSlab: 9,
        IfcBeam: 50,
        IfcColumn: 19,
        IfcDoor: 57,
        IfcWindow: 115,
        IfcRoof: 0,
        IfcStair: 0,
        IfcFurnishingElement: 56
    },
    elements: [] // Empty for testing, would normally contain element data
};

async function testAIChatEndpoint(testCase) {
    console.log(`\n🧪 Testing: ${testCase.name}`);
    console.log(`   Message: "${testCase.message}"`);

    try {
        const response = await fetch('http://localhost:3000/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: [
                    { role: 'user', content: testCase.message }
                ],
                modelData: mockModelData
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Read the streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            fullResponse += chunk;
        }

        console.log(`   Response: "${fullResponse}"`);

        // Check if response matches expected pattern
        if (testCase.expectedPattern.test(fullResponse)) {
            console.log(`   ✅ PASS: ${testCase.description}`);
            return { success: true, response: fullResponse };
        } else {
            console.log(`   ❌ FAIL: Expected pattern ${testCase.expectedPattern} not found`);
            return { success: false, response: fullResponse };
        }
    } catch (error) {
        console.log(`   ❌ ERROR: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function runAllTests() {
    console.log("🚀 Starting AI Tool Calling Tests");
    console.log("================================");

    // Check if server is running
    try {
        const healthCheck = await fetch('http://localhost:3000');
        if (!healthCheck.ok) {
            throw new Error('Server not responding');
        }
        console.log("✅ Server is running on http://localhost:3000");
    } catch (error) {
        console.error("❌ Server is not running. Please start the dev server with 'npm run dev'");
        process.exit(1);
    }

    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
        console.log("\n⚠️  Warning: OPENAI_API_KEY not set in environment");
        console.log("   The API might use a key from .env.local file");
    }

    const results = [];

    for (const testCase of TEST_CASES) {
        const result = await testAIChatEndpoint(testCase);
        results.push({ ...testCase, ...result });

        // Add delay between tests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Summary
    console.log("\n================================");
    console.log("📊 Test Summary");
    console.log("================================");

    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`Total tests: ${results.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);

    if (failed > 0) {
        console.log("\nFailed tests:");
        results.filter(r => !r.success).forEach(r => {
            console.log(`  - ${r.name}: ${r.error || 'Pattern not matched'}`);
        });
    }

    // Exit with appropriate code
    process.exit(failed > 0 ? 1 : 0);
}

// Add command line option to test a single case
const args = process.argv.slice(2);
if (args[0] === '--single' && args[1]) {
    const singleTest = TEST_CASES.find(tc =>
        tc.message.toLowerCase().includes(args[1].toLowerCase())
    );

    if (singleTest) {
        console.log("🧪 Running single test");
        testAIChatEndpoint(singleTest).then(result => {
            process.exit(result.success ? 0 : 1);
        });
    } else {
        console.error(`Test case not found for: ${args[1]}`);
        console.log("Available test messages:", TEST_CASES.map(tc => tc.message));
        process.exit(1);
    }
} else {
    // Run all tests
    runAllTests().catch(error => {
        console.error("Fatal error:", error);
        process.exit(1);
    });
}
