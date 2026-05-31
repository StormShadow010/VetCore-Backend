import { Request, Response } from 'express';
import { query } from '../config/database';
import { ok, serverError } from '../utils/response';
import { logger } from '../utils/logger';

export const getDashboard = async (req: Request, res: Response) => {
  const user = (req as typeof req & { user?: { sub: number; rol: string } }).user;
  const isUsuario = user?.rol === 'USUARIO';

  try {
    let citasQuery: string;
    let citasParams: unknown[] = [];
    let mascotasQuery: string;
    let mascotasParams: unknown[] = [];

    if (isUsuario && user) {
      // USUARIO: solo sus citas y mascotas (vinculadas por email del propietario)
      citasQuery = `
        SELECT
          COUNT(*) FILTER (WHERE c.estado='PENDIENTE')  AS pendientes,
          COUNT(*) FILTER (WHERE c.estado='ATENDIDA')   AS atendidas,
          COUNT(*) FILTER (WHERE DATE(c.fecha_hora)=CURRENT_DATE) AS hoy
        FROM citas c
        JOIN mascotas m ON m.id_mascota = c.id_mascota
        JOIN propietarios p ON p.id_propietario = m.id_propietario
        JOIN usuarios u ON u.email = p.email
        WHERE u.id_usuario = $1`;
      citasParams = [user.sub];
      mascotasQuery = `
        SELECT COUNT(*) AS total FROM mascotas m
        JOIN propietarios p ON p.id_propietario = m.id_propietario
        JOIN usuarios u ON u.email = p.email
        WHERE m.activa = TRUE AND u.id_usuario = $1`;
      mascotasParams = [user.sub];
    } else {
      citasQuery = `
        SELECT
          COUNT(*) FILTER (WHERE estado='PENDIENTE')  AS pendientes,
          COUNT(*) FILTER (WHERE estado='ATENDIDA')   AS atendidas,
          COUNT(*) FILTER (WHERE DATE(fecha_hora)=CURRENT_DATE) AS hoy
        FROM citas`;
      mascotasQuery = `SELECT COUNT(*) AS total FROM mascotas WHERE activa=TRUE`;
    }

    const [citas, mascotas, ingresos, stock] = await Promise.all([
      query(citasQuery, citasParams),
      query(mascotasQuery, mascotasParams),
      isUsuario ? Promise.resolve({ rows: [{ total_mes: 0, cobrado_mes: 0 }] }) : query(`
        SELECT
          COALESCE(SUM(total),0) AS total_mes,
          COALESCE(SUM(total) FILTER (WHERE pagado=TRUE),0) AS cobrado_mes
        FROM facturas
        WHERE DATE_TRUNC('month', fecha_emision) = DATE_TRUNC('month', NOW())`),
      isUsuario ? Promise.resolve({ rows: [{ bajo_stock: 0 }] }) :
        query(`SELECT COUNT(*) AS bajo_stock FROM medicamentos WHERE stock < 20 AND activo=TRUE`),
    ]);

    ok(res, {
      citas:    citas.rows[0],
      mascotas: mascotas.rows[0],
      ingresos: ingresos.rows[0],
      stock:    stock.rows[0],
    });
  } catch (e) { logger.error(e); serverError(res); }
};

export const getIngresosPorMes = async (_req: Request, res: Response) => {
  try {
    const r = await query(`
      SELECT
        TO_CHAR(fecha_emision, 'YYYY-MM') AS mes,
        COUNT(*) AS facturas,
        SUM(total) AS total,
        SUM(total) FILTER (WHERE pagado=TRUE) AS cobrado
      FROM facturas
      GROUP BY 1 ORDER BY 1 DESC LIMIT 12`);
    ok(res, r.rows);
  } catch (e) { logger.error(e); serverError(res); }
};

export const getMascotasPorEspecie = async (_req: Request, res: Response) => {
  try {
    const r = await query(`
      SELECT e.nombre AS especie, COUNT(m.id_mascota) AS total
      FROM especies e
      LEFT JOIN mascotas m ON m.id_especie=e.id_especie AND m.activa=TRUE
      GROUP BY e.id_especie, e.nombre ORDER BY total DESC`);
    ok(res, r.rows);
  } catch (e) { logger.error(e); serverError(res); }
};

export const getCitasPorVeterinario = async (_req: Request, res: Response) => {
  try {
    const r = await query(`
      SELECT v.nombres || ' ' || v.apellidos AS veterinario,
             esp.nombre AS especialidad,
             COUNT(*) FILTER (WHERE c.estado='ATENDIDA') AS atendidas,
             COUNT(*) FILTER (WHERE c.estado='PENDIENTE') AS pendientes
      FROM veterinarios v
      JOIN especialidades esp ON esp.id_especialidad=v.id_especialidad
      LEFT JOIN citas c ON c.id_veterinario=v.id_veterinario
      WHERE v.activo=TRUE
      GROUP BY v.id_veterinario, esp.nombre ORDER BY atendidas DESC`);
    ok(res, r.rows);
  } catch (e) { logger.error(e); serverError(res); }
};
