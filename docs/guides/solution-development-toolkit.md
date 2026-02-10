# Solution Development Toolkit

**Version**: 1.0.0
**Last Updated**: 2026-02-10

## Introduction

The Solution Development Toolkit is a comprehensive shared library system that eliminates code duplication across CCAAS solutions. It provides standardized, tested, and production-ready functions for common deployment tasks.

### Key Benefits

- **59% average code reduction** across migrated solutions
- **Single source of truth** for common operations
- **Consistent professional output** with color-coded logging
- **Comprehensive error handling** and validation
- **21 unit tests** with 100% pass rate
- **Easy maintenance** - bug fixes benefit all solutions

### What's Included

1. **solution-lib.sh** - 945-line shared library with 30 reusable functions
2. **test-solution-lib.sh** - Comprehensive unit test suite
3. **Complete documentation** - API reference and best practices
4. **Migration tools** - Proven migration pattern
5. **Validation scripts** - Automated testing and verification

## Quick Start

### Creating a New Solution

Follow these steps to create a new solution using the toolkit:

#### Step 1: Create Directory Structure

```bash
cd solutions
mkdir my-solution
cd my-solution

# Create standard directories
mkdir -p frontend backend mcp-server skills data .solution-hooks
```

#### Step 2: Create solution.json

Create a standardized `solution.json` file:

```json
{
  "$schema": "https://ccaas.dev/schemas/solution.v1.json",

  "name": "My Solution",
  "slug": "my-solution",
  "version": "1.0.0",
  "description": "Solution description",

  "backend": {
    "port": 3002,
    "ccaasUrl": "http://localhost:3001",
    "database": {
      "type": "sqlite",
      "path": "data/my-solution.db"
    }
  },

  "frontend": {
    "port": 5280
  },

  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "description": "MCP server description",
      "type": "stdio",
      "env": {}
    }
  },

  "skills": [
    {
      "name": "My Skill",
      "slug": "my-skill",
      "description": "Skill description",
      "skillFile": "skills/my-skill/SKILL.md",
      "scope": "tenant",
      "triggers": [
        { "type": "keyword", "value": "keyword", "priority": 10 }
      ],
      "allowedTools": ["write_output", "Read", "Write"]
    }
  ],

  "setup": {
    "skipSteps": [],
    "customScripts": {
      "preInstall": ".solution-hooks/pre-install.sh",
      "customInit": ".solution-hooks/custom-init.sh",
      "postInstall": ".solution-hooks/post-install.sh"
    }
  }
}
```

#### Step 3: Create setup.sh

Create the standard setup script:

