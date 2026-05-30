/**
 * DTOs for `PUT /api/v1/workflow/sessions/:sessionId/indicators`.
 *
 * Minimal class-validator shape matching the existing event-ingest
 * pattern. Phase 5 M5.3a — live-lesson backend pushes the lesson
 * manifest's indicator catalog so platform M4 LLM handlers can
 * classify chat turns against the right anchor set.
 */

import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class IndicatorDefDto {
  @ApiProperty({ description: 'Indicator id (anchor token). Typically `K1`/`M2`/etc.' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  id!: string;

  @ApiProperty({ description: 'Free-form indicator type — `knowledge` / `misconception` / etc.' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  type!: string;

  @ApiProperty({ description: 'Short human-readable label for the indicator.' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label!: string;

  @ApiProperty({ description: 'Longer description shown in LLM classifier prompt.' })
  @IsString()
  @MaxLength(1000)
  description!: string;
}

export class PutIndicatorsDto {
  @ApiProperty({
    description: 'Replace-on-write indicator catalog for the session. Empty list clears.',
    type: () => [IndicatorDefDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IndicatorDefDto)
  indicators!: IndicatorDefDto[];
}
