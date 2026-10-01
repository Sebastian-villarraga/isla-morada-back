type OriginCallback = (error: Error | null, allow?: boolean) => void;

export function createCorsOptions(frontendUrl?: string, nodeEnv = 'development') {
  const origins = (frontendUrl ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedOrigins = new Set(origins);
  const isProduction = nodeEnv === 'production';

  if (isProduction && allowedOrigins.has('*')) {
    throw new Error('FRONTEND_URL no puede incluir * en producción');
  }

  return {
    credentials: true,
    origin(origin: string | undefined, callback: OriginCallback): void {
      if (!origin || allowedOrigins.has(origin) || (!isProduction && allowedOrigins.has('*'))) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
  };
}