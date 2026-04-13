import { IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class RequirementSnapshotDto {
  @IsString()
  code: string;

  @IsString()
  text: string;

  @IsString()
  version: string;
}

export class LinkRequirementDto {
  @IsString()
  requirement_id: string;

  @ValidateNested()
  @Type(() => RequirementSnapshotDto)
  requirement_snapshot: RequirementSnapshotDto;
}
