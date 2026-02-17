/**
 * Socket.io Test Client
 *
 * Helpers for testing WebSocket connections in integration tests.
 */

import { io, Socket } from 'socket.io-client';

export interface TestSocketOptions {
  url?: string;
  port?: number;
  autoConnect?: boolean;
  timeout?: number;
}

export interface ReceivedEvent {
  type: string;
  data: unknown;
  timestamp: Date;
}

export class SocketTestClient {
  private socket: Socket | null = null;
  private events: ReceivedEvent[] = [];
  private eventHandlers: Map<string, ((data: unknown) => void)[]> = new Map();
  private url: string;

  constructor(options: TestSocketOptions = {}) {
    const { url, port = 3099 } = options;
    this.url = url || `http://localhost:${port}`;
  }

  /**
   * Connect to the server
   */
  async connect(timeout: number = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, timeout);

      this.socket = io(this.url, {
        transports: ['websocket'],
        autoConnect: true,
      });

      this.socket.on('connect', () => {
        clearTimeout(timer);
        this.setupEventListeners();
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Set up listeners for common event types
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    const eventTypes = [
      'client_id',
      'agent_status',
      'text_delta',
      'tool_activity',
      'thinking_delta',
      'usage_update',
      'session_restored',
      'session_not_found',
      'stats',
      'error',
    ];

    for (const eventType of eventTypes) {
      this.socket.on(eventType, (data: unknown) => {
        this.events.push({
          type: eventType,
          data,
          timestamp: new Date(),
        });

        // Call registered handlers
        const handlers = this.eventHandlers.get(eventType) || [];
        handlers.forEach(h => h(data));
      });
    }
  }

  /**
   * Register a handler for a specific event type
   */
  on(eventType: string, handler: (data: unknown) => void): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  /**
   * Emit an event to the server
   */
  emit(event: string, data: unknown): void {
    if (!this.socket) {
      throw new Error('Not connected');
    }
    this.socket.emit(event, data);
  }

  /**
   * Send a chat message
   */
  sendChat(options: {
    message: string;
    sessionId?: string;
    tenantId?: string;
  }): void {
    this.emit('chat', options);
  }

  /**
   * Send a cancel request
   */
  sendCancel(sessionId?: string): void {
    this.emit('cancel', { sessionId });
  }

  /**
   * Send a reconnect request
   */
  sendReconnect(sessionId: string): void {
    this.emit('reconnect_session', { sessionId });
  }

  /**
   * Get all received events
   */
  getEvents(): ReceivedEvent[] {
    return [...this.events];
  }

  /**
   * Get events of a specific type
   */
  getEventsByType(type: string): ReceivedEvent[] {
    return this.events.filter(e => e.type === type);
  }

  /**
   * Clear all received events
   */
  clearEvents(): void {
    this.events = [];
  }

  /**
   * Wait for a specific event type
   */
  async waitForEvent(
    eventType: string,
    options: {
      timeout?: number;
      predicate?: (data: unknown) => boolean;
    } = {},
  ): Promise<unknown> {
    const { timeout = 5000, predicate } = options;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for event: ${eventType}`));
      }, timeout);

      const handler = (data: unknown) => {
        if (!predicate || predicate(data)) {
          clearTimeout(timer);
          // Remove this handler
          const handlers = this.eventHandlers.get(eventType);
          if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) handlers.splice(index, 1);
          }
          resolve(data);
        }
      };

      this.on(eventType, handler);
    });
  }

  /**
   * Wait for agent to complete
   */
  async waitForCompletion(timeout: number = 10000): Promise<void> {
    await this.waitForEvent('agent_status', {
      timeout,
      predicate: (data: any) =>
        data.status === 'complete' || data.status === 'error',
    });
  }

  /**
   * Wait for a specific number of text_delta events
   */
  async waitForTextDeltas(count: number, timeout: number = 5000): Promise<string> {
    const received: string[] = [];

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for ${count} text_delta events (received ${received.length})`));
      }, timeout);

      const handler = (data: any) => {
        if (data.text) {
          received.push(data.text);
        }
        if (received.length >= count) {
          clearTimeout(timer);
          resolve(received.join(''));
        }
      };

      this.on('text_delta', handler);
    });
  }

  /**
   * Get the client ID assigned by the server
   */
  async getClientId(timeout: number = 2000): Promise<string> {
    const data = await this.waitForEvent('client_id', { timeout }) as { clientId: string };
    return data.clientId;
  }

  /**
   * Get the socket instance for advanced usage
   */
  getSocket(): Socket | null {
    return this.socket;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

/**
 * Create a test client and connect
 */
export async function createConnectedClient(
  options: TestSocketOptions = {},
): Promise<SocketTestClient> {
  const client = new SocketTestClient(options);
  await client.connect(options.timeout);
  return client;
}

/**
 * Create multiple test clients
 */
export async function createMultipleClients(
  count: number,
  options: TestSocketOptions = {},
): Promise<SocketTestClient[]> {
  const clients: SocketTestClient[] = [];

  for (let i = 0; i < count; i++) {
    const client = await createConnectedClient(options);
    clients.push(client);
  }

  return clients;
}
