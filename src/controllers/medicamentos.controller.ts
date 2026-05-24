import { Request, Response } from 'express';
import { query } from '../config/database';
import { ok, created, notFound, serverError } from '../utils/response';
import { logger } from '../utils/logger';

export const getMedicamentos = async (req: Request, res: Response) => {
  const { search, activo = 'true' } = req.query;
  const params: unknown[] = [activo === 'true'];
  const conditions = ['activo = $1'];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(nombre ILIKE $${params.length} OR principio_act ILIKE $${params.length})`);
  }

  try {
    const r = await query(
      `SELECT * FROM medicamentos WHERE ${conditions.join(' AND ')} ORDER BY nombre`,
      params,
    );
    ok(res, r.rows);
  } catch (e) { logger.error(e); serverError(res); }
};

export const createMedicamento = async (req: Request, res: Response) => {
  const { nombre, principio_act, presentacion, stock, precio_unit } = req.body;
  try {
    const r = await query(
      `INSERT INTO medicamentos (nombre, principio_act, presentacion, stock, precio_unit)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [nombre, principio_act, presentacion, stock ?? 0, precio_unit],
    );
    created(res, r.rows[0]);
  } catch (e) { logger.error(e); serverError(res); }
};

export const updateMedicamento = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { nombre, principio_act, presentacion, precio_unit, activo } = req.body;
  try {
    const r = await query(
      `UPDATE medicamentos SET nombre=$1, principio_act=$2, presentacion=$3,
       precio_unit=$4, activo=$5 WHERE id_medicamento=$6 RETURNING *`,
      [nombre, principio_act, presentacion, precio_unit, activo, id],
    );
    if (!r.rows[0]) { notFound(res, 'Medicamento no encontrado'); return; }
    ok(res, r.rows[0]);
  } catch (e) { logger.error(e); serverError(res); }
};

export const ajustarStock = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { cantidad, operacion } = req.body as { cantidad: number; operacion: 'ENTRADA' | 'SALIDA' };

  const op = operacion === 'SALIDA' ? '-' : '+';
  try {
    const r = await query(
      `UPDATE medicamentos SET stock = stock ${op} $1
       WHERE id_medicamento=$2 AND stock ${op === '-' ? '>= $1' : '> 0 OR TRUE'}
       RETURNING *`,
      [cantidad, id],
    );
    if (!r.rows[0]) { notFound(res, 'Medicamento no encontrado o stock insuficiente'); return; }
    ok(res, r.rows[0]);
  } catch (e) { logger.error(e); serverError(res); }
};
