import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? exception.getResponse() : undefined;
    if (!(exception instanceof HttpException)) this.logger.error(exception);

    const details = typeof body === 'object' && body !== null ? body as Record<string, unknown> : {};
    const message = details.message ?? (typeof body === 'string' ? body : 'Error interno del servidor');
    const code = typeof details.code === 'string' ? details.code : `HTTP_${status}`;
    response.status(status).json({ statusCode: status, code, message, path: request.url, timestamp: new Date().toISOString() });
  }
}