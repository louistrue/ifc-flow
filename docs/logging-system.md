# AI Conversation Logging System

## Overview

This project uses Winston for structured logging of AI conversations, focusing on semantic correctness analysis and optimization.

## Log Files

- `logs/ai-conversations.log` - Detailed AI conversation tracking
- `logs/combined.log` - All application logs
- `logs/error.log` - Error logs only

## Log Types

### 1. Conversation Turn
Tracks complete user → AI interactions:
```json
{
  "type": "conversation_turn",
  "sessionId": "session_1234567890_abc123",
  "modelName": "02_BIMcollab_Example_STR_random_C_ebkp.ifc",
  "userPrompt": "how many walls?",
  "toolCalls": [
    {
      "toolName": "querySqlite",
      "query": "SELECT COUNT(*) FROM IfcWallStandardCase",
      "description": "Count walls in building model",
      "result": [{"count": 114}]
    }
  ],
  "aiResponse": "There are 114 walls in this building model.",
  "responseTime": 1250,
  "success": true
}
```

### 2. Tool Execution
Tracks individual tool calls:
```json
{
  "type": "tool_execution",
  "toolName": "querySqlite",
  "query": "SELECT COUNT(*) FROM IfcWallStandardCase",
  "description": "Count walls in building model",
  "result": [{"count": 114}],
  "executionTime": 45,
  "success": true
}
```

### 3. Semantic Analysis
Tracks intent detection and tool choice:
```json
{
  "type": "semantic_analysis",
  "userIntent": "how many walls?",
  "detectedKeywords": ["how many", "walls"],
  "toolChoice": "forced querySqlite",
  "queryGenerated": "SELECT COUNT(*) FROM IfcWallStandardCase",
  "resultQuality": "good",
  "semanticAccuracy": 0.9
}
```

## Usage

### View Logs in Real-Time
```bash
node scripts/view-ai-logs.js watch
```

### Analyze Conversation Patterns
```bash
node scripts/view-ai-logs.js analyze
```

### Manual Log Analysis
```bash
# View recent conversations
tail -f logs/ai-conversations.log | jq '.'

# Count successful tool executions
grep '"success":true' logs/ai-conversations.log | wc -l

# Find low semantic accuracy
jq 'select(.semanticAccuracy < 0.7)' logs/ai-conversations.log
```

## Optimization Insights

Use the logs to identify:

1. **Semantic Mismatches**: Low accuracy scores indicate intent detection issues
2. **Tool Choice Errors**: Wrong tool selection for user queries
3. **Query Generation Issues**: SQL queries that don't match user intent
4. **Response Quality**: Incomplete or incorrect AI responses
5. **Performance Bottlenecks**: Slow tool execution or response times

## Log Rotation

Logs automatically rotate:
- AI conversations: 10MB max, 10 files retained
- Combined logs: 5MB max, 5 files retained
- Error logs: 5MB max, 5 files retained

## Privacy

Logs contain user queries and AI responses. Ensure:
- No sensitive data in building models
- Secure log file access
- Regular log cleanup in production
