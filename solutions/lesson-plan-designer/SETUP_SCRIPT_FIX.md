# Setup Script Fix - Port Conflict Handling

## Problem

The original `setup.sh` script had a critical flaw where it would:
1. Start services in background without checking if ports are already in use
2. Continue execution even if port binding failed
3. Show "✅ 启动完成!" even though services failed to start
4. Leave zombie processes running from previous executions

### Error Message Seen
```
Error: listen EADDRINUSE: address already in use 0.0.0.0:3002
```

But the script would still show success and continue, causing confusion.

## Root Cause

The script launched `npm run dev &` in background and immediately moved on:

```bash
npm run dev &
BACKEND_PID=$!
sleep 2
# Script continues...
```

Problems:
- No pre-check if port 3002/5280 are occupied
- No post-verification that services successfully bound to ports
- npm process PID was saved, but that doesn't mean the server started
- Port binding happens asynchronously after script continues

## Solution Implemented

### 1. Pre-Start Port Cleanup (Lines 68-86)

Added port checking before starting services:

```bash
echo "🔍 检查端口占用..."

# 检查端口 3002 (后端)
if lsof -Pi :3002 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  端口 3002 已被占用，正在清理旧进程..."
    lsof -ti:3002 | xargs kill -9 2>/dev/null || true
    sleep 1
    echo "✅ 端口 3002 已释放"
fi

# 检查端口 5280 (前端)
if lsof -Pi :5280 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  端口 5280 已被占用，正在清理旧进程..."
    lsof -ti:5280 | xargs kill -9 2>/dev/null || true
    sleep 1
    echo "✅ 端口 5280 已释放"
fi
```

**Benefits:**
- Kills old processes before starting new ones
- Prevents "EADDRINUSE" error
- User sees clear message about what's being cleaned up

### 2. Post-Start Verification (Lines 95-126)

Added port binding verification after starting services:

```bash
# 等待后端启动并验证
echo "⏳ 等待后端启动..."
sleep 3

# 验证后端是否成功绑定端口
if ! lsof -Pi :3002 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "❌ 错误: 后端未能成功启动在端口 3002"
    echo "   请检查后端日志或手动运行: cd backend && npm run dev"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi
echo "✅ 后端启动成功 (端口 3002)"
```

**Benefits:**
- Confirms services actually bound to ports
- Fails fast with clear error message if startup failed
- Prevents false "success" messages

### 3. Enhanced Cleanup (Lines 141-162)

Improved cleanup function to ensure ports are released:

```bash
cleanup() {
    echo ""
    echo "🛑 停止服务..."

    # 停止后台进程
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true

    # 确保端口被释放
    if lsof -Pi :3002 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "   清理端口 3002..."
        lsof -ti:3002 | xargs kill -9 2>/dev/null || true
    fi

    if lsof -Pi :5280 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "   清理端口 5280..."
        lsof -ti:5280 | xargs kill -9 2>/dev/null || true
    fi

    echo "✅ 服务已停止"
    exit 0
}
```

**Benefits:**
- Kills processes by PID first (graceful)
- Falls back to killing by port if processes still running
- Prevents orphaned processes when user hits Ctrl+C

## Behavior Changes

### Before Fix

```
🔧 启动后端服务 (端口 3002)...
[Background: npm run dev starts]
[2 seconds pass]
🎨 启动前端服务 (端口 5280)...
[Background: npm run dev starts]
[3 seconds pass]
✅ 启动完成!  ← FALSE SUCCESS (backend actually failed)

[Later in logs]
Error: listen EADDRINUSE: address already in use 0.0.0.0:3002
```

### After Fix

**Scenario 1: Clean start (no port conflicts)**
```
🔍 检查端口占用...
🔧 启动后端服务 (端口 3002)...
⏳ 等待后端启动...
✅ 后端启动成功 (端口 3002)
🎨 启动前端服务 (端口 5280)...
⏳ 等待前端启动...
✅ 前端启动成功 (端口 5280)
✅ 所有服务启动完成!  ← TRUE SUCCESS
```

**Scenario 2: Port conflicts detected**
```
🔍 检查端口占用...
⚠️  端口 3002 已被占用，正在清理旧进程...
✅ 端口 3002 已释放
⚠️  端口 5280 已被占用，正在清理旧进程...
✅ 端口 5280 已释放
🔧 启动后端服务 (端口 3002)...
⏳ 等待后端启动...
✅ 后端启动成功 (端口 3002)
[continues...]
```

**Scenario 3: Startup failure**
```
🔧 启动后端服务 (端口 3002)...
⏳ 等待后端启动...
❌ 错误: 后端未能成功启动在端口 3002
   请检查后端日志或手动运行: cd backend && npm run dev
[Script exits with error code 1]
```

## Testing

### Test 1: Normal startup (no conflicts)
```bash
./setup.sh
```
Expected: Clean startup, all services verified

### Test 2: Port conflict
```bash
# In terminal 1
cd backend && npm run dev

# In terminal 2
./setup.sh
```
Expected: Script kills old process, starts new one successfully

### Test 3: Multiple rapid starts
```bash
./setup.sh
# Ctrl+C immediately
./setup.sh
```
Expected: Cleanup works, second start succeeds

### Test 4: Cleanup verification
```bash
./setup.sh
# Wait for startup
# Press Ctrl+C
lsof -i :3002
lsof -i :5280
```
Expected: No processes listening on those ports

## Files Modified

- `solutions/lesson-plan-designer/setup.sh`

## Lines Changed

- **Lines 68-86**: Added port conflict detection and cleanup
- **Lines 95-106**: Added backend startup verification
- **Lines 115-126**: Added frontend startup verification
- **Lines 141-162**: Enhanced cleanup function

## Benefits Summary

✅ **No more false success messages** - Script accurately reports startup status
✅ **Automatic cleanup** - Old processes killed before starting new ones
✅ **Fast failure** - Script exits immediately if services can't start
✅ **Better UX** - Clear messages about what's happening
✅ **Reliable cleanup** - Ctrl+C properly stops all services
✅ **Prevents confusion** - Users won't wonder why app works with error messages

## Related Issues

This fix resolves the issue where users would see:
1. "Error: listen EADDRINUSE" in logs
2. But "✅ 启动完成!" from script
3. Confusing state where app works but with errors

The app would work because it was actually using the OLD backend process from a previous run, not the new one that failed to start.
