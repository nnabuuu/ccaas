import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CcaasMessage {
  id: string;
  sessionId: string;
  tenantId: string | null;
  role: 'user' | 'assistant';
  content: string;
  metadata: Record<string, unknown> | null;
  messageIndex: number;
  createdAt: string;
  files?: Array<{
    id: string;
    filename: string;
    mimeType: string | null;
    size: number;
    downloadUrl: string;
  }>;
  toolEvents?: Array<{
    id: string;
    toolUseId: string;
    toolName: string;
    phase: string;
    toolInput: unknown;
    toolOutput: unknown;
    success: boolean | null;
    durationMs: number | null;
    createdAt: string;
  }>;
}

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);
  private readonly ccaasUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.ccaasUrl = this.configService.get<string>('CCAAS_URL') || 'http://localhost:3001';
  }

  /**
   * Fetch messages for a session from CCAAS
   * Session IDs are prefixed with 'lpd_' in CCAAS
   *
   * @param sessionId - The session ID (with or without lpd_ prefix)
   * @param includeToolEvents - Whether to include tool events in the response
   */
  async getMessages(
    sessionId: string,
    includeToolEvents = false,
  ): Promise<CcaasMessage[]> {
    // Ensure session ID has the lpd_ prefix
    const ccaasSessionId = sessionId.startsWith('lpd_')
      ? sessionId
      : `lpd_${sessionId}`;

    // Build URL with optional includeToolEvents parameter
    const params = new URLSearchParams();
    if (includeToolEvents) {
      params.append('includeToolEvents', 'true');
    }
    const queryString = params.toString();
    const url = `${this.ccaasUrl}/api/v1/sessions/${ccaasSessionId}/messages${queryString ? `?${queryString}` : ''}`;

    this.logger.log(`Fetching messages from CCAAS: ${url}`);

    try {
      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`CCAAS messages fetch failed: ${response.status} ${errorText}`);
        throw new Error(`Failed to fetch messages: ${response.statusText}`);
      }

      const data = await response.json();
      this.logger.log(`Fetched ${data.messages?.length || 0} messages for session ${ccaasSessionId}`);

      return data.messages || [];
    } catch (error) {
      this.logger.error(`Error fetching messages from CCAAS: ${error}`);
      throw error;
    }
  }
}
