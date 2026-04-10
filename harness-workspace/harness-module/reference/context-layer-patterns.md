# Context-Layer 结构模板

本文档总结 `@kedge-agentic/context-layer` 的关键结构模式，供 harness 模块严格复制。

## 1. package.json

```json
{
  "name": "@kedge-agentic/harness",
  "version": "0.1.0",
  "description": "Harness orchestration framework for iterative agent tasks",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./core": {
      "types": "./dist/core/index.d.ts",
      "default": "./dist/core/index.js"
    },
    "./nestjs": {
      "types": "./dist/nestjs/index.d.ts",
      "default": "./dist/nestjs/index.js"
    },
    "./client": {
      "types": "./dist/client/index.d.ts",
      "default": "./dist/client/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "jest --no-coverage"
  },
  "peerDependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "reflect-metadata": "^0.2.0"
  },
  "peerDependenciesMeta": {
    "@nestjs/common": { "optional": true },
    "@nestjs/core": { "optional": true }
  }
}
```

## 2. tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "NodeNext",
    "lib": ["ES2020"],
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "NodeNext",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.spec.ts"]
}
```

## 3. Barrel Exports

### src/index.ts
```typescript
// Main entry — re-exports everything for NestJS users
export { HarnessModule } from './nestjs/harness.module.js';
export type { HarnessModuleOptions } from './nestjs/harness.module.js';
export { HarnessController } from './nestjs/harness.controller.js';

// Core classes
export { TaskRegistry } from './core/task-registry.js';
export { Orchestrator } from './core/orchestrator.js';
export { InMemoryRunStore } from './core/in-memory-run-store.js';
// ... etc

// All types
export * from './core/interfaces.js';

// Client
export { HarnessClient } from './client/harness-client.js';
```

### src/core/index.ts
```typescript
export * from './interfaces.js';
export { TaskRegistry } from './task-registry.js';
export { Orchestrator } from './core/orchestrator.js';
// ... etc
```

### src/nestjs/index.ts
```typescript
export { HarnessModule } from './harness.module.js';
export type { HarnessModuleOptions } from './harness.module.js';
export { HarnessController } from './harness.controller.js';
```

### src/client/index.ts
```typescript
export { HarnessClient } from './harness-client.js';
export * from './types.js';
```

## 4. forRoot() 模式

```typescript
@Module({})
export class HarnessModule {
  static forRoot(options: HarnessModuleOptions): DynamicModule {
    const registry = new TaskRegistry();
    const runStore = options.runStore ?? new InMemoryRunStore();
    const orchestrator = new Orchestrator(
      options.sessionProvider,
      options.mcpClient,
      runStore,
      registry,
      options.eventEmitter,
    );

    return {
      module: HarnessModule,
      providers: [
        { provide: TaskRegistry, useValue: registry },
        { provide: Orchestrator, useValue: orchestrator },
        { provide: HARNESS_MODULE_OPTIONS, useValue: options },
        // ... RunStore etc
      ],
      controllers: [HarnessController],
      exports: [TaskRegistry, Orchestrator],
    };
  }
}
```

## 5. Import 约定

- 所有相对路径 import **必须** 带 `.js` 后缀
- 示例：`import { TaskRegistry } from './task-registry.js';`
- 不是 `./task-registry` 或 `./task-registry.ts`

## 6. Demo Solution package.json

```json
{
  "name": "harness-demo",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "nest build",
    "start": "node --preserve-symlinks dist/main.js",
    "dev": "nest build && node --preserve-symlinks --enable-source-maps dist/main.js"
  },
  "dependencies": {
    "@kedge-agentic/harness": "file:../../../packages/harness",
    "@nestjs/common": "^10.4.15",
    "@nestjs/core": "^10.4.15",
    "@nestjs/platform-express": "^10.4.22",
    "@nestjs/swagger": "^7.0.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.9",
    "typescript": "^5.3.0",
    "@types/node": "^20.0.0"
  }
}
```

## 7. Demo Solution app.module.ts 模式

```typescript
import { Module } from '@nestjs/common';
import { HarnessModule } from '@kedge-agentic/harness';
import { MockSessionProvider } from './adapters/mock-session-provider';
import { MockMcpClient } from './adapters/mock-mcp-client';
import { MockSetupService } from './adapters/mock-setup.service';

const sessionProvider = new MockSessionProvider('http://localhost:3022');
const mcpClient = new MockMcpClient();

@Module({
  imports: [
    HarnessModule.forRoot({
      sessionProvider,
      mcpClient,
    }),
  ],
  providers: [MockSetupService],
})
export class AppModule {}
```

## 8. Controller 约定

```typescript
@ApiTags('harness')
@Controller('harness')
export class HarnessController {
  // ...
}
```
