import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { query } from '../config/database';
import { signToken } from '../utils/jwt';
import { Usuario } from '../types';
import { unauthorized, badRequest, serverError } from '../utils/response';
import { logger } from '../utils/logger';

export const login = async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    badRequest(res, ['username y password son requeridos']);
    return;
  }

  try {
    const result = await query<Usuario>(
      `SELECT id_usuario, username, email, password_hash, rol, id_veterinario, activo
       FROM usuarios WHERE username = $1 OR email = $1 LIMIT 1`,
      [username],
    );

    const user = result.rows[0];
    if (!user || !user.activo) {
      unauthorized(res, 'Credenciales inválidas');
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      unauthorized(res, 'Credenciales inválidas');
      return;
    }

    const token = signToken({
      sub:      user.id_usuario,
      username: user.username,
      rol:      user.rol,
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id:             user.id_usuario,
          username:       user.username,
          email:          user.email,
          rol:            user.rol,
          id_veterinario: user.id_veterinario,
        },
      },
    });
  } catch (err) {
    logger.error('login error', err);
    serverError(res);
  }
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  // req.user viene del middleware authenticate
  const { user } = req as typeof req & { user: { sub: number } };

  try {
    const result = await query(
      `SELECT u.id_usuario, u.username, u.email, u.rol, u.id_veterinario,
              v.nombres || ' ' || v.apellidos AS nombre_veterinario
       FROM usuarios u
       LEFT JOIN veterinarios v ON v.id_veterinario = u.id_veterinario
       WHERE u.id_usuario = $1`,
      [user.sub],
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    logger.error('getMe error', err);
    serverError(res);
  }
};
