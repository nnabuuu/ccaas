import { IsString, IsArray, ArrayMinSize } from 'class-validator';

export class CreateBatchJobDto {
  @IsString()
  name: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  quiz_ids: string[];
}
