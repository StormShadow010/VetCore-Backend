import 'dotenv/config';
import app from './app';
import pool from './config/database';
import { logger } from './utils/logger';

const PORT = Number(process.env.PORT ?? 3000);

const start = async () => {
  // Verificar conexión a la BD
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    logger.info('✅ Conexión a PostgreSQL establecida');
  } catch (err) {
    logger.error('❌ No se pudo conectar a PostgreSQL', err);
    process.exit(1);
  }

  app.listen(PORT, () => {
    logger.info(`🚀 VetCore API corriendo en puerto ${PORT} [${process.env.NODE_ENV}]`);
  });
};

start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM recibido. Cerrando servidor...');
  await pool.end();
  process.exit(0);
});
