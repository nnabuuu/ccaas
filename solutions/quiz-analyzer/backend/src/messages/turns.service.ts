import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Turn } from '../database/entities';

export interface CreateTurnDto {
  sessionId: string;
  userMessageId: string;
}

export interface CompleteTurnDto {
  assistantMessageId: string;
  totalTokens?: number;
  durationMs?: number;
}

@Injectable()
export class TurnsService {
  constructor(
    @InjectRepository(Turn)
    private turnRepository: Repository<Turn>,
  ) {}

  async createTurn(dto: CreateTurnDto): Promise<Turn> {
    // Use transaction to prevent race condition in auto-incrementing turn_number
    return this.turnRepository.manager.transaction(async (manager) => {
      const turnRepo = manager.getRepository(Turn);

      // Use MAX + 1 instead of COUNT to get next number atomically
      const result = await turnRepo
        .createQueryBuilder('turn')
        .select('MAX(turn.turn_number)', 'maxNumber')
        .where('turn.session_id = :sessionId', { sessionId: dto.sessionId })
        .getRawOne();

      const nextNumber = result?.maxNumber != null ? result.maxNumber + 1 : 0;

      const turn = turnRepo.create({
        id: `turn_${uuidv4()}`,
        session_id: dto.sessionId,
        turn_number: nextNumber,
        user_message_id: dto.userMessageId,
        assistant_message_id: null,
        total_tokens: 0,
        duration_ms: 0,
      });

      return turnRepo.save(turn);
    });
  }

  async completeTurn(turnId: string, dto: CompleteTurnDto): Promise<Turn | null> {
    const turn = await this.turnRepository.findOne({ where: { id: turnId } });
    if (!turn) {
      return null;
    }

    turn.assistant_message_id = dto.assistantMessageId;
    turn.total_tokens = dto.totalTokens ?? 0;
    turn.duration_ms = dto.durationMs ?? 0;
    turn.completed_at = new Date().toISOString();

    return this.turnRepository.save(turn);
  }

  async getTurnsBySession(sessionId: string): Promise<Turn[]> {
    return this.turnRepository.find({
      where: { session_id: sessionId },
      order: { turn_number: 'ASC' },
    });
  }

  async getLatestTurn(sessionId: string): Promise<Turn | null> {
    return this.turnRepository.findOne({
      where: { session_id: sessionId },
      order: { turn_number: 'DESC' },
    });
  }
}
