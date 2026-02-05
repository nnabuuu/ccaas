/**
 * Test script for SubAgent tracking
 *
 * This script connects to the WebSocket server and sends a message that will
 * trigger a Task tool (subagent) to verify that:
 * 1. subagent_started event is emitted
 * 2. subagent_completed event is emitted
 * 3. agent_status includes activeSubAgents array
 */

const io = require('socket.io-client');

const SOCKET_URL = 'http://localhost:3001';
const TENANT_ID = 'lesson-plan-designer';

console.log('🔌 Connecting to WebSocket server...');

const socket = io(SOCKET_URL, {
  transports: ['websocket'],
  reconnection: false,
});

let clientId = null;
let sessionId = `test_subagent_${Date.now()}`;
let subagentStarted = false;
let subagentCompleted = false;
let activeSubAgentsReceived = false;

socket.on('connect', () => {
  console.log('✅ Connected to server');
});

socket.on('client_id', (data) => {
  clientId = data.clientId;
  console.log(`📝 Received client ID: ${clientId}`);

  // Send a message that will trigger a Task tool (subagent)
  console.log('\n📤 Sending test message that will trigger a Task tool...');
  socket.emit('chat', {
    sessionId,
    tenantId: TENANT_ID,
    message: 'Please use the Task tool to explore the codebase and find all TypeScript files in the src directory.',
    context: {},
  });
});

socket.on('subagent_started', (data) => {
  subagentStarted = true;
  console.log('\n🚀 SubAgent Started Event:');
  console.log(`   Agent Type: ${data.payload.agentType}`);
  console.log(`   SubAgent ID: ${data.payload.subAgentId}`);
  console.log(`   Description: ${data.payload.description || 'N/A'}`);
  console.log(`   Started At: ${data.payload.startedAt}`);
  console.log(`   Status: ${data.payload.status}`);
  console.log(`   Nesting Level: ${data.payload.nestingLevel}`);
});

socket.on('subagent_completed', (data) => {
  subagentCompleted = true;
  console.log('\n✅ SubAgent Completed Event:');
  console.log(`   SubAgent ID: ${data.payload.subAgentId}`);
  console.log(`   Status: ${data.payload.status}`);
  console.log(`   Duration: ${data.payload.durationMs}ms`);
  if (data.payload.error) {
    console.log(`   Error: ${data.payload.error}`);
  }
});

socket.on('agent_status', (data) => {
  if (data.context?.activeSubAgents) {
    activeSubAgentsReceived = true;
    console.log('\n📊 Agent Status with Active SubAgents:');
    console.log(`   Status: ${data.status}`);
    console.log(`   Active SubAgents Count: ${data.context.activeSubAgents.length}`);
    if (data.context.activeSubAgents.length > 0) {
      console.log('   Active SubAgents:');
      data.context.activeSubAgents.forEach((agent, i) => {
        console.log(`     ${i + 1}. ${agent.agentType} - ${agent.status} (started: ${agent.startedAt})`);
      });
    }
  }

  if (data.status === 'complete') {
    console.log('\n🎉 Agent completed!');
    printSummary();
    process.exit(0);
  } else if (data.status === 'error') {
    console.log(`\n❌ Agent error: ${data.error}`);
    printSummary();
    process.exit(1);
  }
});

socket.on('text_delta', (data) => {
  process.stdout.write('.');
});

socket.on('tool_activity', (data) => {
  const { toolName, phase, description, agentType, nestingLevel } = data.payload;
  if (phase === 'start') {
    console.log(`\n🔧 Tool: ${toolName} (${agentType}, level ${nestingLevel}) - ${description}`);
  }
});

socket.on('disconnect', () => {
  console.log('\n❌ Disconnected from server');
  printSummary();
  process.exit(1);
});

socket.on('connect_error', (err) => {
  console.error(`\n❌ Connection error: ${err.message}`);
  printSummary();
  process.exit(1);
});

function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('Test Summary:');
  console.log('='.repeat(60));
  console.log(`✓ SubAgent Started Event Received: ${subagentStarted ? '✅' : '❌'}`);
  console.log(`✓ SubAgent Completed Event Received: ${subagentCompleted ? '✅' : '❌'}`);
  console.log(`✓ Agent Status with ActiveSubAgents: ${activeSubAgentsReceived ? '✅' : '❌'}`);
  console.log('='.repeat(60));
}

// Timeout after 2 minutes
setTimeout(() => {
  console.log('\n⏱️  Test timeout after 2 minutes');
  printSummary();
  process.exit(1);
}, 120000);

console.log('⏳ Waiting for events...\n');
