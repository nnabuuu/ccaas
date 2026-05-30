/**
 * DTO for `POST /api/v1/workflow/sessions/:sessionId/events`.
 *
 * Phase 5 M1 ships a minimal schema — validator-friendly + small
 * enough that retries from the live-lesson outbox are cheap. The
 * actual `payload` shape is validated by the stream's `payloadSchema`
 * inside the WorkflowEngine, not at the HTTP boundary, so different
 * solutions can push different payload shapes through the same endpoint.
 */

import { ApiProperty } from '@nestjs/swagger';
import {
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class WorkflowEventDto {
  @ApiProperty({
    description: 'Stable event id for cross-process dedup. Caller-supplied (live-lesson outbox uses an outbox row id).',
    example: 'evt_018b1d3a-7c2e-4b91-9d3a-ef5c1b8a4d12',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  eventId!: string;

  @ApiProperty({
    description: 'Manifest the stream is declared on.',
    example: 'LessonSession',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  manifestName!: string;

  @ApiProperty({
    description: 'StreamDef.apiName the event belongs to.',
    example: 'events',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  streamApiName!: string;

  @ApiProperty({
    description: 'The entity the event is about (e.g. student id).',
    example: 'student-abc-123',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  entityId!: string;

  @ApiProperty({
    description: 'Event payload — shape determined by the StreamDef.payloadSchema.',
    example: { type: 'student_joined', studentId: 's1', classroomCode: 'HX3KM7' },
  })
  @IsObject()
  payload!: Record<string, unknown>;

  @ApiProperty({
    description: 'Optional correlation id for cross-process tracing.',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  correlationId?: string;
}
