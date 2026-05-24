import { Request, Response } from 'express';
import { query } from '../config/database';
import { ok, created, notFound, serverError, conflict } from '../utils/response';
import { logger } from '../utils/logger';

export const getVeterinarios = async (_req: Request, res: Response) => {
  try {
    const r = await query(
      `SELECT v.*, esp.nombre AS especialidad_nombre
       FROM veterinarios v
       JOIN especialidades esp ON esp.id_especialidad = v.id_especialidad
       WHERE v.activo = TRUE ORDER BY v.apellidos`,
    );
    ok(res, r.rows);
  } catch (e) { logger.error(e); serverError(res); }
};

export const getVeterinarioById = async (req: Request, res: Response) => {
  try {
    const r = await query(
      `SELECT v.*, esp.nombre AS especialidad_nombre
       FROM veterinarios v
       JOIN especialidades esp ON esp.id_especialidad = v.id_especialidad
       WHERE v.id_veterinario = $1`,
      [req.params.id],
    );
    if (!r.rows[0]) { notFound(res, 'Veterinario no encontrado'); return; }
    ok(res, r.rows[0]);
  } catch (e) { logger.error(e); serverError(res); }
};

export const createVeterinario = async (req: Request, res: Response) => {
  const { cedula, nombres, apellidos, telefono, email, id_especialidad } = req.body;
  try {
    const dup = await query('SELECT id_veterinario FROM veterinarios WHERE cedula=$1 OR email=$2', [cedula, email]);
    if (dup.rows.length) { conflict(res, 'Cédula o email ya registrado'); return; }

    const r = await query(
      `INSERT INTO veterinarios (cedula, nombres, apellidos, telefono, email, id_especialidad)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [cedula, nombres, apellidos, telefono, email, id_especialidad],
    );
    created(res, r.rows[0]);
  } catch (e) { logger.error(e); serverError(res); }
};

export const updateVeterinario = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { nombres, apellidos, telefono, email, id_especialidad, activo } = req.body;
  try {
    const r = await query(
      `UPDATE veterinarios SET nombres=$1, apellidos=$2, telefono=$3,
       email=$4, id_especialidad=$5, activo=$6 WHERE id_veterinario=$7 RETURNING *`,
      [nombres, apellidos, telefono, email, id_especialidad, activo, id],
    );
    if (!r.rows[0]) { notFound(res, 'Veterinario no encontrado'); return; }
    ok(res, r.rows[0]);
  } catch (e) { logger.error(e); serverError(res); }
};
