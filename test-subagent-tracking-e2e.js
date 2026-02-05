#!/usr/bin/env node
/**
 * E2E Test: SubAgent Tracking
 *
 * Verifies that Task tool calls trigger subagent_started and subagent_completed events
 */

const io = require('socket.io-client');

const SOCKET_URL = 'http://localhost:3001';
const SESSION_ID = `test_subagent_${Date.now()}`;

async function testSubAgentTracking() {
  console.log('🧪 Starting SubAgent Tracking E2E Test...\n');

  const socket = io(SOCKET_URL, {
    transports: ['websocket'],
  });

  let clientId = null;
  const receivedEvents = [];

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error('Test timeout after 60s'));
    }, 60000);

    socket.on('connect', () => {
      console.log('✅ Socket connected');
    });

    socket.on('client_id', (data) => {
      clientId = data.clientId;
      console.log(`🔑 Client ID: ${clientId}\n`);

      // Send a message that will trigger a Task tool (subagent)
      console.log('📤 Sending message: "Use the Task tool to explore the codebase structure"');

      fetch(`http://localhost:3001/api/v1/sessions/${SESSION_ID}/completion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          message: 'Use the Task tool to explore the codebase structure',
          tenantId: 'test',
        }),
      }).catch((err) => {
        console.error('❌ Failed to send message:', err);
      });
    });

    socket.on('subagent_started', (event) => {
      console.log('🤖 subagent_started event received:');
      console.log(`  - agentType: ${event.payload.agentType}`);
      console.log(`  - description: ${event.payload.description || 'N/A'}`);
      console.log(`  - startedAt: ${event.payload.startedAt}`);
      console.log(`  - status: ${event.payload.status}`);
      console.log();
      receivedEvents.push({ type: 'subagent_started', payload: event.payload });
    });

    socket.on('subagent_completed', (event) => {
      console.log('✅ subagent_completed event received:');
      console.log(`  - subAgentId: ${event.payload.subAgentId}`);
      console.log(`  - status: ${event.payload.status}`);
      console.log(`  - durationMs: ${event.payload.durationMs}ms`);
      console.log();
      receivedEvents.push({ type: 'subagent_completed', payload: event.payload });
    });

    socket.on('agent_status', (event) => {
      if (event.status === 'complete') {
        console.log('🏁 Agent completed\n');

        // Verify results
        clearTimeout(timeout);
        socket.disconnect();

        console.log('📊 Test Results:');
        console.log(`  - Total events: ${receivedEvents.length}`);
        console.log(`  - subagent_started: ${receivedEvents.filter(e => e.type === 'subagent_started').length}`);
        console.log(`  - subagent_completed: ${receivedEvents.filter(e => e.type === 'subagent_completed').length}`);
        console.log();

        if (receivedEvents.length >= 2) {
          console.log('✅ SUCCESS: SubAgent tracking working!');
          resolve();
        } else {
          console.log('❌ FAILURE: No subagent events received');
          reject(new Error('No subagent events'));
        }
      }
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Connection error: ${err.message}`));
    });
  });
}

// Run test
testSubAgentTracking()
  .then(() => {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  })
  .catch((err) => {
    console.error(`\n❌ Test failed: ${err.message}`);
    process.exit(1);
  });
