import {
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(crypto.scrypt) as (
  password: crypto.BinaryLike,
  salt: crypto.BinaryLike,
  keylen: number,
  options: crypto.ScryptOptions,
) => Promise<Buffer>;
import { User } from '../users/entities/user.entity';
import { ApiKeyService } from './api-key.service';
import { TenantsService } from '../tenants/tenants.service';
import { UserTenantService } from '../users/user-tenant.service';

const SCRYPT_KEYLEN = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const SESSION_KEY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

@Injectable()
export class DevLoginService implements OnModuleInit {
  private readonly logger = new Logger(DevLoginService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly apiKeyService: ApiKeyService,
    private readonly tenantsService: TenantsService,
    private readonly userTenantService: UserTenantService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    try {
      await this.seedDevUser();
    } catch (err) {
      this.logger.error('Failed to seed dev login user — dev login will not work', err);
    }
  }

  private async seedDevUser() {
    const devUsers = [
      {
        username: this.configService.get<string>('DEV_LOGIN_USERNAME') || 'admin',
        password: this.configService.get<string>('DEV_LOGIN_PASSWORD') || 'dev123',
        email: this.configService.get<string>('ADMIN_EMAIL') || 'admin@localhost',
        name: 'Dev Admin',
        role: 'admin' as const,
      },
      {
        username: 'demo',
        password: 'Demo123',
        email: 'demo@localhost',
        name: 'Demo User',
        role: 'admin' as const,
      },
    ];

    const tenantId = await this.resolveDefaultTenantId();
    const seeded: string[] = [];

    for (const spec of devUsers) {
      const user = await this.ensureUser(spec);
      await this.ensureUserTenant(user.id, tenantId, spec.role);
      seeded.push(spec.username);
    }

    this.logger.log('='.repeat(60));
    this.logger.log(`DEV LOGIN users: ${seeded.join(', ')} (passwords set via env or default)`);
    this.logger.log('='.repeat(60));
  }

  private async ensureUser(spec: {
    username: string;
    password: string;
    email: string;
    name: string;
  }): Promise<User> {
    let user = await this.userRepo.findOne({ where: { username: spec.username } });

    if (!user) {
      // Check if a user with the same email already exists
      user = await this.userRepo.findOne({ where: { email: spec.email } });
      if (user) {
        user.username = spec.username;
        user.passwordHash = await this.hashPassword(spec.password);
        await this.userRepo.save(user);
      } else {
        user = this.userRepo.create({
          email: spec.email,
          name: spec.name,
          username: spec.username,
          passwordHash: await this.hashPassword(spec.password),
          status: 'active',
        });
        await this.userRepo.save(user);
      }
    } else {
      // Only re-hash if password actually changed
      const currentHash = await this.userRepo
        .createQueryBuilder('user')
        .select('user.passwordHash')
        .where('user.id = :id', { id: user.id })
        .getOne();

      if (!currentHash?.passwordHash || !(await this.verifyPassword(spec.password, currentHash.passwordHash))) {
        user.passwordHash = await this.hashPassword(spec.password);
        await this.userRepo.save(user);
        this.logger.log(`Dev user "${spec.username}" password updated`);
      }
    }

    return user;
  }

  private async ensureUserTenant(userId: string, tenantId: string, role: 'admin' | 'developer' | 'viewer') {
    const userTenant = await this.userTenantService.findUserInTenant(userId, tenantId);
    if (!userTenant) {
      await this.userTenantService.create({ userId, tenantId, role });
    }
  }

  async login(username: string, password: string): Promise<{ apiKey: string; user: { id: string; username: string; name: string } }> {
    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.username = :username', { username })
      .getOne();

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid username or password');
    }

    if (!(await this.verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid username or password');
    }

    // Create a session API key with 24h expiry
    const tenantId = await this.resolveDefaultTenantId();
    const { rawKey } = await this.apiKeyService.create(tenantId, {
      name: 'Dev login session',
      scopes: ['admin'],
      userId: user.id,
      expiresAt: new Date(Date.now() + SESSION_KEY_TTL_MS),
    });

    return {
      apiKey: rawKey,
      user: {
        id: user.id,
        username: user.username!,
        name: user.name,
      },
    };
  }

  private async resolveDefaultTenantId(): Promise<string> {
    const idOrSlug = this.tenantsService.getDefaultTenantId();
    const tenant = await this.tenantsService.findOne(idOrSlug);
    if (!tenant) {
      throw new Error(`Default tenant not found: ${idOrSlug}`);
    }
    return tenant.id;
  }

  async hashPassword(password: string): Promise<string> {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = (await scryptAsync(password, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS)).toString('hex');
    return `scrypt:${salt}:${hash}`;
  }

  async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    const parts = storedHash.split(':');
    if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
    const [, salt, hash] = parts;
    if (!salt || !hash) return false;
    const derived = await scryptAsync(password, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS);
    const expected = Buffer.from(hash, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  }
}
