import { IsString, IsOptional, IsNotEmpty, Matches, IsIn } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class CreateFileDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9_\-][a-zA-Z0-9_\-/. ]*$/, {
    message: 'path must be a relative path without .. segments',
  })
  path: string;

  @IsString()
  content: string;

  @IsString()
  @IsOptional()
  @IsIn(['json', 'md', 'txt', 'yaml'])
  fileType?: string;
}

export class UpdateFileDto {
  @IsString()
  content: string;
}
