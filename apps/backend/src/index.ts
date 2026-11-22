import type { Server } from 'http';
import createApp from './app';
import config from './config/env';
import db from './db/pool';
import { startJobs, stopJobs } from './jobs/cron';
import { alamatPengirim, verifyMailer } from './jobs/mailer';

const app = createApp();
const PORT = config.PORT;

let server: Server | null = null;

const start = async (): Promise<void> => {
  try {
    await db.connect();
    console.log(`✅ Database terhubung: ${config.DB_SERVER}/${config.DB_NAME}`);
  } catch (err) {
    console.error('❌ Gagal terhubung ke database:', err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const smtpSiap = await verifyMailer();
  if (smtpSiap) {
    console.log(`✅ SMTP siap (pengirim: ${alamatPengirim()})`);
  } else {
    console.warn('⚠️ SMTP tidak aktif atau verifikasi gagal; email akan diantrekan.');
  }

  server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT} in ${config.NODE_ENV} mode`);
    startJobs();
  });
};

const gracefulShutdown = async (signal: string): Promise<void> => {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
  stopJobs();

  const tutupPool = async (): Promise<void> => {
    try {
      await db.close();
      console.log('Database connection pool closed.');
      process.exit(0);
    } catch (err) {
      console.error('Error during database pool closure:', err);
      process.exit(1);
    }
  };

  if (!server) {
    await tutupPool();
    return;
  }

  server.close(async () => {
    console.log('HTTP server closed.');
    await tutupPool();
  });

  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => {
  void gracefulShutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void gracefulShutdown('SIGINT');
});

void start();

export default server;
