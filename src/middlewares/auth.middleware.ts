import { Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { AuthRequest, RolUsuario } from '../types';
import { unauthorized, forbidden } from '../utils/response';

// ─── Verifica JWT y adjunta payload al request ────────────────
export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    unauthorized(res, 'Token requerido');
    return;
  }

  const token = authHeader.slice(7);
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    unauthorized(res, 'Token inválido o expirado');
  }
};

// ─── Jerarquía de roles (mayor índice = más privilegios) ──────
const ROLE_HIERARCHY: Record<RolUsuario, number> = {
  CONSULTA:   1,
  USUARIO:    2,
  ADMIN:      3,
  SUPERADMIN: 4,
};

/**
 * authorize(...roles) — el usuario debe tener AL MENOS uno de los roles.
 * authorize('ADMIN') permite a ADMIN y SUPERADMIN.
 */
export const authorize = (...roles: RolUsuario[]) =>
  (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      unauthorized(res);
      return;
    }

    const userLevel = ROLE_HIERARCHY[req.user.rol];
    const minRequired = Math.min(...roles.map((r) => ROLE_HIERARCHY[r]));

    if (userLevel >= minRequired) {
      next();
      return;
    }

    forbidden(res, `Se requiere rol: ${roles.join(' o ')}`);
  };

// ─── Shortcuts semánticos ─────────────────────────────────────
export const requireAdmin      = authorize('ADMIN');
export const requireSuperAdmin = authorize('SUPERADMIN');
export const requireUsuario    = authorize('USUARIO');
export const requireAnyRole    = authorize('CONSULTA'); // cualquier autenticado
