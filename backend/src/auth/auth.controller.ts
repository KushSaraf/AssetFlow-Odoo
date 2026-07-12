import { Controller, Post, Body, Get, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('signup')
  signup(@Body() body: any) {
    return this.authService.signup(body);
  }

  @Public()
  @Post('login')
  login(@Body() body: any) {
    return this.authService.login(body);
  }

  @Public()
  @Post('forgot-password')
  forgotPassword(@Body() body: any) {
    return this.authService.forgotPassword(body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Req() req: any) {
    return req.user;
  }
}
