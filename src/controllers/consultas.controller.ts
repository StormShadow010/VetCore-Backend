import { Request, Response } from 'express';
import { query, getClient } from '../config/database';
import { ok, created, notFound, badRequest, serverError, conflict } from '../utils/response';
import { logger } from '../utils/logger';

/* ─── CONSULTAS ─────────────────────────────────────────────── */

export const createConsulta = async (req: Request, res: Response) => {
  const {
    id_cita, diagnostico, sintomas, temperatura,
    peso_consulta, proxima_cita, costo_consulta,
    tratamientos = [],
  } = req.body as {
    id_cita: number; diagnostico?: string; sintomas?: string;
    temperatura?: number; peso_consulta?: number; proxima_cita?: string;
    costo_consulta: number;
    tratamientos?: Array<{
      id_medicamento: number; dosis?: string;
      frecuencia?: string; duracion_dias?: number; cantidad?: number;
    }>;
  };

  // Verificar que la cita existe y está PENDIENTE
  const citaR = await query('SELECT estado FROM citas WHERE id_cita=$1', [id_cita]);
  if (!citaR.rows[0]) { notFound(res, 'Cita no encontrada'); return; }
  if (citaR.rows[0].estado !== 'PENDIENTE') {
    badRequest(res, ['Solo se puede crear consulta para citas PENDIENTE']);
    return;
  }

  const dup = await query('SELECT id_consulta FROM consultas WHERE id_cita=$1', [id_cita]);
  if (dup.rows.length) { conflict(res, 'Esta cita ya tiene una consulta registrada'); return; }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Crear consulta
    const consultaR = await client.query(
      `INSERT INTO consultas (id_cita, diagnostico, sintomas, temperatura, peso_consulta, proxima_cita, costo_consulta)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id_cita, diagnostico, sintomas, temperatura, peso_consulta, proxima_cita, costo_consulta],
    );
    const consulta = consultaR.rows[0];

    // Insertar tratamientos y descontar stock
    for (const t of tratamientos) {
      await client.query(
        `INSERT INTO tratamientos (id_consulta, id_medicamento, dosis, frecuencia, duracion_dias, cantidad)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [consulta.id_consulta, t.id_medicamento, t.dosis, t.frecuencia, t.duracion_dias, t.cantidad],
      );
      if (t.cantidad) {
        const stockR = await client.query(
          'UPDATE medicamentos SET stock = stock - $1 WHERE id_medicamento=$2 AND stock >= $1 RETURNING stock',
          [t.cantidad, t.id_medicamento],
        );
        if (!stockR.rows[0]) {
          await client.query('ROLLBACK');
          badRequest(res, [`Stock insuficiente para medicamento ID ${t.id_medicamento}`]);
          return;
        }
      }
    }

    // Marcar cita como ATENDIDA
    await client.query("UPDATE citas SET estado='ATENDIDA' WHERE id_cita=$1", [id_cita]);

    // Crear factura automática
    await client.query(
      `INSERT INTO facturas (id_cita, subtotal, descuento_pct, total)
       VALUES ($1,$2,0,$2)`,
      [id_cita, costo_consulta],
    );

    await client.query('COMMIT');
    created(res, consulta);
  } catch (e) {
    await client.query('ROLLBACK');
    logger.error('createConsulta error', e);
    serverError(res);
  } finally {
    client.release();
  }
};

export const getConsultaById = async (req: Request, res: Response) => {
  try {
    const r = await query(
      `SELECT co.*,
              json_agg(json_build_object(
                'id_tratamiento', t.id_tratamiento,
                'id_medicamento', t.id_medicamento,
                'medicamento',    med.nombre,
                'presentacion',   med.presentacion,
                'dosis',          t.dosis,
                'frecuencia',     t.frecuencia,
                'duracion_dias',  t.duracion_dias,
                'cantidad',       t.cantidad
              )) FILTER (WHERE t.id_tratamiento IS NOT NULL) AS tratamientos
       FROM consultas co
       LEFT JOIN tratamientos t   ON t.id_consulta     = co.id_consulta
       LEFT JOIN medicamentos med ON med.id_medicamento = t.id_medicamento
       WHERE co.id_consulta = $1
       GROUP BY co.id_consulta`,
      [req.params.id],
    );
    if (!r.rows[0]) { notFound(res, 'Consulta no encontrada'); return; }
    ok(res, r.rows[0]);
  } catch (e) { logger.error(e); serverError(res); }
};

/* ─── FACTURAS ──────────────────────────────────────────────── */

export const getFacturas = async (_req: Request, res: Response) => {
  try {
    const r = await query(
      `SELECT f.*,
              m.nombre  AS mascota_nombre,
              p.nombres || ' ' || p.apellidos AS propietario,
              v.nombres || ' ' || v.apellidos AS veterinario
       FROM facturas f
       JOIN citas         c ON c.id_cita        = f.id_cita
       JOIN mascotas      m ON m.id_mascota      = c.id_mascota
       JOIN propietarios  p ON p.id_propietario  = m.id_propietario
       JOIN veterinarios  v ON v.id_veterinario  = c.id_veterinario
       ORDER BY f.fecha_emision DESC`,
    );
    ok(res, r.rows);
  } catch (e) { logger.error(e); serverError(res); }
};

export const updateFactura = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { descuento_pct, pagado, metodo_pago } = req.body;
  try {
    const r = await query(
      `UPDATE facturas
       SET descuento_pct=$1,
           total = subtotal * (1 - $1::NUMERIC / 100),
           pagado=$2,
           metodo_pago=$3
       WHERE id_factura=$4 RETURNING *`,
      [descuento_pct, pagado, metodo_pago, id],
    );
    if (!r.rows[0]) { notFound(res, 'Factura no encontrada'); return; }
    ok(res, r.rows[0]);
  } catch (e) { logger.error(e); serverError(res); }
};

export const createFactura = async (req: Request, res: Response) => {
  const { id_cita, subtotal, descuento_pct = 0, metodo_pago, pagado = false } = req.body;
  if (!id_cita || subtotal === undefined) {
    res.status(400).json({ success: false, message: 'id_cita y subtotal son obligatorios' }); return;
  }
  try {
    // Verificar que la cita existe y no tiene factura aún
    const existing = await query('SELECT id_factura FROM facturas WHERE id_cita = $1', [id_cita]);
    if (existing.rows.length) {
      res.status(400).json({ success: false, message: 'Esta cita ya tiene una factura registrada' }); return;
    }
    const total = Number(subtotal) * (1 - Number(descuento_pct) / 100);
    const r = await query(
      `INSERT INTO facturas (id_cita, subtotal, descuento_pct, total, metodo_pago, pagado)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id_cita, subtotal, descuento_pct, total, metodo_pago || null, pagado],
    );
    ok(res, r.rows[0]);
  } catch (e) { logger.error(e); serverError(res); }
};

export const deleteFactura = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const r = await query('DELETE FROM facturas WHERE id_factura = $1 RETURNING id_factura', [id]);
    if (!r.rows[0]) { notFound(res, 'Factura no encontrada'); return; }
    ok(res, { message: 'Factura eliminada' });
  } catch (e) { logger.error(e); serverError(res); }
};
