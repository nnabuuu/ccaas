import { Injectable } from '@nestjs/common';

export interface MosaicSession {
  id: string;
  config: any;
  currentIteration: number;
  status: 'active' | 'completed' | 'abandoned';
  createdAt: string;
}

@Injectable()
export class MosaicService {
  private sessions = new Map<string, MosaicSession>();

  createSession(config?: any): MosaicSession {
    const id = `session-${Date.now().toString(36)}`;
    const session: MosaicSession = {
      id,
      config: config || {},
      currentIteration: 0,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    this.sessions.set(id, session);
    return session;
  }

  getSession(id: string): MosaicSession | null {
    return this.sessions.get(id) || null;
  }
}
