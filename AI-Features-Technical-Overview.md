# IFC Flow Map - AI Features Technical Overview

## Architecture Overview

The AI features in IFC Flow Map are built using a modern, scalable architecture that combines server-side intelligence with client-side performance optimization. The system leverages the Vercel AI SDK v5 for robust AI interactions while maintaining security and performance standards.

## Core Components

### 1. **AI Chat API (`app/api/chat/route.ts`)**

The central AI API endpoint that handles all chat interactions with comprehensive security and functionality:

```typescript
// Key architectural features:
- OpenRouter integration for multi-model support
- Cloudflare Turnstile security verification
- Comprehensive input validation and sanitization
- Rate limiting with tiered access controls
- Advanced schema discovery workflow
- Client/server-side query execution
```

**Security Features:**
- **Input Validation**: Multi-layer validation using `validateAndSanitizeInput()`
- **Rate Limiting**: Dynamic limits based on verification status (20-50 requests/minute)
- **Suspicious Activity Detection**: Automated blocking of malicious patterns
- **Secure Session Management**: Encrypted HttpOnly cookies with HMAC signatures

**Model Support:**
```typescript
const AI_MODELS = [
  'openai/gpt-4o-mini',
  'openai/gpt-4.1-mini', 
  'openai/gpt-4.1-nano',
  'openai/gpt-5-mini',
  'deepseek/deepseek-v2-chat',
  'google/gemini-flash-1.5',
  'google/gemini-pro-1.5'
];
```

### 2. **AI Node Component (`components/nodes/ai-node.tsx`)**

A comprehensive React component (2500+ lines) that provides the visual chat interface:

**Key Features:**
- Real-time message streaming with AI SDK v5
- Visual tool result displays with expandable details
- Copy-to-clipboard functionality for all messages
- Model picker with search functionality
- Auto-scroll and responsive design
- Tool result propagation to downstream nodes

**Message Handling:**
```typescript
interface Message {
  role: "user" | "assistant";
  content: string;
  toolResults?: ToolResult[];
  id?: string;
  seq?: number;
  createdAt?: number;
}
```

**Tool Result Types:**
```typescript
interface ToolResult {
  type: 'count' | 'area' | 'volume' | 'list' | 'materials' | 'properties' | 'analysis';
  elementType?: string;
  value?: number;
  unit?: string;
  items?: any[];
  description?: string;
}
```

### 3. **Schema Discovery System**

Advanced three-step schema discovery workflow that ensures reliable database queries:

**Mandatory Sequence:**
1. `discoverSchema(action='list_tables')` - Discover all available tables
2. `discoverSchema(action='table_info', tableName='X')` - Get column information
3. `discoverSchema(action='sample_data', tableName='X')` - See sample data
4. `querySqlite()` - Execute actual data queries

**State Management:**
```typescript
const schemaState = {
  schemaDiscoveryComplete: false,
  discoveredTables: [],
  discoveredColumns: {},
  lastActivity: Date.now(),
  stepCount: 0,
  sampleDataExecuted: false
};
```

### 4. **Tool Execution Framework**

Dual execution model for optimal performance and security:

**Server-Side Tools:**
- `discoverSchema`: Schema exploration with validation
- `querySqlite`: Secure SQL query execution
- Error handling and result formatting

**Client-Side Execution:**
- SQLite query execution using sql.js
- Real-time result processing
- Local caching for performance

**Tool Result Propagation:**
```typescript
const propagateToWatchNodes = (toolResults: ToolResult[]) => {
  // Formats and sends structured data to downstream nodes
  // Supports multiple result types and automatic formatting
};
```

### 5. **Security & Validation Layer**

Comprehensive security implementation across multiple layers:

**Input Validation (`lib/input-validator.ts`):**
```typescript
export function validateAndSanitizeInput(input: any) {
  return {
    isValid: boolean,
    isDangerous: boolean,
    isSuspicious: boolean,
    errors: string[],
    warnings: string[]
  };
}
```

**Rate Limiting (`lib/rate-limiter.ts`):**
- Sliding window rate limiting
- IP-based client identification
- Tiered limits based on verification status
- Automatic blocking of suspicious activity

**Turnstile Integration (`lib/turnstile.ts`):**
- Cloudflare Turnstile for bot protection
- Server-side token validation
- Session persistence with secure cookies

## Database Integration

### SQLite Schema Handling

The system supports multiple IFC schema variations through intelligent table detection:

```typescript
// IFC class variant handling
const variants = [
  { trigger: /\bifcwall\b/i, variants: ['IfcWall', 'IfcWallStandardCase'] },
  { trigger: /\bifcbeam\b/i, variants: ['IfcBeam', 'IfcBeamStandardCase'] }
];
```

### Query Optimization

**Count Query Aggregation:**
```sql
-- Automatically combines results from multiple table variants
SELECT COUNT(*) FROM IfcWall 
UNION ALL 
SELECT COUNT(*) FROM IfcWallStandardCase
```

**Schema Discovery Queries:**
```sql
-- Table discovery
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name

-- Column information
PRAGMA table_info(IfcWall)

-- Sample data
SELECT * FROM IfcWall LIMIT 3
```

## AI Model Integration

