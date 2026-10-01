import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class PublicRateLimitMiddleware implements NestMiddleware {
  private readonly requests = new Map<string, { count: number; expiresAt: number }>();

  use(request: Request, response: Response, next: NextFunction): void {
    const key = `${request.ip ?? 'unknown'}:${request.path}`;
    const now = Date.now();
    const current = this.requests.get(key);
    if (!current || current.expiresAt <= now) {
      this.requests.set(key, { count: 1, expiresAt: now + 60_000 });
      if (this.requests.size > 2048) {
        for (const [requestKey, value] of this.requests) {
          if (value.expiresAt <= now) this.requests.delete(requestKey);
        }
      }
      next();
      return;
    }
    const limit = request.path === '/auth/login' ? 10 : 60;
    if (current.count >= limit) {
      response.status(429).json({ statusCode: 429, code: 'RATE_LIMITED', message: 'Demasiadas solicitudes.' });
      return;
    }
    current.count += 1;
    next();
  }
}