/**
 * DTOs for `PUT /api/v1/workflow/sessions/:sessionId/indicators`.
 *
 * Minimal class-validator shape matching the existing event-ingest
 * pattern. Phase 5 M5.3a — a solution-side worker pushes the
 * session's indicator catalog so platform LLM-driven handlers can
 * classify chat turns / observations against the right anchor set.
 * Indicator `type` is free-form (the platform does not enforce a
 * taxonomy); solutions register their own (e.g. `knowledge` /
 * `misconception` / `process` / etc.) and the LLM prompt is
 * solution-supplied.
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
  @ApiProperty({ description: 'Indicator id (anchor token). Solution-defined; opaque to the platform.' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  id!: string;

  @ApiProperty({ description: 'Free-form indicator type. Solutions register their own taxonomy.' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  type!: string;

  @ApiProperty({ description: 'Short human-readable label for the indicator.' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label!: string;

  @ApiProperty({ description: 'Longer description; solution LLM handlers can show it in the classifier prompt.' })
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