```bash
#!/bin/bash
# My Solution - Setup Script
# Uses: tools/solution-lib.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOOLS_DIR="$SCRIPT_DIR/../../tools"

# Source shared library
if [ ! -f "$TOOLS_DIR/solution-lib.sh" ]; then
    echo "❌ Error: solution-lib.sh not found at $TOOLS_DIR"
    echo "   Please run from solutions/ directory"
    exit 1
fi

source "$TOOLS_DIR/solution-lib.sh"

# Load solution configuration
load_solution_config "$SCRIPT_DIR"

# Custom initialization (optional)
custom_init() {
    # Add solution-specific setup here
    # Examples:
    # - Build MCP server
    # - Import data
    # - Run migrations

    log_info "Running custom initialization..."

    # Build MCP server if needed
    if [ -d "$SCRIPT_DIR/mcp-server" ]; then
        cd "$SCRIPT_DIR/mcp-server"
        npm install > /dev/null 2>&1
        npm run build > /dev/null 2>&1
        log_success "MCP server built"
    fi

    return 0
}

# Main workflow
main() {
    log_header "$SOLUTION_NAME Setup"

    # Step 1: Check dependencies
    log_step "1" "Checking dependencies"
    check_dependencies
    log_info "Node.js version: $(node -v)"

    # Step 2: Check CCAAS backend
    log_step "2" "Verifying CCAAS backend"
    check_ccaas_backend

    # Step 3: Install npm dependencies
    log_step "3" "Installing dependencies"
    run_hook "preInstall"
    install_npm_dependencies "$SCRIPT_DIR/frontend"
    install_npm_dependencies "$SCRIPT_DIR/backend"

    # Step 3.5: Custom initialization
    custom_init

    # Step 4: Create or get tenant
    log_step "4" "Setting up tenant"
    TENANT_ID=$(create_or_get_tenant "$CCAAS_URL" "$SOLUTION_SLUG" "$SOLUTION_NAME" "$SOLUTION_DESCRIPTION")
    log_info "Tenant ID: $TENANT_ID"

    # Step 5: Create or get API key
    log_step "5" "Setting up API key"
    if [ -z "$CCAAS_API_KEY" ]; then
        CCAAS_API_KEY=$(create_bootstrap_key "$CCAAS_DB" "$SOLUTION_SLUG" --quiet)
        export CCAAS_API_KEY
        log_success "Bootstrap API Key created: ${CCAAS_API_KEY:0:16}..."
        echo ""
        log_warn "🔐 Please save this API Key (shown only once):"
        echo "   $CCAAS_API_KEY"
        echo ""
    else
        log_success "Using existing API Key: ${CCAAS_API_KEY:0:16}..."
    fi

    # Step 6: Inject skills and MCP servers
    log_step "6" "Injecting skills and MCP servers"
    inject_skills "$SCRIPT_DIR/skills" "$CCAAS_URL" "$TENANT_ID" "$CCAAS_API_KEY"
    inject_mcp_servers "$SCRIPT_DIR" "$CCAAS_URL" "$TENANT_ID" "$CCAAS_API_KEY"

    run_hook "postInstall"

    # Step 7: Clear ports
    log_step "7" "Preparing ports"
    kill_port "$BACKEND_PORT"
    kill_port "$FRONTEND_PORT"

    # Step 8: Start services
    log_step "8" "Starting services"
    BACKEND_PID=$(start_service "backend" "$SCRIPT_DIR/backend" "$BACKEND_PORT" "npm run dev")
    wait_for_port "$BACKEND_PORT" 30

    FRONTEND_PID=$(start_service "frontend" "$SCRIPT_DIR/frontend" "$FRONTEND_PORT" "npm run dev")
    wait_for_port "$FRONTEND_PORT" 30

    # Step 9: Display summary
    display_summary

    echo ""
    log_warn "⚠️  Ensure CCAAS backend is running on port 3001:"
    echo "   cd packages/backend && npm run start:dev"
    echo ""
    echo "Press Ctrl+C to stop all services"

    # Wait for Ctrl+C
    trap cleanup SIGINT SIGTERM
    wait
}

# Cleanup function
cleanup() {
    echo ""
    log_info "Stopping services..."
    stop_service "$BACKEND_PID"
    stop_service "$FRONTEND_PID"
    kill_port "$BACKEND_PORT"
    kill_port "$FRONTEND_PORT"
    log_success "Services stopped"
    exit 0
}

# Run main
main "$@"
```

Make it executable:
```bash
chmod +x setup.sh
```

#### Step 4: Run Setup

```bash
./setup.sh
```

Expected output:
```
========================================
  My Solution Setup
========================================

Step 1: Checking dependencies
ℹ️  Checking dependencies...
✅ All dependencies installed
ℹ️  Node.js version: v20.x.x

Step 2: Verifying CCAAS backend
ℹ️  Checking CCAAS connectivity at http://localhost:3001...
✅ CCAAS is running at http://localhost:3001

...

========================================
  Setup Complete
========================================

Solution: My Solution
Version: 1.0.0

📍 Frontend: http://localhost:5280
📍 Backend: http://localhost:3002
📍 CCAAS: http://localhost:3001

Press Ctrl+C to stop all services
```

## Directory Structure Convention

Follow this standard structure for consistency:

```
my-solution/
├── setup.sh                    # Standard entry point (REQUIRED)
├── solution.json               # Configuration (REQUIRED)
│
├── frontend/                   # Frontend code
│   ├── package.json
│   └── src/
│
├── backend/                    # Backend code (optional)
│   ├── package.json
│   └── src/
│
├── mcp-server/                 # MCP server (optional)
│   ├── package.json
│   ├── src/
│   └── dist/
│
├── skills/                     # Skills directory
│   └── my-skill/
│       └── SKILL.md
│
├── data/                       # Database and data files
│
├── .solution-hooks/            # Custom hooks (optional)
│   ├── pre-install.sh
│   ├── custom-init.sh
│   └── post-install.sh
│
└── .migration-backup/          # Migration backups (if migrated)
```

## Naming Conventions

### Solution Names

- **slug**: kebab-case (e.g., `my-solution`)
- **name**: Title Case (e.g., `My Solution`)

