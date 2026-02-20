import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  toolEvents?: ToolEvent[];
}

export interface ToolEvent {
  toolName: string;
  input: any;
  output?: any;
  status: 'pending' | 'success' | 'error';
}

@Injectable()
export class SessionsService {
  private readonly ccaasUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.ccaasUrl = configService.get<string>('ccaas.url') || 'http://localhost:3001';
  }

  async getMessages(sessionId: string, includeToolEvents = false): Promise<Message[]> {
    try {
      // Remove solution prefix if present (e.g., "pe_" for problem-explainer)
      const actualSessionId = sessionId.startsWith('pe_')
        ? sessionId.substring(3)
        : sessionId;

      const url = new URL(`/api/v1/sessions/${actualSessionId}/messages`, this.ccaasUrl);
      if (includeToolEvents) {
        url.searchParams.set('includeToolEvents', 'true');
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        console.error(`Failed to fetch messages: ${response.status}`);
        return [];
      }

      const data = await response.json();
      return data as Message[];
    } catch (error) {
      console.error('Failed to fetch messages from CCAAS:', error);
      return [];
    }
  }
}
