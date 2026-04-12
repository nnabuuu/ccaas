import { IsArray, ValidateNested, IsString, IsNumber, IsOptional, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class BlockItemDto {
  @IsString()
  type: string;

  @IsObject()
  content: Record<string, any>;

  @IsNumber()
  sort_order: number;
}

export class UpdateBlocksDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlockItemDto)
  blocks: BlockItemDto[];
}
