import { IsString, IsInt, IsIn, IsOptional, IsArray, Min, Max, MaxLength, Matches, ArrayMaxSize, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

class DiscussMessageDto {
  @IsString()
  @IsIn(['ai', 'student'])
  role: 'ai' | 'student';

  @IsString()
  @MaxLength(5000)
  text: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @MaxLength(200_000, { each: true })
  @Matches(/^data:image\/(jpeg|png|webp|gif);base64,/, { each: true, message: 'Each image must be a base64 data URL' })
  images?: string[];
}

export class AiDiscussDto {
  @IsString()
  studentId: string;

  @IsInt()
  @Min(1)
  @Max(20)
  taskNum: number;

  @ValidateNested({ each: true })
  @Type(() => DiscussMessageDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  messages: DiscussMessageDto[];

  @IsInt()
  @Min(0)
  round: number;

  @IsInt()
  @Min(0)
  timeUsedSeconds: number;
}

export class DiscussCompleteDto {
  @IsString()
  studentId: string;

  @IsInt()
  @Min(1)
  @Max(20)
  taskNum: number;

  @IsString()
  @IsIn(['goal_reached', 'fallback_rounds', 'fallback_time'])
  completionType: 'goal_reached' | 'fallback_rounds' | 'fallback_time';

  @IsInt()
  @Min(0)
  roundsUsed: number;

  @IsInt()
  @Min(0)
  timeUsedSeconds: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  mcSelectedIndex?: number;
}
