// apps/agent/src/lib/logger.ts
//
// Pino logger with secret redaction.
// CLAUDE.md security: never log keys, never log raw card data.

import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  redact: {
    paths: [
      // Common secret env names + headers + JSON body fields
      '*.api_key',
      '*.apiKey',
      '*.secret',
      '*.password',
      '*.token',
      '*.access_token',
      '*.refresh_token',
      '*.authorization',
      '*.card',
      '*.cardNumber',
      '*.cvv',
      'req.headers.authorization',
      'req.headers["x-paystack-signature"]',
      'req.headers["apikey"]',
    ],
    censor: '[redacted]',
  },
  base: {
    service: 'operscale-calendar-agent',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
