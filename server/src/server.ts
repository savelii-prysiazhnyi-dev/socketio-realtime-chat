import 'dotenv/config';
import { createServer } from 'http';
import { Server } from 'socket.io';
import buildApp from './app.js';
import { logger } from './utils/logger.js';
import { getCorsSettings } from './utils/cors.js';
import { getJwtSecret } from './utils/jwt.js';
import { prisma } from './utils/prisma.js';
import { setupWebsocket } from './ws/index.js';
import { getWsMaxPayloadBytes } from './ws/rateLimiter.js';

const PORT = Number(process.env.PORT) || 3000;

const app = buildApp();
const httpServer = createServer(app);

const corsSettings = getCorsSettings();
export const io = new Server(httpServer, {
  cors: corsSettings,
  maxHttpBufferSize: getWsMaxPayloadBytes(),
});

setupWebsocket(io);

const start = async (): Promise<void> => {
  try {
    getJwtSecret();
    await prisma.$connect();
    logger.info('Database connected successfully');

    httpServer.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  }
};

let isShuttingDown = false;

const shutdown = async (signal: string): Promise<void> => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  const forceExitTimeout = setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 10000);
  forceExitTimeout.unref();

  try {
    httpServer.closeIdleConnections?.();

    await new Promise<void>((resolve, reject) => {
      io.close(err => {
        if (err) return reject(err);
        resolve();
      });
    });
    logger.info('HTTP and Socket.IO servers closed cleanly');

    await prisma.$disconnect();
    logger.info('Database disconnected cleanly');

    clearTimeout(forceExitTimeout);
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during graceful shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();
