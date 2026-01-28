import { Elysia } from 'elysia';
import { ERROR_CODES, type ErrorCode } from '@airshare/shared';

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number = 400,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    return new AppError(code, message, 400, details);
  }

  static unauthorized(message = 'Unauthorized') {
    return new AppError(ERROR_CODES.UNAUTHORIZED, message, 401);
  }

  static forbidden(message = 'Forbidden') {
    return new AppError(ERROR_CODES.FORBIDDEN, message, 403);
  }

  static notFound(code: ErrorCode, message: string) {
    return new AppError(code, message, 404);
  }

  static tooManyRequests(message = 'Too many requests') {
    return new AppError(ERROR_CODES.RATE_LIMITED, message, 429);
  }

  static internal(message = 'Internal server error') {
    return new AppError(ERROR_CODES.INTERNAL_ERROR, message, 500);
  }
}

export const errorHandler = new Elysia({ name: 'error-handler' })
  .onError(({ error, set }) => {
    console.error('[Error]', error);

    if (error instanceof AppError) {
      set.status = error.statusCode;
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      };
    }

    // Validation errors from Elysia
    if (error.name === 'ValidationError' || (error as { code?: string }).code === 'VALIDATION') {
      set.status = 400;
      return {
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Validation failed',
          details: error.message,
        },
      };
    }

    // MongoDB duplicate key error
    if ((error as { code?: number }).code === 11000) {
      set.status = 409;
      return {
        success: false,
        error: {
          code: 'DUPLICATE_KEY',
          message: 'Resource already exists',
        },
      };
    }

    // Default error
    set.status = 500;
    return {
      success: false,
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'Internal server error',
      },
    };
  });
