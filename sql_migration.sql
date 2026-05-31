-- ═══════════════════════════════════════════════════════════════
--  MIGRACIÓN VETCORE — Ejecutar UNA VEZ en TablePlus
--  Antes de reiniciar el backend
-- ═══════════════════════════════════════════════════════════════

-- 1. Agregar columna activo a propietarios (si no existe)
ALTER TABLE propietarios ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Verificar
SELECT 'propietarios.activo existe:' AS check, COUNT(*) FROM propietarios;
SELECT id_propietario, nombres, apellidos, activo FROM propietarios LIMIT 5;

-- ═══════════════════════════════════════════════════════════════
--  ACTUALIZAR CONTRASEÑAS DE DEMO
--  Hash de bcrypt correspondiente a la contraseña "password"
-- ═══════════════════════════════════════════════════════════════
UPDATE usuarios
SET password_hash = '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'
WHERE username IN ('superadmin', 'admin', 'dr_ana', 'usuario', 'consulta');

SELECT username, rol, activo FROM usuarios ORDER BY rol;
