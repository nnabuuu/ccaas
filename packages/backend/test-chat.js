#!/usr/bin/env node
/**
 * Simple test client for Claude Code as a Service
 */

import { io } from 'socket.io-client';

const socket = io('http://localhost:3001', {
  transports: ['websocket'],
});

let clientId = null;

socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('client_id', (data) => {
  clientId = data.clientId;
  console.log('Got client ID:', clientId);

  // Send a chat message
  console.log('\nSending message: "What is 2+2?"');
  socket.emit('chat', {
    message: 'What is 2+2?',
    tenantId: 'default',
  });
});

socket.on('agent_status', (data) => {
  console.log('Agent status:', data.status);
});

socket.on('text_delta', (data) => {
  process.stdout.write(data.text);
});

socket.on('chat_response', (data) => {
  console.log('\n\nFull response:', data.text);
});

socket.on('tool_activity', (data) => {
  console.log('\nTool:', data.payload.toolName, '-', data.payload.phase);
});

socket.on('error', (data) => {
  console.error('Error:', data);
});

socket.on('disconnect', () => {
  console.log('\nDisconnected');
  process.exit(0);
});

// Exit after 60 seconds
setTimeout(() => {
  console.log('\nTimeout - closing connection');
  socket.close();
  process.exit(0);
}, 60000);
