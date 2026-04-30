import { IsUUID } from 'class-validator';

export class PersonalTouchDto {
  @IsUUID()
  studentId: string;
}
