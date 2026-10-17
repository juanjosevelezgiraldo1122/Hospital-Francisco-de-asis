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
      ...(process.env.DB_SSL_CA
        ? { ssl: { ca: process.env.DB_SSL_CA.replace(/\\n/g, '\n'), rejectUnauthorized: true } }
        : process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: true } } : {}),
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
  const requiredTables = [
    'usuario', 'rol', 'paciente', 'medico', 'secretaria', 'cita', 'historial_clinico',
    'especialidad', 'sede', 'medicamento', 'prescripcion', 'inventario_medicamento',
    'solicitud_envio', 'detalle_solicitud', 'movimiento_inventario', 'historial_estado_envio',
    'identidad_proveedor', 'password_reset_token', 'app_session', 'sync_event',
  ];
  const [tableRows] = await pool.execute(
    `SELECT TABLE_NAME FROM information_schema.tables
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${requiredTables.map(() => '?').join(', ')})`,
    requiredTables,
  );
  const existingTables = new Set(tableRows.map(({ TABLE_NAME }) => TABLE_NAME.toLowerCase()));
  const missingTables = requiredTables.filter((table) => !existingTables.has(table));
  const requiredColumns = [
    ['usuario', 'USUARIO_LOGIN'],
    ['usuario', 'DIRECCION_TIPO_VIA'],
    ['usuario', 'DIRECCION_NUMERO_VIA'],
    ['usuario', 'BARRIO'],
    ['usuario', 'MUNICIPIO'],
    ['solicitud_envio', 'EMAIL_CONTACTO'],
    ['solicitud_envio', 'NOTAS_ENTREGA'],
    ['password_reset_token', 'TOKEN_HASH'],
    ['password_reset_token', 'EXPIRA_EN'],
    ['password_reset_token', 'USADO_EN'],
  ];
  const [columnRows] = await pool.execute(
    `SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.columns
     WHERE TABLE_SCHEMA = DATABASE() AND (${requiredColumns.map(() => '(TABLE_NAME = ? AND COLUMN_NAME = ?)').join(' OR ')})`,
    requiredColumns.flat(),
  );
  const existingColumns = new Set(columnRows.map(({ TABLE_NAME, COLUMN_NAME }) => `${TABLE_NAME.toLowerCase()}.${COLUMN_NAME.toLowerCase()}`));
  const missingColumns = requiredColumns
    .map(([table, column]) => `${table}.${column}`)
    .filter((column) => !existingColumns.has(column.toLowerCase()));

  return {
    ...rows[0],
    schemaReady: missingTables.length === 0 && missingColumns.length === 0,
    missingTables,
    missingColumns,
  };
}
