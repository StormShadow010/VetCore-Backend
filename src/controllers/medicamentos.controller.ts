import { Request, Response } from 'express';
import { query } from '../config/database';
import { ok, created, notFound, serverError } from '../utils/response';
import { logger } from '../utils/logger';

export const getMedicamentos = async (req: Request, res: Response) => {
  const { search, activo } = req.query;
  const params: unknown[] = [];
  const conditions: string[] = [];

  // activo='true' -> activos | 'false' -> inactivos | undefined/'todas' -> todos
  if (activo === 'true') {
    conditions.push('activo = TRUE');
  } else if (activo === 'false') {
    conditions.push('activo = FALSE');
  }

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(nombre ILIKE $${params.length} OR principio_act ILIKE $${params.length})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const r = await query(
      `SELECT * FROM medicamentos ${where} ORDER BY nombre`,
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

export const deleteMedicamento = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    const r = await query(
      'UPDATE medicamentos SET activo = FALSE WHERE id_medicamento = $1 RETURNING id_medicamento, nombre',
      [id],
    );
    if (!r.rows[0]) { notFound(res, 'Medicamento no encontrado'); return; }
    ok(res, { message: `Medicamento "${r.rows[0].nombre}" desactivado` });
  } catch (err) {
    logger.error('deleteMedicamento error', err);
    serverError(res);
  }
};

export const reactivateMedicamento = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    const r = await query(
      'UPDATE medicamentos SET activo = TRUE WHERE id_medicamento = $1 RETURNING id_medicamento, nombre',
      [id],
    );
    if (!r.rows[0]) { notFound(res, 'Medicamento no encontrado'); return; }
    ok(res, { message: `Medicamento "${r.rows[0].nombre}" reactivado` });
  } catch (err) {
    logger.error('reactivateMedicamento error', err);
    serverError(res);
  }
};

export const hardDeleteMedicamento = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    await query('DELETE FROM medicamentos WHERE id_medicamento = $1', [id]);
    ok(res, { message: 'Medicamento eliminado permanentemente' });
  } catch (err) {
    logger.error('hardDeleteMedicamento error', err);
    serverError(res);
  }
};