### OpenRouter Configuration

```typescript
const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const modelSlug = resolveModelSlug(selectedModel);
const aiModel = openrouter.chat(modelSlug);
```

### System Prompts

Advanced system prompt engineering for optimal BIM-specific responses:

```typescript
const systemMsg = `You are a BIM consultant analyzing IFC building models.

WORKFLOW (ENFORCED PROGRAMMATICALLY):
MANDATORY SEQUENCE - ALL STEPS REQUIRED:
1. FIRST: discoverSchema(action='list_tables')
2. SECOND: discoverSchema(action='table_info', tableName='RelevantTable')
3. THIRD: discoverSchema(action='sample_data', tableName='RelevantTable')
4. ONLY THEN: querySqlite
5. FINALLY: Provide text response with answer

RESPONSE RULES:
- NEVER mention technical details: SQL, databases, tools
- Use ONLY clean data results for natural answers
- Always provide final answer in text form
`;
```

### Message Processing

AI SDK v5 message handling with tool result extraction:

```typescript
const parseToolResults = (apiResults: any[]): ToolResult[] => {
  // Comprehensive parsing of different result formats
  // Handles count, list, area, volume, and analysis results
  // Intelligent type detection and normalization
};
```

## Performance Optimizations

### Caching Strategy

**Schema Discovery Caching:**
- Global state management for discovered schemas
- Session-based persistence (5-minute timeout)
- Automatic cleanup of stale sessions

**Message Ordering:**
```typescript
const getOrAssignSeq = (id: string): number => {
  // Monotonic sequence assignment for stable message ordering
  // Prevents re-ordering issues with async operations
};
```

### Memory Management

**Message Deduplication:**
```typescript
// Signature-based change detection
const newSig = JSON.stringify(
  mapped.map(msg => ({
    r: msg.role,
    c: msg.content,
    t: msg.toolResults?.map(tr => ({ ty: tr.type, v: tr.value }))
  }))
);
```

## Error Handling & Recovery

### Comprehensive Error Management

**Schema Discovery Errors:**
```typescript
if (action === 'table_info' && !currentState.tablesDiscovered) {
  throw new Error('Must discover tables first using action="list_tables"');
}
```

**Query Execution Errors:**
- Automatic retry with variant table names
- Graceful degradation for missing tables
- User-friendly error messages without technical details

**Rate Limiting Recovery:**
```typescript
if (!rateLimitResult.allowed) {
  return new Response(JSON.stringify({
    error: 'Rate limit exceeded',
    retryAfter: Math.ceil((resetTime - Date.now()) / 1000)
  }), { status: 429 });
}
```

## Testing Framework

### Automated Test Suite

**AI Chat Testing (`tests/test-ai-chat.js`):**
```javascript
const testQueries = [
  'How many walls are in the model?',
  'List the wall names',
  'What types of elements are in the model?'
];
```

**Compatibility Testing (`tests/test-ai-node-compatibility.js`):**
- Multi-schema validation
- Table variant detection
- Query optimization verification

**Database Integration Tests:**
- SQLite schema discovery
- Query execution verification
- Result formatting validation

## Deployment & Configuration

### Environment Variables

```bash
# Required
OPENROUTER_API_KEY=your_openrouter_key
NEXT_PUBLIC_TURNSTILE_SITEKEY=your_turnstile_sitekey
TURNSTILE_SECRET_KEY=your_turnstile_secret

# Optional
NEXT_PUBLIC_MODEL_LIST=["openai/gpt-4o-mini", "google/gemini-flash-1.5"]
COOKIE_SECRET=your_cookie_secret
```

### Performance Monitoring

**Logging System (`lib/logger.ts`):**
```typescript
aiLogger.logConversationTurn({
  sessionId, clientId, modelName,
  userPrompt, toolCalls, aiResponse,
  responseTime, success, usage
});
```

**Metrics Tracking:**
- Response times
- Success rates
- Tool execution performance
- User engagement patterns

## Security Considerations

### Data Protection

**Input Sanitization:**
- SQL injection prevention
- XSS protection
- Command injection blocking

**Session Security:**
- Encrypted session tokens
- HttpOnly cookie flags
- CSRF protection

**API Security:**
- Request signing with HMAC
- IP-based rate limiting
- Suspicious activity detection

## Future Enhancements

### Planned Improvements

1. **Enhanced AI Models:**
   - Custom fine-tuned models for BIM domain
   - Multi-modal support (images, 3D models)
   - Streaming improvements

2. **Advanced Analytics:**
   - Predictive modeling capabilities
   - Machine learning for pattern recognition
   - Automated insight generation

3. **Integration Enhancements:**
   - REST API for external integrations
   - Webhook support for real-time updates
   - Export to popular BIM software

4. **Performance Optimization:**
   - Response caching
   - Query result memoization
   - Connection pooling

## Conclusion

The AI features represent a sophisticated integration of modern AI capabilities with professional BIM workflows. The architecture prioritizes security, performance, and user experience while maintaining the flexibility to evolve with advancing AI technologies.

The technical implementation demonstrates best practices in AI application development, including robust error handling, comprehensive security measures, and scalable architecture design that can support enterprise-level usage.