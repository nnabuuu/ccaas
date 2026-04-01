import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { encrypt, decrypt } from './crypto.util';

interface AuthResult {
  token: string;
  user: { id: string; name: string; username: string; school: string };
  ccaasApiKey: string | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly ccaasUrl: string;
  private readonly ccaasApiKey: string;
  private readonly ccaasTenantId: string;
  private readonly jwtSecret: string;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.ccaasUrl = this.configService.get<string>('CCAAS_URL') || 'http://localhost:3001';
    this.ccaasApiKey = this.configService.get<string>('CCAAS_API_KEY') || '';
    this.ccaasTenantId = this.configService.get<string>('CCAAS_TENANT_ID') || '';
    this.jwtSecret = this.configService.get<string>('JWT_SECRET') || 'edu-platform-dev-secret';
  }

  async register(data: {
    username: string;
    password: string;
    name: string;
    school?: string;
  }): Promise<AuthResult> {
    const existing = this.usersService.findByUsername(data.username);
    if (existing) {
      throw new ConflictException('用户名已存在');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = this.usersService.create({
      username: data.username,
      passwordHash,
      name: data.name,
      school: data.school,
    });

    // Try to create CCAAS user and get API key
    let ccaasApiKeyRaw: string | null = null;
    try {
      ccaasApiKeyRaw = await this.createCcaasUser(user.id, data.username, data.name);
    } catch (err) {
      this.logger.warn(`Failed to create CCAAS user for ${data.username}: ${err.message}`);
    }

    const token = this.signToken(user.id, user.username);
    return {
      token,
      user: { id: user.id, name: user.name, username: user.username, school: user.school },
      ccaasApiKey: ccaasApiKeyRaw,
    };
  }

  async login(username: string, password: string): Promise<AuthResult> {
    const user = this.usersService.findByUsername(username);
    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // Decrypt stored API key
    let ccaasApiKey: string | null = null;
    if (user.ccaas_api_key) {
      try {
        ccaasApiKey = decrypt(user.ccaas_api_key, this.jwtSecret);
      } catch {
        this.logger.warn(`Failed to decrypt CCAAS API key for ${username}`);
      }
    }

    const token = this.signToken(user.id, user.username);
    return {
      token,
      user: { id: user.id, name: user.name, username: user.username, school: user.school },
      ccaasApiKey,
    };
  }

  async getProfile(userId: string) {
    const user = this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }
    return {
      user: { id: user.id, name: user.name, username: user.username, school: user.school },
    };
  }

  private signToken(userId: string, username: string): string {
    return this.jwtService.sign({ sub: userId, username });
  }

  /**
   * Create a CCAAS platform user and return the raw API key.
   * Stores encrypted key + userId back to the users table.
   */
  private async createCcaasUser(
    userId: string,
    username: string,
    name: string,
  ): Promise<string> {
    if (!this.ccaasApiKey) {
      throw new Error('CCAAS_API_KEY not configured');
    }

    const res = await fetch(`${this.ccaasUrl}/api/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.ccaasApiKey}`,
      },
      body: JSON.stringify({
        email: `${username}@edu-platform.local`,
        name,
        tenantId: this.ccaasTenantId || undefined,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`CCAAS user creation failed (${res.status}): ${text}`);
    }

    const body = await res.json();
    const rawKey = body.rawKey;
    const ccaasUserId = body.user?.id || body.id;

    if (!rawKey) {
      throw new Error('CCAAS response missing rawKey');
    }

    // Encrypt and store
    const encryptedKey = encrypt(rawKey, this.jwtSecret);
    this.usersService.updateCcaasInfo(userId, ccaasUserId, encryptedKey);

    return rawKey;
  }
}
