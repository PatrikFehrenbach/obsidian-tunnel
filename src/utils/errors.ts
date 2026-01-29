export class ObsidianAPIError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public endpoint?: string
  ) {
    super(message);
    this.name = 'ObsidianAPIError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export function formatErrorResponse(error: unknown, endpoint?: string) {
  if (error instanceof ObsidianAPIError) {
    return {
      error: error.name,
      status: error.statusCode,
      message: error.message,
      endpoint: error.endpoint || endpoint
    };
  }

  if (error instanceof Error) {
    return {
      error: error.name,
      status: 500,
      message: error.message,
      endpoint
    };
  }

  return {
    error: 'UnknownError',
    status: 500,
    message: String(error),
    endpoint
  };
}
