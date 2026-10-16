import { pool } from '../server/db.js';

const addressColumns = [
  ['DIRECCION_TIPO_VIA', 'VARCHAR(20) NULL'],
  ['DIRECCION_NUMERO_VIA', 'VARCHAR(8) NULL'],
  ['DIRECCION_LETRA_VIA', 'VARCHAR(4) NULL'],
  ['DIRECCION_BIS', 'TINYINT(1) NOT NULL DEFAULT 0'],
  ['DIRECCION_CUADRANTE_VIA', 'VARCHAR(2) NULL'],
  ['DIRECCION_NUMERO_CRUCE', 'VARCHAR(8) NULL'],
  ['DIRECCION_LETRA_CRUCE', 'VARCHAR(4) NULL'],
  ['DIRECCION_CUADRANTE_CRUCE', 'VARCHAR(2) NULL'],
  ['DIRECCION_NUMERO_PLACA', 'VARCHAR(8) NULL'],
  ['DIRECCION_COMPLEMENTO', 'VARCHAR(120) NULL'],
  ['BARRIO', 'VARCHAR(100) NULL'],
  ['MUNICIPIO', 'VARCHAR(100) NULL'],
  ['DEPARTAMENTO', 'VARCHAR(100) NULL'],
];

if (!pool) {
  console.error('MySQL no está configurado. Revisa .env.local y .env.mysql.local.');
  process.exitCode = 1;
} else {
  try {
    const [existing] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = ? AND COLUMN_NAME IN (${addressColumns.map(() => '?').join(', ')})`,
      ['usuario', ...addressColumns.map(([name]) => name)],
    );
    const existingNames = new Set(existing.map((column) => column.COLUMN_NAME));
    const missing = addressColumns.filter(([name]) => !existingNames.has(name));
    if (missing.length) {
      await pool.query(`ALTER TABLE usuario ${missing.map(([name, definition]) => `ADD COLUMN ${name} ${definition}`).join(', ')}`);
    }
    console.log(missing.length ? 'Dirección colombiana agregada al esquema de usuario.' : 'El esquema ya tiene los campos de dirección colombiana.');
  } catch (error) {
    console.error(`No se pudo aplicar la migración: ${error.code || error.message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
