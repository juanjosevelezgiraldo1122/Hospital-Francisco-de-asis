import mysql from 'mysql2/promise';

const requiredConfig = ['DB_HOST', 'DB_NAME', 'DB_USER'];
const missingConfig = requiredConfig.filter((name) => !process.env[name]);

export const databaseConfigured = missingConfig.length === 0 && Boolean(process.env.DB_PASSWORD);

export const pool = databaseConfigured
  ? mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      charset: 'utf8mb4',
      enableKeepAlive: true,
    })
  : null;

export async function checkDatabaseConnection() {
  if (!pool) throw new Error('MySQL no esta configurado.');
  const [rows] = await pool.query('SELECT DATABASE() AS databaseName, VERSION() AS serverVersion');
  return rows[0];
}
