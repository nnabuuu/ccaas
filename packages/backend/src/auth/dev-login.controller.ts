import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from './decorators';
import { DevLoginService } from './dev-login.service';

export class DevLoginDto {
  @ApiProperty({ description: 'Username' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  username: string;

  @ApiProperty({ description: 'Password' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;
}

@ApiTags('auth')
@Controller('api/v1/auth')
export class DevLoginController {
  constructor(private readonly devLoginService: DevLoginService) {}

  @Public()
  @Post('login')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Dev credential login (non-production)' })
  async login(@Body() body: DevLoginDto) {
    return this.devLoginService.login(body.username, body.password);
  }
}
