import { pool } from '../server/db.js';

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_token (
      ID_REINICIO bigint unsigned NOT NULL AUTO_INCREMENT,
      ID_USUARIO bigint unsigned NOT NULL,
      TOKEN_HASH char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      EXPIRA_EN datetime(3) NOT NULL,
      USADO_EN datetime(3) DEFAULT NULL,
      CREADO_EN datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (ID_REINICIO),
      UNIQUE KEY UQ_RESET_TOKEN_HASH (TOKEN_HASH),
      KEY IDX_RESET_USUARIO_CREADO (ID_USUARIO, CREADO_EN),
      KEY IDX_RESET_EXPIRA (EXPIRA_EN),
      CONSTRAINT FK_RESET_USUARIO FOREIGN KEY (ID_USUARIO)
        REFERENCES usuario (ID_USUARIO) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);
  console.log('Tabla password_reset_token lista.');
} catch (error) {
  console.error('No se pudo preparar la tabla password_reset_token:', error.code || error.name);
  process.exitCode = 1;
} finally {
  await pool.end();
}
