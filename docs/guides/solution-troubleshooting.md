# Solution Troubleshooting Guide

**Version**: 1.0.0
**Last Updated**: 2026-02-10

This guide provides solutions to common issues when developing and deploying CCAAS solutions using the Solution Development Toolkit.

## Table of Contents

- [Setup Issues](#setup-issues)
- [Dependency Issues](#dependency-issues)
- [Port Conflicts](#port-conflicts)
- [Solution & API Key Issues](#tenant--api-key-issues)
- [Service Startup Issues](#service-startup-issues)
- [Skill & MCP Issues](#skill--mcp-issues)
- [Database Issues](#database-issues)
- [Performance Issues](#performance-issues)
- [Migration Issues](#migration-issues)

## Setup Issues

### Error: "solution-lib.sh not found"

**Symptoms**:
```bash
❌ Error: solution-lib.sh not found at /path/to/tools
   Please run from solutions/ directory
```

**Causes**:
- Incorrect `TOOLS_DIR` path in setup.sh
- Running setup from wrong directory
- Missing tools directory

**Solutions**:

1. **Verify tools directory exists**:
   ```bash
   ls -la ../../tools/solution-lib.sh
   ```

2. **Fix TOOLS_DIR path** in setup.sh:
   ```bash
   SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
   TOOLS_DIR="$SCRIPT_DIR/../../tools"  # Adjust relative path
   ```

3. **Run from correct directory**:
   ```bash
   cd solutions/my-solution
   ./setup.sh
   ```

### Error: "bad interpreter: /bin/bash^M"

**Symptoms**:
```bash
./setup.sh: bad interpreter: /bin/bash^M: no such file or directory
```

**Cause**: DOS/Windows line endings (CRLF) instead of Unix (LF)

**Solution**:
```bash
# Fix line endings
sed -i '' 's/\r$//' setup.sh

# Or use dos2unix if available
dos2unix setup.sh

# Make executable again
chmod +x setup.sh
```

### Syntax Errors

**Symptoms**:
```bash
setup.sh: line 42: syntax error near unexpected token `}'
```

**Solution**:

1. **Check syntax**:
   ```bash
   bash -n setup.sh
   ```

2. **Common issues**:
   - Missing quotes around strings
   - Unclosed brackets or parentheses
   - Invalid function syntax
   - Missing `then` after `if`

3. **Fix line endings** (often the culprit):
   ```bash
   sed -i '' 's/\r$//' setup.sh
   ```

## Dependency Issues

### Missing Dependencies

**Symptoms**:
```bash
❌ Error: Missing required dependencies: jq sqlite3
```

**Solution**:

Install missing dependencies based on your OS:

**macOS**:
```bash
brew install jq sqlite
```

**Ubuntu/Debian**:
```bash
sudo apt-get update
sudo apt-get install jq sqlite3 curl lsof
```

**Verification**:
```bash
command -v node    # Should show path
command -v jq      # Should show path
command -v sqlite3 # Should show path
command -v curl    # Should show path
command -v lsof    # Should show path
```

### Node.js Version Issues

**Symptoms**:
```bash
Error: This package requires Node.js >= 18.0.0
```

**Solution**:

1. **Check Node version**:
   ```bash
   node -v
   ```

2. **Upgrade Node.js**:
   ```bash
   # Using nvm
   nvm install 20
   nvm use 20

   # Or download from nodejs.org
   ```

3. **Verify**:
   ```bash
   node -v  # Should show v18.x.x or higher
   npm -v   # Should show npm version
   ```

## Port Conflicts

### Port Already in Use

**Symptoms**:
```bash
Error: listen EADDRINUSE: address already in use :::3002
```

**Causes**:
- Previous instance still running
- Another service using the port
- Zombie process

**Solutions**:

1. **Use shared library function** (automatic):
   ```bash
   kill_port 3002  # In setup.sh
   ```

2. **Manual kill**:
   ```bash
   # Find process
   lsof -i :3002

   # Kill by PID
   kill -9 <PID>

   # Or kill by port
   lsof -ti:3002 | xargs kill -9
   ```

3. **Kill all Node processes** (last resort):
   ```bash
   killall node
   ```

4. **Change port** in solution.json:
   ```json
   {
     "backend": { "port": 3005 },
     "frontend": { "port": 5283 }
   }
   ```

### Services Won't Stop

**Symptoms**:
- Ctrl+C doesn't stop services
- Processes linger after exit
- Ports remain occupied

**Solutions**:

1. **Verify cleanup handler** in setup.sh:
   ```bash
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

   trap cleanup SIGINT SIGTERM
   ```

2. **Manual cleanup**:
   ```bash
   # Kill all solution services
   pkill -f "my-solution"

   # Kill specific ports
   lsof -ti:3002 | xargs kill -9
   lsof -ti:5280 | xargs kill -9
   ```

3. **Nuclear option**:
   ```bash
   killall node
   ```

## Solution & API Key Issues

### "Cannot connect to CCAAS"

**Symptoms**:
```bash
❌ Error: Cannot connect to CCAAS at http://localhost:3001
Please start CCAAS backend first
```

**Solutions**:

1. **Start CCAAS backend**:
   ```bash
   cd packages/backend
   npm run start:dev
   ```

2. **Verify CCAAS is running**:
   ```bash
   curl http://localhost:3001/api/v1/health
   ```

3. **Check CCAAS URL** in solution.json:
   ```json
   {
     "backend": {
       "ccaasUrl": "http://localhost:3001"  // Verify correct
     }
   }
   ```

4. **Check firewall/proxy**:
   ```bash
   # Disable localhost proxy
   export no_proxy="localhost,127.0.0.1"
   export NO_PROXY="localhost,127.0.0.1"
   ```

### "Solution not found"

**Symptoms**:
```bash
❌ Error: Solution 'my-solution' not found in database
Please create the tenant first.
```

**Solutions**:

1. **Let setup script create it** (automatic):
   ```bash
   # The script creates tenant automatically
   TENANT_ID=$(create_or_get_tenant "$CCAAS_URL" "$SOLUTION_SLUG" "$SOLUTION_NAME" "$SOLUTION_DESCRIPTION")
   ```

2. **Verify tenant was created**:
   ```bash
   curl http://localhost:3001/api/v1/solutions/my-solution
   ```

3. **Create manually** (if needed):
   ```bash
   curl -X POST http://localhost:3001/api/v1/solutions \
     -H "Content-Type: application/json" \
     -d '{
       "slug": "my-solution",
       "name": "My Solution",
       "description": "Solution description"
     }'
   ```

### "Database not found"

**Symptoms**:
```bash
❌ Error: Database not found at ../../packages/backend/.agent-workspace/data.db
```

**Causes**:
- CCAAS backend hasn't created database yet
- Wrong database path
- Database was deleted

**Solutions**:

1. **Wait for CCAAS to initialize**:
   ```bash
   # Start CCAAS and wait
   cd packages/backend
   npm run start:dev

   # Wait for this log:
   # "Database initialized successfully"
   ```

2. **Verify database path**:
   ```bash
   # Default CCAAS database path
   ls -la packages/backend/.agent-workspace/data.db
   ```

3. **Check CCAAS_DB environment variable**:
   ```bash
   # In setup.sh, verify:
   CCAAS_DB="${CCAAS_DB:-../../packages/backend/.agent-workspace/data.db}"
   ```

### API Key Issues

**Symptoms**:
```bash
❌ Error: Invalid API key format (must start with 'sk-')
```

**Solutions**:

1. **Create new API key**:
   ```bash
   # Unset existing key
   unset CCAAS_API_KEY

   # Re-run setup (will create new key)
   ./setup.sh
   ```

2. **Verify API key format**:
   ```bash
   echo $CCAAS_API_KEY  # Should start with 'sk-'
   ```

3. **Save API key** for reuse:
   ```bash
   # Add to .env file (don't commit!)
   echo "CCAAS_API_KEY=$CCAAS_API_KEY" >> .env

   # Load in future sessions
   source .env
   ./setup.sh
   ```

## Service Startup Issues

### "Service did not start"

**Symptoms**:
```bash
❌ Error: Backend did not start on port 3002 after 30 seconds
```

**Solutions**:

1. **Check service logs**:
   ```bash
   # Backend logs
   cd backend
   npm run dev  # Run manually to see errors

   # Frontend logs
   cd frontend
   npm run dev
   ```

2. **Common causes**:
   - Port conflict → Use `kill_port`
   - Missing dependencies → Run `npm install`
   - Configuration error → Check config files
   - Database connection failure → Check database path

3. **Increase wait time**:
   ```bash
   # In setup.sh, increase timeout
   wait_for_port "$BACKEND_PORT" 60  # Wait 60 seconds instead of 30
   ```

4. **Check port is actually listening**:
   ```bash
   lsof -i :3002  # Should show process
   ```

### npm Install Failures

**Symptoms**:
```bash
npm ERR! code ENOENT
npm ERR! syscall open
npm ERR! path /path/to/package.json
npm ERR! errno -2
```

**Solutions**:

1. **Verify package.json exists**:
   ```bash
   ls -la frontend/package.json
   ls -la backend/package.json
   ```

2. **Clean npm cache**:
   ```bash
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Check Node.js version**:
   ```bash
   node -v  # Should be >= 18.0.0
   ```

4. **Use correct registry**:
   ```bash
   npm config set registry https://registry.npmjs.org/
   ```

## Skill & MCP Issues

### Skills Not Injected

**Symptoms**:
```bash
⚠️  No skills directory found at /path/to/skills
```

**Solutions**:

1. **Create skills directory**:
   ```bash
   mkdir -p skills/my-skill
   ```

2. **Add SKILL.md file**:
   ```bash
   cat > skills/my-skill/SKILL.md <<'EOF'
   ---
   name: My Skill
   description: Skill description
   ---

   # Skill Content
   EOF
   ```

3. **Verify directory structure**:
   ```bash
   tree skills/
   # skills/
   # └── my-skill/
   #     └── SKILL.md
   ```

4. **Check injection logs**:
   ```bash
   # Look for:
   # ✅ Skills: 1/1 successful
   ```

### MCP Server Registration Failed

**Symptoms**:
```bash
❌ Failed to create MCP server
Response: {"error": "Invalid configuration"}
```

**Solutions**:

1. **Verify MCP server config** in solution.json:
   ```json
   {
     "mcpServers": {
       "my-server": {
         "command": "node",
         "args": ["mcp-server/dist/index.js"],  // Verify path
         "description": "Server description",
         "type": "stdio",  // or "rest-adapter"
         "env": {}
       }
     }
   }
   ```

2. **Check MCP server is built**:
   ```bash
   ls -la mcp-server/dist/index.js
   ```

3. **Test MCP server manually**:
   ```bash
   cd mcp-server
   npm run build
   node dist/index.js  # Should start without errors
   ```

4. **Verify registration**:
   ```bash
   curl http://localhost:3001/api/v1/mcp-servers \
     -H "X-Solution-Id: my-solution"
   ```

### MCP Tools Not Available

**Symptoms**:
- Skills can't call MCP tools
- "Tool not found" errors

**Solutions**:

1. **Verify MCP server is registered**:
   ```bash
   curl http://localhost:3001/api/v1/mcp-servers/my-server \
     -H "X-Solution-Id: my-solution" \
     -H "X-Api-Key: $CCAAS_API_KEY"
   ```

2. **Check skill allowedTools**:
   ```json
   {
     "skills": [{
       "allowedTools": [
         "write_output",
         "my_custom_tool"  // Must match MCP tool name
       ]
     }]
   }
   ```

3. **Restart CCAAS** to reload MCP servers:
   ```bash
   # Restart CCAAS backend
   cd packages/backend
   npm run start:dev
   ```

## Database Issues

### SQLite Errors

**Symptoms**:
```bash
Error: SQLITE_ERROR: no such table: my_table
```

**Solutions**:

1. **Run migrations**:
   ```bash
   cd backend
   npm run migrate
   ```

2. **Create database with schema**:
   ```bash
   sqlite3 data/my-solution.db < schema.sql
   ```

3. **Verify tables exist**:
   ```bash
   sqlite3 data/my-solution.db ".tables"
   ```

4. **Reset database** (development only):
   ```bash
   rm data/my-solution.db
   npm run migrate
   ```

### Database Locked

**Symptoms**:
```bash
Error: SQLITE_BUSY: database is locked
```

**Solutions**:

1. **Close other connections**:
   ```bash
   # Find processes using database
   lsof data/my-solution.db

   # Kill them
   kill -9 <PID>
   ```

2. **Use WAL mode** (recommended):
   ```sql
   PRAGMA journal_mode=WAL;
   ```

3. **Increase timeout**:
   ```javascript
   // In database connection code
   sqlite3.Database(dbPath, { timeout: 5000 })
   ```

## Performance Issues

### Slow Startup

**Symptoms**:
- Setup takes longer than expected
- Services slow to respond

**Solutions**:

1. **Parallel npm install**:
   ```bash
   # In setup.sh, run in parallel
   (cd frontend && npm install) &
   (cd backend && npm install) &
   wait
   ```

2. **Skip unnecessary builds**:
   ```bash
   # Only build MCP server if changed
   if [ -f "$MCP_DIR/src/.needs-build" ]; then
       npm run build
   fi
   ```

3. **Use npm ci** for faster installs:
   ```bash
   npm ci  # Faster than npm install when package-lock exists
   ```

4. **Cache dependencies**:
   ```bash
   # Use shared node_modules cache
   npm config set cache ~/.npm-cache
   ```

### High Memory Usage

**Symptoms**:
- Node processes using excessive memory
- System becomes sluggish

**Solutions**:

1. **Limit Node memory**:
   ```bash
   # In package.json scripts
   "dev": "node --max-old-space-size=2048 index.js"
   ```

2. **Use production builds**:
   ```bash
   # For production
   npm run build
   NODE_ENV=production npm start
   ```

3. **Monitor memory**:
   ```bash
   # Check memory usage
   ps aux | grep node
   ```

## Migration Issues

### Migration Validation Failures

**Symptoms**:
```bash
❌ Migration validation failed
```

**Solutions**:

1. **Run validation script**:
   ```bash
   ./validate-migration.sh
   ```

2. **Check common issues**:
   - [ ] solution.json is valid JSON
   - [ ] setup.sh has correct syntax
   - [ ] SOLUTION_NAME and SOLUTION_SLUG are set
   - [ ] Ports are defined
   - [ ] Skills directory exists

3. **Compare with working solution**:
   ```bash
   diff -u lesson-plan-designer/setup.sh my-solution/setup.sh
   ```

### Rollback Migration

**Symptoms**:
- New setup doesn't work
- Need to revert to old version

**Solution**:

```bash
cd solutions/my-solution

# Restore from backup
cp .migration-backup/setup.sh.old setup.sh
cp .migration-backup/solution.json.old solution.json
cp .migration-backup/inject-skills.sh.backup inject-skills.sh
chmod +x setup.sh inject-skills.sh

echo "✅ Rollback complete"
```

## Getting Help

If you can't resolve the issue:

1. **Check logs**:
   ```bash
   # CCAAS backend logs
   tail -f packages/backend/logs/*.log

   # Solution logs
   tail -f backend/logs/*.log
   tail -f frontend/logs/*.log
   ```

2. **Enable debug mode**:
   ```bash
   # In setup.sh, add at top
   set -x  # Print all commands
   set -e  # Exit on error

   # Run and capture output
   ./setup.sh 2>&1 | tee setup-debug.log
   ```

3. **Search existing issues**:
   - Check CCAAS repository issues
   - Search for error messages
   - Review closed issues

4. **Ask for help**:
   - Open a GitHub issue
   - Include error messages
   - Provide setup-debug.log
   - Mention OS and Node version

## Preventive Measures

### Pre-Deployment Checklist

Before deploying:

- [ ] Run `bash -n setup.sh` (syntax check)
- [ ] Run `./validate-migration.sh` (if migrated)
- [ ] Test complete setup flow
- [ ] Verify all services start
- [ ] Test skills and MCP servers
- [ ] Test cleanup (Ctrl+C)
- [ ] Document any custom steps

### Regular Maintenance

- **Update dependencies** regularly:
  ```bash
  npm update
  npm audit fix
  ```

- **Clean caches** periodically:
  ```bash
  npm cache clean --force
  rm -rf node_modules
  npm install
  ```

- **Monitor disk space**:
  ```bash
  du -sh data/  # Check database size
  df -h         # Check available space
  ```

- **Backup databases**:
  ```bash
  cp data/my-solution.db data/my-solution.db.backup
  ```

## Quick Reference

### Essential Commands

```bash
# Check service status
lsof -i :3002  # Backend
lsof -i :5280  # Frontend

# Kill port
lsof -ti:3002 | xargs kill -9

# Check CCAAS
curl http://localhost:3001/api/v1/health

# Verify tenant
curl http://localhost:3001/api/v1/solutions/my-solution

# Check database
sqlite3 data/my-solution.db ".tables"

# Test syntax
bash -n setup.sh

# Clean restart
killall node
./setup.sh
```

### Log Locations

```
packages/backend/logs/          # CCAAS logs
solutions/my-solution/backend/logs/  # Solution backend logs
solutions/my-solution/frontend/logs/ # Solution frontend logs
```

---

**Version**: 1.0.0
**Last Updated**: 2026-02-10
**Maintained by**: CCAAS Team
