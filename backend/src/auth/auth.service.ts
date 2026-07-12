import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async signup(data: any) {
    // 1. Ignore any client-sent role, always Employee.
    const { name, email, password } = data;

    // Check if email already exists
    const existing = await this.prisma.employee.findUnique({
      where: { email },
    });
    if (existing) {
      throw new ConflictException({
        error: {
          code: 'validation_error',
          message: 'Email already exists',
          field: 'email',
        },
      });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const user = await this.prisma.employee.create({
      data: {
        name,
        email,
        password_hash,
        role: 'Employee', // Forced server-side
      },
    });

    const payload = { sub: user.id, role: user.role };
    return {
      token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department_id: user.department_id,
        status: user.status,
      },
    };
  }

  async login(data: any) {
    const { email, password } = data;
    const user = await this.prisma.employee.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException({
        error: {
          code: 'validation_error',
          message: 'Invalid email or password',
        },
      });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw new UnauthorizedException({
        error: {
          code: 'validation_error',
          message: 'Invalid email or password',
        },
      });
    }

    if (user.status !== 'Active') {
      throw new UnauthorizedException({
        error: { code: 'validation_error', message: 'Account is inactive' },
      });
    }

    const payload = { sub: user.id, role: user.role };
    return {
      token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department_id: user.department_id,
        status: user.status,
      },
    };
  }

  async forgotPassword(data: any) {
    // Generic response per spec
    return {
      message:
        'If that email address is in our database, we will send you an email to reset your password.',
    };
  }
}
