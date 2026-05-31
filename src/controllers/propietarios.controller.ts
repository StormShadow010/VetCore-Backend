import { Request, Response } from 'express';
import { query, getClient } from '../config/database';
import { ok, created, notFound, serverError, badRequest } from '../utils/response';
import { logger } from '../utils/logger';

export const getPropietarios = async (req: Request, res: Response) => {
  const { search, ciudad, activo } = req.query;
  const params: unknown[] = [];
  const conditions: string[] = [];

  // activo='true' → activos | 'false' → inactivos | 'todas'/undefined → todos
  if (activo === 'true') {
    conditions.push('activo = TRUE');
  } else if (activo === 'false') {
    conditions.push('activo = FALSE');
  }

  if (search) {
    params.push(`%${search}%`);
    conditions.push(
      `(nombres ILIKE $${params.length} OR apellidos ILIKE $${params.length} OR cedula ILIKE $${params.length})`,
    );
  }
  if (ciudad) {
    params.push(ciudad);
    conditions.push(`ciudad = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const r = await query(
      `SELECT * FROM propietarios ${where} ORDER BY apellidos, nombres`,
      params,
    );
    ok(res, r.rows);
  } catch (e) { logger.error(e); serverError(res); }
};

export const getPropietarioById = async (req: Request, res: Response) => {
  try {
    const r = await query('SELECT * FROM propietarios WHERE id_propietario = $1', [req.params.id]);
    if (!r.rows[0]) { notFound(res, 'Propietario no encontrado'); return; }
    const mascotas = await query(
      `SELECT m.*, e.nombre AS especie_nombre FROM mascotas m
       JOIN especies e ON e.id_especie=m.id_especie
       WHERE m.id_propietario = $1 AND m.activa = TRUE`,
      [req.params.id],
    );
    ok(res, { ...r.rows[0], mascotas: mascotas.rows });
  } catch (e) { logger.error(e); serverError(res); }
};

export const createPropietario = async (req: Request, res: Response) => {
  const { cedula, nombres, apellidos, telefono, email, direccion, ciudad } = req.body;
  try {
    const dup = await query('SELECT id_propietario FROM propietarios WHERE cedula=$1', [cedula]);
    if (dup.rows.length) { badRequest(res, ['La cédula ya está registrada']); return; }
    const r = await query(
      `INSERT INTO propietarios (cedula, nombres, apellidos, telefono, email, direccion, ciudad)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [cedula, nombres, apellidos, telefono, email, direccion, ciudad],
    );
    created(res, r.rows[0]);
  } catch (e) { logger.error(e); serverError(res); }
};

export const updatePropietario = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { nombres, apellidos, telefono, email, direccion, ciudad } = req.body;
  try {
    const r = await query(
      `UPDATE propietarios SET nombres=$1, apellidos=$2, telefono=$3,
       email=$4, direccion=$5, ciudad=$6 WHERE id_propietario=$7 RETURNING *`,
      [nombres, apellidos, telefono, email, direccion, ciudad, id],
    );
    if (!r.rows[0]) { notFound(res, 'Propietario no encontrado'); return; }
    ok(res, r.rows[0]);
  } catch (e) { logger.error(e); serverError(res); }
};

// Desactivar — borrado lógico, registro sigue en la tabla
export const deletePropietario = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    const r = await query(
      `UPDATE propietarios SET activo = FALSE WHERE id_propietario = $1
       RETURNING id_propietario, nombres, apellidos`,
      [id],
    );
    if (!r.rows[0]) { notFound(res, 'Propietario no encontrado'); return; }
    ok(res, { message: `Propietario "${r.rows[0].nombres} ${r.rows[0].apellidos}" desactivado` });
  } catch (err) { logger.error(err); serverError(res); }
};

// Reactivar
export const reactivatePropietario = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    const r = await query(
      'UPDATE propietarios SET activo = TRUE WHERE id_propietario = $1 RETURNING nombres, apellidos',
      [id],
    );
    if (!r.rows[0]) { notFound(res, 'Propietario no encontrado'); return; }
    ok(res, { message: `Propietario "${r.rows[0].nombres} ${r.rows[0].apellidos}" reactivado` });
  } catch (err) { logger.error(err); serverError(res); }
};

// Eliminar permanente con cascada — solo SUPERADMIN
export const hardDeletePropietario = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const client = await getClient();
  try {
    await client.query('BEGIN');
    // tratamientos → facturas → consultas → citas → mascotas → propietario
    await client.query(`
      DELETE FROM tratamientos WHERE id_consulta IN (
        SELECT co.id_consulta FROM consultas co
        JOIN citas c ON c.id_cita = co.id_cita
        JOIN mascotas m ON m.id_mascota = c.id_mascota
        WHERE m.id_propietario = $1)`, [id]);
    await client.query(`
      DELETE FROM facturas WHERE id_cita IN (
        SELECT c.id_cita FROM citas c
        JOIN mascotas m ON m.id_mascota = c.id_mascota
        WHERE m.id_propietario = $1)`, [id]);
    await client.query(`
      DELETE FROM consultas WHERE id_cita IN (
        SELECT c.id_cita FROM citas c
        JOIN mascotas m ON m.id_mascota = c.id_mascota
        WHERE m.id_propietario = $1)`, [id]);
    await client.query(`
      DELETE FROM citas WHERE id_mascota IN (
        SELECT id_mascota FROM mascotas WHERE id_propietario = $1)`, [id]);
    await client.query('DELETE FROM mascotas WHERE id_propietario = $1', [id]);
    const r = await client.query(
      'DELETE FROM propietarios WHERE id_propietario = $1 RETURNING nombres, apellidos', [id]);
    await client.query('COMMIT');
    if (!r.rows[0]) { notFound(res, 'Propietario no encontrado'); return; }
    ok(res, { message: `Propietario "${r.rows[0].nombres} ${r.rows[0].apellidos}" y todos sus datos eliminados` });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('hardDeletePropietario', err);
    serverError(res);
  } finally {
    client.release();
  }
};
