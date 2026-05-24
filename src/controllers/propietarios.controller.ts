import { Request, Response } from 'express';
import { query } from '../config/database';
import { ok, created, notFound, serverError, conflict } from '../utils/response';
import { logger } from '../utils/logger';

export const getPropietarios = async (req: Request, res: Response) => {
  const { search, ciudad } = req.query;
  const params: unknown[] = [];
  const conditions: string[] = [];

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
    const propR = await query(
      'SELECT * FROM propietarios WHERE id_propietario = $1',
      [req.params.id],
    );
    if (!propR.rows[0]) { notFound(res, 'Propietario no encontrado'); return; }

    const mascotasR = await query(
      `SELECT m.*, e.nombre AS especie_nombre
       FROM mascotas m
       JOIN especies e ON e.id_especie = m.id_especie
       WHERE m.id_propietario = $1 AND m.activa = TRUE`,
      [req.params.id],
    );

    ok(res, { ...propR.rows[0], mascotas: mascotasR.rows });
  } catch (e) { logger.error(e); serverError(res); }
};

export const createPropietario = async (req: Request, res: Response) => {
  const { cedula, nombres, apellidos, telefono, email, direccion, ciudad } = req.body;
  try {
    const dup = await query('SELECT id_propietario FROM propietarios WHERE cedula=$1', [cedula]);
    if (dup.rows.length) { conflict(res, 'Ya existe un propietario con esa cédula'); return; }

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
