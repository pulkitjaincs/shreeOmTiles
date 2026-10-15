import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { Role } from '@prisma/client';

export interface ValidatedUserClaim {
  id: string;
  name: string;
  phone: string;
  role: Role;
  scope: string | null;
}

interface CachedClaimEntry {
  user: ValidatedUserClaim;
  expiresAt: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly claimCache = new Map<string, CachedClaimEntry>();
  private readonly CACHE_TTL_MS = 60_000; // 60 seconds
  private readonly MAX_CACHE_SIZE = 500; // Safe memory boundary for Render 512MB RAM

  constructor(
    private usersService: UsersService,
    private configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_SECRET') ||
        'shree-om-tiles-secure-jwt-secret-key-2026',
    });
  }

  async validate(payload: { sub: string }): Promise<ValidatedUserClaim> {
    const now = Date.now();
    const cached = this.claimCache.get(payload.sub);
    if (cached && cached.expiresAt > now) {
      return cached.user;
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      this.claimCache.delete(payload.sub);
      throw new UnauthorizedException('User account is inactive or not found');
    }

    const validatedUser: ValidatedUserClaim = {
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      scope: user.scope,
    };

    // Keep cache bounded within memory budget
    if (this.claimCache.size >= this.MAX_CACHE_SIZE) {
      for (const [key, item] of this.claimCache.entries()) {
        if (item.expiresAt <= now) {
          this.claimCache.delete(key);
        }
      }
      if (this.claimCache.size >= this.MAX_CACHE_SIZE) {
        this.claimCache.clear();
      }
    }

    this.claimCache.set(payload.sub, {
      user: validatedUser,
      expiresAt: now + this.CACHE_TTL_MS,
    });

    return validatedUser;
  }
}
