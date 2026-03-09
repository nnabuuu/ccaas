/**
 * Skill File DTOs
 */

import { IsString, IsArray, MaxLength, Matches, ValidateNested, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for upserting a skill file.
 * relativePath must be a safe relative path — no "..", no leading "/".
 */
export class UpsertSkillFileDto {
  @IsString()
  @MaxLength(500)
  @Matches(/^(?!.*\.\.)[\w\-\.\/]+$/, {
    message:
      'relativePath must not contain ".." and only use alphanumeric, _, -, ., / characters',
  })
  relativePath: string;

  @IsString()
  @MaxLength(1048576) // 1MB limit
  content: string;
}

/**
 * Batch upsert request (max 100 files per call)
 */
export class UpsertSkillFilesDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => UpsertSkillFileDto)
  files: UpsertSkillFileDto[];
}
