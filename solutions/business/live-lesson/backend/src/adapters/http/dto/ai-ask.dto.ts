import { IsString, IsInt, Min, Max, MaxLength, IsOptional, IsArray, IsIn, ArrayMaxSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ChatMsgDto {
  @IsString()
  @IsIn(['student', 'ai'])
  role: 'student' | 'ai';

  @IsString()
  @MaxLength(10000)
  text: string;
}

export class AiAskDto {
  @IsString()
  studentId: string;

  @IsString()
  @MaxLength(10000)
  question: string;

  @IsInt()
  @Min(0)
  @Max(100)
  step: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ChatMsgDto)
  messages?: ChatMsgDto[];
}
