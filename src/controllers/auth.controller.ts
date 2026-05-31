import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { query, getClient } from '../config/database';
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

export const register = async (req: Request, res: Response): Promise<void> => {
  const { username, email, password, nombres, apellidos, telefono, ciudad } = req.body as {
    username?: string; email?: string; password?: string;
    nombres?: string; apellidos?: string; telefono?: string; ciudad?: string;
  };

  if (!username || !password || !email) {
    badRequest(res, ['Usuario, email y contraseña son obligatorios']);
    return;
  }
  // nombres y apellidos son opcionales — si no vienen usamos el username
  const propNombres = nombres?.trim() || username;
  const propApellidos = apellidos?.trim() || '';

  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Verificar duplicados
    const dup = await client.query(
      'SELECT id_usuario FROM usuarios WHERE username = $1 OR (email IS NOT NULL AND email = $2)',
      [username, email],
    );
    if (dup.rows.length) {
      await client.query('ROLLBACK');
      badRequest(res, ['El nombre de usuario o correo ya está registrado']);
      return;
    }

    const hash = await bcrypt.hash(password, 10);

    // 1. Crear usuario con rol USUARIO
    const r = await client.query(
      `INSERT INTO usuarios (username, email, password_hash, rol, activo)
       VALUES ($1, $2, $3, 'USUARIO', true)
       RETURNING id_usuario, username, email, rol, activo`,
      [username, email, hash],
    );

    // 2. Crear propietario vinculado por email
    // Verificar si ya existe propietario con ese email
    const existeProp = await client.query(
      'SELECT id_propietario FROM propietarios WHERE email = $1', [email]
    );
    if (!existeProp.rows.length) {
      // Generar cédula temporal única (puede actualizarse después)
      const cedulaTemp = `USR${Date.now()}`.slice(0, 20);
      await client.query(
        `INSERT INTO propietarios (cedula, nombres, apellidos, email, telefono, ciudad, activo)
         VALUES ($1, $2, $3, $4, $5, $6, true)`,
        [cedulaTemp, propNombres, propApellidos, email, telefono || null, ciudad || null],
      );
    }

    await client.query('COMMIT');

    res.status(201).json({ success: true, data: r.rows[0] });
  } catch (err) {
    logger.error('register error', err);
    serverError(res);
  }
};
