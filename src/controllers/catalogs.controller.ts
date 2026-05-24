import { Request, Response } from 'express';
import { query } from '../config/database';
import { ok, created, noContent, notFound, serverError } from '../utils/response';
import { logger } from '../utils/logger';

// ─── Especialidades ───────────────────────────────────────────
export const getEspecialidades = async (_: Request, res: Response) => {
  try {
    const r = await query('SELECT * FROM especialidades ORDER BY nombre');
    ok(res, r.rows);
  } catch (e) { logger.error(e); serverError(res); }
};

export const createEspecialidad = async (req: Request, res: Response) => {
  const { nombre, descripcion } = req.body;
  try {
    const r = await query(
      'INSERT INTO especialidades (nombre, descripcion) VALUES ($1,$2) RETURNING *',
      [nombre, descripcion],
    );
    created(res, r.rows[0]);
  } catch (e) { logger.error(e); serverError(res); }
};

export const updateEspecialidad = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { nombre, descripcion } = req.body;
  try {
    const r = await query(
      'UPDATE especialidades SET nombre=$1, descripcion=$2 WHERE id_especialidad=$3 RETURNING *',
      [nombre, descripcion, id],
    );
    if (!r.rows[0]) { notFound(res, 'Especialidad no encontrada'); return; }
    ok(res, r.rows[0]);
  } catch (e) { logger.error(e); serverError(res); }
};

export const deleteEspecialidad = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await query('DELETE FROM especialidades WHERE id_especialidad=$1', [id]);
    noContent(res);
  } catch (e) { logger.error(e); serverError(res); }
};

// ─── Especies ─────────────────────────────────────────────────
export const getEspecies = async (_: Request, res: Response) => {
  try {
    const r = await query('SELECT * FROM especies ORDER BY nombre');
    ok(res, r.rows);
  } catch (e) { logger.error(e); serverError(res); }
};

export const createEspecie = async (req: Request, res: Response) => {
  const { nombre, descripcion } = req.body;
  try {
    const r = await query(
      'INSERT INTO especies (nombre, descripcion) VALUES ($1,$2) RETURNING *',
      [nombre, descripcion],
    );
    created(res, r.rows[0]);
  } catch (e) { logger.error(e); serverError(res); }
};

export const updateEspecie = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { nombre, descripcion } = req.body;
  try {
    const r = await query(
      'UPDATE especies SET nombre=$1, descripcion=$2 WHERE id_especie=$3 RETURNING *',
      [nombre, descripcion, id],
    );
    if (!r.rows[0]) { notFound(res, 'Especie no encontrada'); return; }
    ok(res, r.rows[0]);
  } catch (e) { logger.error(e); serverError(res); }
};