### Ports

Follow these port ranges to avoid conflicts:

- **Backend**: 3002-3010 range
- **Frontend**: 5280-5290 range
- **MCP Server**: 3004-3014 range (if REST adapter)

**Reserved**:
- 3001: CCAAS Backend (core)
- 5179: CCAAS Demo

### Skills

- **slug**: kebab-case (e.g., `my-skill`)
- **name**: Title Case (e.g., `My Skill`)
- **file**: `skills/{slug}/SKILL.md`

### MCP Servers

- **name**: kebab-case (e.g., `my-server-tools`)
- **description**: Clear, concise description of tools provided

## Using the Shared Library

### Key Functions

#### Configuration Management

```bash
# Load configuration from solution.json
load_solution_config "$SCRIPT_DIR"

# Access loaded variables
echo "Solution: $SOLUTION_NAME"
echo "Slug: $SOLUTION_SLUG"
echo "Backend: $BACKEND_PORT"
echo "Frontend: $FRONTEND_PORT"

# Validate configuration
validate_solution_config
```

#### Port Management

```bash
# Check if port is available
if check_port_available 3002; then
    echo "Port 3002 is available"
fi

# Kill process on port
kill_port 3002

# Wait for port to be ready
npm run dev &
wait_for_port 3002 30  # Wait up to 30 seconds
```

#### Tenant Management

```bash
# Create or get tenant
TENANT_ID=$(create_or_get_tenant \
    "http://localhost:3001" \
    "my-solution" \
    "My Solution" \
    "Solution description")

# Verify tenant exists
if verify_tenant_exists "$TENANT_ID"; then
    echo "Tenant verified"
fi
```

#### API Key Management

```bash
# Create bootstrap API key
CCAAS_API_KEY=$(create_bootstrap_key \
    "../../packages/backend/.agent-workspace/data.db" \
    "my-solution" \
    --quiet)

# Verify API key format
if verify_api_key "$CCAAS_API_KEY"; then
    echo "API key is valid"
fi
```

#### Service Management

```bash
# Start a service
BACKEND_PID=$(start_service \
    "backend" \
    "./backend" \
    3002 \
    "npm run dev")

# Wait for service to be ready
wait_for_service_ready 3002 30

# Check service health
if check_service_health "http://localhost:3002/health"; then
    echo "Service is healthy"
fi

# Stop service
stop_service "$BACKEND_PID"
```

#### Skill & MCP Management

```bash
# Inject all skills
inject_skills \
    "$SCRIPT_DIR/skills" \
    "http://localhost:3001" \
    "$TENANT_ID" \
    "$CCAAS_API_KEY"

# Inject all MCP servers (from solution.json)
inject_mcp_servers \
    "$SCRIPT_DIR" \
    "http://localhost:3001" \
    "$TENANT_ID" \
    "$CCAAS_API_KEY"
```

#### Hook System

```bash
# Run pre-install hook
run_hook "preInstall"

# Run custom initialization hook
run_hook "customInit"

# Run post-install hook
run_hook "postInstall"
```

### Custom Hooks

Create custom hooks in `.solution-hooks/` for solution-specific logic:

**pre-install.sh** - Runs before npm install:
```bash
#!/bin/bash
echo "Running pre-install checks..."
# Check for required files, environment variables, etc.
```

**custom-init.sh** - Runs during initialization:
```bash
#!/bin/bash
echo "Running custom initialization..."
# Database migrations, data import, etc.
```

**post-install.sh** - Runs after all setup:
```bash
#!/bin/bash
echo "Running post-install tasks..."
# Send notifications, log completion, etc.
```

Make hooks executable:
```bash
chmod +x .solution-hooks/*.sh
```

## Best Practices

### 1. Use Shared Library Functions

❌ **Don't** reimplement existing functionality:
```bash
# BAD: Manual port checking
if lsof -Pi :3002 -sTCP:LISTEN -t >/dev/null 2>&1; then
    lsof -ti:3002 | xargs kill -9 2>/dev/null || true
fi
```

✅ **Do** use shared library:
```bash
# GOOD: Use shared function
kill_port 3002
```

### 2. Keep Custom Logic Minimal

Put only solution-specific logic in `custom_init()`:

✅ **Appropriate for custom_init()**:
- Database migrations
- Data import workflows
- Solution-specific builds
- Custom validation

❌ **Don't put in custom_init()**:
- Port management
- Tenant creation
- Skill injection
- Service startup

