import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'super-secret',
    });
  }

  async validate(payload: any) {
    const user = await this.prisma.employee.findUnique({
      where: { id: payload.sub },
    });
    if (!user || user.status !== 'Active') {
      throw new UnauthorizedException({
        error: {
          code: 'validation_error',
          message: 'Account not found or inactive',
        },
      });
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      department_id: user.department_id,
      status: user.status,
    };
  }
}
