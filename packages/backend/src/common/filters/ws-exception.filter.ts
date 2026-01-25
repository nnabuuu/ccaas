/**
 * WebSocket Exception Filter
 *
 * Handles exceptions in WebSocket gateways.
 */

import { Catch, ArgumentsHost, Logger } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Catch()
export class WsExceptionFilter extends BaseWsExceptionFilter {
  private readonly logger = new Logger(WsExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<Socket>();
    const error =
      exception instanceof WsException
        ? exception.getError()
        : exception instanceof Error
          ? { message: exception.message }
          : { message: 'Unknown error' };

    this.logger.error(`WebSocket error: ${JSON.stringify(error)}`);

    client.emit('error', {
      type: 'error',
      error,
      timestamp: new Date().toISOString(),
    });
  }
}