### 3. Test Thoroughly

Before deploying:

```bash
# 1. Syntax check
bash -n setup.sh

# 2. Run setup in test environment
./setup.sh

# 3. Verify services started
curl http://localhost:$BACKEND_PORT/health
curl http://localhost:$FRONTEND_PORT

# 4. Test skills and MCP servers
# (manual verification)

# 5. Test cleanup
# Press Ctrl+C and verify clean shutdown
```

### 4. Document Custom Logic

Add clear comments to `custom_init()`:

```bash
custom_init() {
    # Build MCP server (solution-specific)
    # This solution uses a TypeScript MCP server that needs compilation
    log_info "Building MCP server..."

    local mcp_dir="$SCRIPT_DIR/mcp-server"
    if [ -d "$mcp_dir" ]; then
        cd "$mcp_dir"
        npm install > /dev/null 2>&1
        npm run build > /dev/null 2>&1
        log_success "MCP server built"
    fi

    return 0
}
```

### 5. Follow Naming Conventions

Be consistent across all solutions:

```json
{
  "name": "My Solution",           // Title Case
  "slug": "my-solution",            // kebab-case
  "backend": { "port": 3002 },      // 3002-3010 range
  "frontend": { "port": 5280 },     // 5280-5290 range
  "skills": [
    {
      "name": "My Skill",           // Title Case
      "slug": "my-skill",           // kebab-case
      "skillFile": "skills/my-skill/SKILL.md"
    }
  ]
}
```

### 6. Handle Errors Gracefully

The shared library uses `set -e`, so:

- Functions exit on error automatically
- Add appropriate error messages
- Use try/catch patterns for optional operations

```bash
# Optional operation that shouldn't fail setup
if [ -f "optional-file.txt" ]; then
    process_optional_file || log_warn "Failed to process optional file"
else
    log_info "Optional file not found, skipping"
fi
```

### 7. Keep solution.json Clean

- Only include fields you actually use
- Remove commented-out sections
- Keep arrays compact when possible

```json
{
  "skills": [
    {
      "name": "Skill Name",
      "slug": "skill-slug",
      "description": "Description",
      "skillFile": "skills/skill-slug/SKILL.md",
      "scope": "tenant"
    }
  ]
}
```

## Advanced Topics

### Multiple Backends

If your solution has multiple backend services:

```bash
# Start multiple services
API_PID=$(start_service "api" "./api" 3002 "npm run dev")
WORKER_PID=$(start_service "worker" "./worker" 3003 "npm run dev")

wait_for_port 3002 30
wait_for_port 3003 30

# Clean up all on exit
cleanup() {
    stop_service "$API_PID"
    stop_service "$WORKER_PID"
    kill_port 3002
    kill_port 3003
}
```

### Custom Validation

Add validation in `custom_init()`:

```bash
custom_init() {
    # Validate required files
    if [ ! -f "$SCRIPT_DIR/resources/required-data.xlsx" ]; then
        log_error "Required file missing: resources/required-data.xlsx"
        echo "Please add the required file and re-run setup."
        exit 1
    fi

    # Validate environment variables
    if [ -z "$MY_CUSTOM_VAR" ]; then
        log_warn "MY_CUSTOM_VAR not set, using default"
        export MY_CUSTOM_VAR="default-value"
    fi

    return 0
}
```

### Conditional Setup

Skip steps based on flags:

```bash
# In solution.json
{
  "setup": {
    "skipSteps": ["skill-injection"]
  }
}

# In setup.sh
if [[ ! " ${SKIP_STEPS[@]} " =~ " skill-injection " ]]; then
    inject_skills "$SCRIPT_DIR/skills" "$CCAAS_URL" "$TENANT_ID" "$CCAAS_API_KEY"
fi
```

### Development vs Production

```bash
# Check environment
if [ "$NODE_ENV" = "production" ]; then
    log_info "Running in production mode"
    # Use production builds
    npm run build
    npm start
else
    log_info "Running in development mode"
    # Use dev mode
    npm run dev
fi
```

## Testing

### Unit Tests

The shared library includes comprehensive unit tests:

```bash
cd tools
./test-solution-lib.sh
```

Expected output:
```
========================================
  solution-lib.sh Unit Tests
========================================

=== Testing Logging Utilities ===
✓ log_info produces output
✓ log_success produces output
...

Total: 21
Passed: 21
Failed: 0

✅ All tests passed!
```

