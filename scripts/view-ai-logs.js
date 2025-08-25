#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const logsDir = path.join(process.cwd(), 'logs');
const aiLogsFile = path.join(logsDir, 'ai-conversations.log');

function formatLogEntry(entry) {
    let data;
    try {
        data = JSON.parse(entry);
    } catch (error) {
        console.log(`⚠️  Skipping malformed log entry: ${error.message}`);
        return;
    }

    const timestamp = new Date(data.timestamp).toLocaleTimeString();

    switch (data.type) {
        case 'conversation_turn':
            console.log(`\n🗣️  [${timestamp}] CONVERSATION TURN`);
            console.log(`   User: "${data.userPrompt}"`);
            console.log(`   Model: ${data.modelName}`);
            console.log(`   Tools: ${data.toolCalls.length} calls`);
            data.toolCalls.forEach((tool, i) => {
                console.log(`     ${i + 1}. ${tool.toolName}: "${tool.query}"`);
            });
            console.log(`   AI Response: "${data.aiResponse.substring(0, 100)}${data.aiResponse.length > 100 ? '...' : ''}"`);
            console.log(`   Time: ${data.responseTime}ms`);
            break;

        case 'tool_execution':
            console.log(`\n🔧 [${timestamp}] TOOL EXECUTION`);
            console.log(`   Tool: ${data.toolName}`);
            console.log(`   Query: "${data.query}"`);
            console.log(`   Success: ${data.success ? '✅' : '❌'}`);
            console.log(`   Time: ${data.executionTime}ms`);
            if (data.error) console.log(`   Error: ${data.error}`);
            break;

        case 'semantic_analysis':
            console.log(`\n🧠 [${timestamp}] SEMANTIC ANALYSIS`);
            console.log(`   Intent: "${data.userIntent}"`);
            console.log(`   Keywords: [${data.detectedKeywords.join(', ')}]`);
            console.log(`   Tool Choice: ${data.toolChoice}`);
            console.log(`   Accuracy: ${(data.semanticAccuracy * 100).toFixed(1)}%`);
            break;
    }
}

function watchLogs() {
    console.log('🔍 Watching AI conversation logs...\n');

    if (!fs.existsSync(aiLogsFile)) {
        console.log('No AI logs file found yet. Start a conversation to see logs.');
        return;
    }

    // Read existing logs
    const existingLogs = fs.readFileSync(aiLogsFile, 'utf8').trim();
    if (existingLogs) {
        existingLogs.split('\n').forEach((line, index) => {
            if (line.trim()) {
                formatLogEntry(line);
            }
        });
    }

    // Watch for new logs
    fs.watchFile(aiLogsFile, (curr, prev) => {
        if (curr.mtime > prev.mtime) {
            const newContent = fs.readFileSync(aiLogsFile, 'utf8').trim();
            const newLines = newContent.split('\n').slice(-1); // Get last line
            newLines.forEach(formatLogEntry);
        }
    });
}

function analyzeLogs() {
    if (!fs.existsSync(aiLogsFile)) {
        console.log('No AI logs file found.');
        return;
    }

    const fileContent = fs.readFileSync(aiLogsFile, 'utf8').trim();

    if (!fileContent) {
        console.log('AI logs file is empty. Start a conversation to generate logs.');
        return;
    }

    // Parse logs safely, filtering out any malformed lines
    const logs = [];
    const lines = fileContent.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        try {
            const logEntry = JSON.parse(line);
            logs.push(logEntry);
        } catch (error) {
            console.log(`⚠️  Skipping malformed log line ${i + 1}: ${error.message}`);
            console.log(`   Line content: ${line.substring(0, 100)}...`);
        }
    }

    const conversations = logs.filter(l => l.type === 'conversation_turn');
    const toolExecutions = logs.filter(l => l.type === 'tool_execution');
    const semanticAnalyses = logs.filter(l => l.type === 'semantic_analysis');

    console.log('\n📊 AI CONVERSATION ANALYTICS\n');
    console.log(`Total Conversations: ${conversations.length}`);
    console.log(`Total Tool Executions: ${toolExecutions.length}`);
    console.log(`Average Response Time: ${conversations.reduce((sum, c) => sum + c.responseTime, 0) / conversations.length || 0}ms`);

    const successfulTools = toolExecutions.filter(t => t.success).length;
    console.log(`Tool Success Rate: ${((successfulTools / toolExecutions.length) * 100).toFixed(1)}%`);

    const avgAccuracy = semanticAnalyses.reduce((sum, s) => sum + s.semanticAccuracy, 0) / semanticAnalyses.length || 0;
    console.log(`Average Semantic Accuracy: ${(avgAccuracy * 100).toFixed(1)}%`);

    console.log('\n🔍 Recent Conversations:');
    conversations.slice(-5).forEach((conv, i) => {
        console.log(`${i + 1}. "${conv.userPrompt}" → "${conv.aiResponse.substring(0, 50)}..."`);
    });
}

const command = process.argv[2];

switch (command) {
    case 'watch':
        watchLogs();
        break;
    case 'analyze':
        analyzeLogs();
        break;
    default:
        console.log('Usage:');
        console.log('  node scripts/view-ai-logs.js watch    # Watch logs in real-time');
        console.log('  node scripts/view-ai-logs.js analyze  # Analyze conversation patterns');
}
