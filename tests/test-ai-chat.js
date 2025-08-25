// Test script for AI chat functionality
const testAIChat = async () => {
    const API_URL = 'http://localhost:3001/api/chat';

    // Sample model data (minimal for testing)
    const modelData = {
        id: 'test-model',
        name: 'Test.ifc',
        totalElements: 100,
        elementCounts: {
            IfcWall: 50,
            IfcSlab: 30,
            IfcDoor: 20
        },
        elements: []
    };

    // Test multiple queries
    const testQueries = [
        'How many walls are in the model?',
        'List the wall names',
        'What types of elements are in the model?'
    ];

    for (const query of testQueries) {
        console.log('\n' + '='.repeat(60));
        console.log('🧪 Testing Query:', query);
        console.log('='.repeat(60));

        const testQuery = {
            messages: [
                {
                    role: 'user',
                    content: query
                }
            ],
            model: 'gpt-4o-mini', // Use gpt-4o-mini for better results
            modelData: modelData
        };

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(testQuery)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';

            console.log('\n📝 AI Response:');
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                // Clean up the response for display
                const cleanChunk = chunk.replace(/\d+:"[^"]*"/g, '').replace(/\d+:/g, '');
                fullResponse += cleanChunk;
                process.stdout.write(cleanChunk);
            }

            console.log('\n');

            if (fullResponse.length === 0) {
                console.warn('⚠️  Warning: Empty response received!');
            } else {
                console.log('✅ Response received (length:', fullResponse.length, 'chars)');
            }
        } catch (error) {
            console.error('❌ Test failed:', error.message);
        }

        // Wait a bit between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 All tests completed!');
    console.log('='.repeat(60));
};

// Run the test
testAIChat();
