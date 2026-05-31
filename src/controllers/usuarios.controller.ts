import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { query } from '../config/database';
import { ok, created, notFound, serverError, conflict, badRequest } from '../utils/response';
import { logger } from '../utils/logger';

export const getUsuarios = async (_req: Request, res: Response) => {
  try {
    const r = await query(
      `SELECT u.id_usuario, u.username, u.email, u.rol, u.activo, u.creado_en,
              v.nombres || ' ' || v.apellidos AS veterinario
       FROM usuarios u
       LEFT JOIN veterinarios v ON v.id_veterinario = u.id_veterinario
       ORDER BY u.rol, u.username`,
    );
    ok(res, r.rows);
  } catch (e) { logger.error(e); serverError(res); }
};

export const createUsuario = async (req: Request, res: Response) => {
  const { username, email, password, rol, id_veterinario } = req.body;

  if (!password || password.length < 8) {
    badRequest(res, ['La contraseña debe tener al menos 8 caracteres']);
    return;
  }

  try {
    const dup = await query(
      'SELECT id_usuario FROM usuarios WHERE username=$1 OR email=$2',
      [username, email],
    );
    if (dup.rows.length) { conflict(res, 'Username o email ya registrado'); return; }

    const hash = await bcrypt.hash(password, 10);
    const r = await query(
      `INSERT INTO usuarios (username, email, password_hash, rol, id_veterinario)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id_usuario, username, email, rol, id_veterinario, activo, creado_en`,
      [username, email, hash, rol, id_veterinario ?? null],
    );
    created(res, r.rows[0]);
  } catch (e) { logger.error(e); serverError(res); }
};

export const updateUsuario = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { rol, activo, id_veterinario } = req.body;
  try {
    const r = await query(
      `UPDATE usuarios SET rol=$1, activo=$2, id_veterinario=$3
       WHERE id_usuario=$4
       RETURNING id_usuario, username, email, rol, activo`,
      [rol, activo, id_veterinario ?? null, id],
    );
    if (!r.rows[0]) { notFound(res, 'Usuario no encontrado'); return; }
    ok(res, r.rows[0]);
  } catch (e) { logger.error(e); serverError(res); }
};

export const changePassword = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { new_password } = req.body;

  if (!new_password || new_password.length < 8) {
    badRequest(res, ['La contraseña debe tener al menos 8 caracteres']);
    return;
  }

  try {
    const hash = await bcrypt.hash(new_password, 10);
    const r = await query(
      'UPDATE usuarios SET password_hash=$1 WHERE id_usuario=$2 RETURNING id_usuario',
      [hash, id],
    );
    if (!r.rows[0]) { notFound(res, 'Usuario no encontrado'); return; }
    ok(res, { message: 'Contraseña actualizada' });
  } catch (e) { logger.error(e); serverError(res); }
};

export const deleteUsuario = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    // Verificar que no sea el propio superadmin eliminándose
    const check = await query('SELECT username, rol FROM usuarios WHERE id_usuario = $1', [id]);
    if (!check.rows[0]) { notFound(res, 'Usuario no encontrado'); return; }
    const username = check.rows[0].username;
    await query('DELETE FROM usuarios WHERE id_usuario = $1', [id]);
    ok(res, { message: `Usuario "${username}" eliminado permanentemente` });
  } catch (err) {
    logger.error('deleteUsuario error', err);
    serverError(res);
  }
};
