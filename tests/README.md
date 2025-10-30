# Test Suite Documentation

## Overview

This directory contains comprehensive tests for the IFC Flow Map application. The test suite serves as a safety net before refactoring, documenting current behavior and catching regressions.

## Test Structure

```
tests/
├── fixtures/          # Mock data and test helpers
├── unit/              # Unit tests for individual functions/components
├── integration/       # Integration tests for complete workflows
├── performance/       # Performance benchmarks
└── setup.ts          # Test setup and global mocks
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run with UI
```bash
npm run test:ui
```

### Run with coverage
```bash
npm run test:coverage
```

### Run in watch mode
```bash
npm run test:watch
```

### Run specific test suites
```bash
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:performance   # Performance tests only
```

## Writing Tests

### Test File Naming
- Test files should be named `*.test.ts` or `*.test.tsx`
- Place test files next to source files or in corresponding test directories

### Example Test Structure

```typescript
import { describe, it, expect, vi } from 'vitest'
import { someFunction } from '@/lib/some-module'
import { mockData } from '@/tests/fixtures/test-models'

describe('someFunction', () => {
  it('should do something correctly', () => {
    const result = someFunction(mockData)
    expect(result).toBeDefined()
  })
})
```

## Test Fixtures

Fixtures are located in `tests/fixtures/`:
- `test-models.ts` - Mock IFC model data
- `test-elements.ts` - Sample IFC elements
- `test-files.ts` - Mock File objects
- `test-workflows.ts` - Sample workflow configurations
- `test-helpers.ts` - Utility functions for tests

## Coverage Targets

- **Overall**: 80%+ code coverage
- **Critical paths**: 95%+ (IFC loading, node execution, worker communication)
- **Utility functions**: 90%+
- **Node components**: 70%+

## Coverage Reports

After running `npm run test:coverage`, reports are generated in:
- `coverage/` directory (HTML report)
- Console output (text summary)

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Commits to main branch
- Pre-commit hooks (optional)

## Best Practices

1. **Test behavior, not implementation** - Focus on what the code does, not how
2. **Use descriptive test names** - Test names should clearly describe what is being tested
3. **Keep tests isolated** - Each test should be independent
4. **Mock external dependencies** - Use fixtures and mocks for external services
5. **Test edge cases** - Don't just test happy paths
6. **Keep tests fast** - Use mocks for slow operations

## Debugging Tests

### Run single test file
```bash
npm test tests/unit/specific-test.test.ts
```

### Run tests matching pattern
```bash
npm test -- --grep "pattern"
```

### Debug in VS Code
Use the Vitest extension or add breakpoints and run tests in debug mode.

## Common Issues

### Worker not found
- Ensure worker files are accessible in test environment
- Use mocks for worker operations in unit tests

### IndexedDB errors
- `fake-indexeddb` is automatically imported in `setup.ts`
- Ensure `setup.ts` is properly configured

### React component rendering
- Use `@testing-library/react` for component tests
- Mock React Flow and other heavy dependencies

## Contributing

When adding new features:
1. Write tests first (TDD approach)
2. Ensure tests pass before submitting PR
3. Maintain or improve coverage metrics
4. Update this README if adding new test patterns

