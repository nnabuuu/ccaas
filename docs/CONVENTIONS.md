# Key Conventions

## Imports

```typescript
// Import from workspace packages
import { Session, Skill, TokenUsage } from '@kedge-agentic/common'
import { useAgentState, useFormBridge } from '@kedge-agentic/vue-sdk'
```

## Adding New Types

1. Add interface to `packages/common/src/types/index.ts`
2. Re-export from `packages/common/src/index.ts`
3. Run `npm run build:common`
4. Import from `@kedge-agentic/common` in consumer packages

## Adding New Protocols

1. Add to `packages/common/src/protocols/`
2. Export from `packages/common/src/protocols/index.ts`
3. Run `npm run build:common`

## Adding New Composables (vue-sdk)

1. Create file in `packages/vue-sdk/src/composables/`
2. Export from `packages/vue-sdk/src/composables/index.ts`
3. Document usage in file JSDoc

## Testing

```bash
# Run all tests
npm run test

# Run specific package tests
npm run test -w @kedge-agentic/backend
npm run test -w @kedge-agentic/vue-sdk
npm run test -w @kedge-agentic/common

# Architecture tests
npm run test:architecture
```

## Refactoring Terminology / Field Names

When refactoring terminology or field names across the codebase:

1. **Search First**: Use `Grep` to find ALL usages before making changes
2. **Document Scope**: List all affected files and usage contexts
3. **Verify Coverage**: After changes, grep again to ensure no instances were missed
4. **Update Tests**: Check that tests reflect the new terminology
5. **Update Documentation**: Ensure all docs use consistent terminology
