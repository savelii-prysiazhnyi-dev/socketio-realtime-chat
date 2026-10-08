import pino from 'pino';

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';
const isTest = nodeEnv === 'test';
const level = isTest ? 'silent' : isProduction ? 'info' : 'debug';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? level,
  ...(isProduction || isTest
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }),
});

export type Logger = typeof logger;
