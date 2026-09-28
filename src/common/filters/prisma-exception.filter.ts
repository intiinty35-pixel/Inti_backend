import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../../generated/prisma/client';

/**
 * Nest no incluye el mensaje de las excepciones de Prisma en la respuesta HTTP:
 * el cliente solo ve un 500 genérico y el log apunta al guard. Este filtro traduce
 * los fallos de conexión a un 503 con un mensaje accionable.
 */
@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientInitializationError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: { code?: string; message: string }, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const code = exception.code ?? '';
    const isConnectionIssue =
      code === 'P1001' ||
      code === 'P1002' ||
      code === 'P1017' ||
      exception.message.includes('DatabaseNotReachable');

    if (isConnectionIssue) {
      this.logger.error(
        `Base de datos inalcanzable (${code || 'sin código'}). Revisa la red o el estado del pooler.`,
      );
      response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message:
          'No pudimos conectar con la base de datos. Verifica tu conexión e inténtalo de nuevo.',
        error: 'Service Unavailable',
      });
      return;
    }

    // Cualquier otro error de Prisma se registra y se devuelve como 500 genérico
    // para no exponer detalles internos del esquema.
    this.logger.error(`Error de Prisma (${code || 'sin código'}): ${exception.message}`);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Ocurrió un error inesperado.',
      error: 'Internal Server Error',
    });
  }
}