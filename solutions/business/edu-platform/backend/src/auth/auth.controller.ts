import { Controller, Post, Body } from '@nestjs/common';
import { IsString, MinLength, MaxLength, Matches, IsOptional } from 'class-validator';
import { AuthService } from './auth.service';

class LoginDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  username: string;

  @IsString()
  @MinLength(1)
  password: string;
}

class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_\-]+$/, { message: '用户名只能包含字母、数字、下划线和连字符' })
  username: string;

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password: string;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  school?: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.username, dto.password);
  }

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register({
      username: dto.username,
      password: dto.password,
      name: dto.name,
      school: dto.school,
    });
  }
}
