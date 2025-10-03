import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RequestWithAuth } from './auth.types';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: RequestWithAuth = context.switchToHttp().getRequest();
    const token = request.cookies['auth_token'];

    if (!token) throw new UnauthorizedException('No token provided');

    try {
      const payload = await this.jwtService.verifyAsync(token);

      request.address = payload.address;
      request.network = payload.network;
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    return true;
  }

  private extractTokenFromHeader(request: RequestWithAuth): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    return authHeader.split(' ')[1];
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: RequestWithAuth = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) throw new UnauthorizedException('No token provided');

    const adminKey = this.configService.get<string>('ADMIN_KEY');

    if (!adminKey) {
      throw new ForbiddenException('Admin key not configured on server');
    }

    if (token !== adminKey) {
      throw new ForbiddenException('Invalid admin token');
    }

    return true;
  }

  private extractTokenFromHeader(request: RequestWithAuth): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    return authHeader.split(' ')[1];
  }
}