### Integration Testing

Test your solution setup:

```bash
# 1. Clean environment
rm -rf .migration-backup/
killall node 2>/dev/null || true

# 2. Run setup
./setup.sh

# 3. Verify services
curl http://localhost:$BACKEND_PORT/health
curl http://localhost:$FRONTEND_PORT

# 4. Check logs
tail -f backend/logs/app.log
tail -f frontend/logs/app.log

# 5. Test cleanup
# Press Ctrl+C
# Verify no lingering processes
lsof -i :$BACKEND_PORT
lsof -i :$FRONTEND_PORT
```

## Troubleshooting

See [Solution Troubleshooting Guide](./solution-troubleshooting.md) for detailed troubleshooting steps.

### Quick Fixes

**"solution-lib.sh not found"**:
```bash
# Verify path is correct
TOOLS_DIR="$SCRIPT_DIR/../../tools"
ls -la "$TOOLS_DIR/solution-lib.sh"
```

**"Port already in use"**:
```bash
# Kill the port
kill_port 3002
```

**"Cannot connect to CCAAS"**:
```bash
# Start CCAAS backend
cd packages/backend
npm run start:dev
```

**"Tenant not found"**:
```bash
# Library will create it automatically
# If it still fails, check CCAAS is running
```

## Migration Guide

If you have an existing solution, see [Migrating to solution-lib.sh](./migrating-to-solution-lib.md) for detailed migration instructions.

## Examples

### Minimal Solution

For a frontend-only solution:

```bash
custom_init() {
    # No custom initialization needed
    return 0
}

main() {
    log_header "$SOLUTION_NAME Setup"

    check_dependencies
    check_ccaas_backend

    install_npm_dependencies "$SCRIPT_DIR/frontend"

    TENANT_ID=$(create_or_get_tenant "$CCAAS_URL" "$SOLUTION_SLUG" "$SOLUTION_NAME" "$SOLUTION_DESCRIPTION")

    if [ -z "$CCAAS_API_KEY" ]; then
        CCAAS_API_KEY=$(create_bootstrap_key "$CCAAS_DB" "$SOLUTION_SLUG" --quiet)
        export CCAAS_API_KEY
    fi

    inject_skills "$SCRIPT_DIR/skills" "$CCAAS_URL" "$TENANT_ID" "$CCAAS_API_KEY"

    kill_port "$FRONTEND_PORT"

    FRONTEND_PID=$(start_service "frontend" "$SCRIPT_DIR/frontend" "$FRONTEND_PORT" "npm run dev")
    wait_for_port "$FRONTEND_PORT" 30

    display_summary

    trap cleanup SIGINT SIGTERM
    wait
}
```

### Complex Solution (with Data Import)

```bash
custom_init() {
    log_step "3.5" "Custom initialization"

    # Import data
    log_info "Importing data..."
    cd "$SCRIPT_DIR/scripts"
    npm install > /dev/null 2>&1
    node import-data.js
    log_success "Data imported"

    # Run migrations
    log_info "Running database migrations..."
    cd "$SCRIPT_DIR/backend"
    npm run migrate
    log_success "Migrations complete"

    # Build MCP server
    log_info "Building MCP server..."
    cd "$SCRIPT_DIR/mcp-server"
    npm install > /dev/null 2>&1
    npm run build > /dev/null 2>&1
    log_success "MCP server built"

    return 0
}
```

## Resources

- **API Reference**: [tools/README.md](../../tools/README.md)
- **Shared Library**: [tools/solution-lib.sh](../../tools/solution-lib.sh)
- **Unit Tests**: [tools/test-solution-lib.sh](../../tools/test-solution-lib.sh)
- **Troubleshooting**: [solution-troubleshooting.md](./solution-troubleshooting.md)
- **Migration Guide**: [migrating-to-solution-lib.md](./migrating-to-solution-lib.md)

## Support

For issues or questions:

1. Check [Troubleshooting Guide](./solution-troubleshooting.md)
2. Review [Migration Guide](./migrating-to-solution-lib.md)
3. Check existing solutions for examples:
   - lesson-plan-designer (complete workflow)
   - quiz-analyzer (data import)
   - problem-explainer (MCP REST server)
4. Open an issue in the CCAAS repository

---

**Version**: 1.0.0
**Last Updated**: 2026-02-10
**Maintained by**: CCAAS Team
