import {
  IsString,
  IsOptional,
  IsNotEmpty,
  Matches,
  IsIn,
  IsArray,
  ArrayMaxSize,
  MaxLength,
} from 'class-validator';

// Conservative bound: any plausible curriculum has <10 subjects in scope
// for a single project; 32 leaves headroom without enabling abuse (a
// 10k-element array would still pass the L1 catalog check via Set.has,
// but ties up CPU + bloats the DB row).
const SUBJECTS_MAX = 32;
// Subject keys today are short ASCII slugs ("english", "math"). 64 is
// well above need and keeps a length-DoS impossible.
const SUBJECT_KEY_MAX = 64;

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  // Teaching-requirement subjects this project covers. Each element must
  // be a subject loaded by TeachingRequirementsService (validator runs
  // server-side in ProjectService — unknown subjects throw 400 with the
  // list of valid ones). Empty/omitted = no `_lib/` materialization.
  @IsArray()
  @ArrayMaxSize(SUBJECTS_MAX)
  @IsString({ each: true })
  @MaxLength(SUBJECT_KEY_MAX, { each: true })
  @IsOptional()
  subjects?: string[];
}

export class UpdateProjectDto {
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @ArrayMaxSize(SUBJECTS_MAX)
  @IsString({ each: true })
  @MaxLength(SUBJECT_KEY_MAX, { each: true })
  @IsOptional()
  subjects?: string[];
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
