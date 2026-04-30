import { IsString, IsInt, IsIn, Min, Max, MaxLength } from 'class-validator';

export class AiDiscussDto {
  @IsString()
  studentId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  taskNum: number;

  @IsString()
  @IsIn(['probeReply', 'followUpReply'])
  interactionType: 'probeReply' | 'followUpReply';

  @IsString()
  @MaxLength(2000)
  studentResponse: string;
}
