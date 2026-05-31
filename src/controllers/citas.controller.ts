import { Request, Response } from 'express';
import { query } from '../config/database';
import { ok, created, notFound, badRequest, serverError } from '../utils/response';
import { logger } from '../utils/logger';
import { EstadoCita } from '../types';

const CITA_WITH_JOINS = `
  SELECT
    c.*,
    m.nombre                              AS mascota_nombre,
    e.nombre                              AS especie_nombre,
    p.nombres || ' ' || p.apellidos       AS propietario_nombre,
    p.telefono                            AS propietario_telefono,
    v.nombres || ' ' || v.apellidos       AS veterinario_nombre,
    esp.nombre                            AS especialidad_nombre
  FROM citas c
  JOIN mascotas     m   ON m.id_mascota        = c.id_mascota
  JOIN especies     e   ON e.id_especie        = m.id_especie
  JOIN propietarios p   ON p.id_propietario    = m.id_propietario
  JOIN veterinarios v   ON v.id_veterinario    = c.id_veterinario
  JOIN especialidades esp ON esp.id_especialidad = v.id_especialidad
`;

export const getCitas = async (req: Request, res: Response) => {
  const { estado, fecha, id_veterinario, id_mascota, mis_citas } = req.query;
  const user = (req as typeof req & { user?: { sub: number; rol: string } }).user;
  const params: unknown[] = [];
  const conditions: string[] = [];

  // USUARIO → solo sus citas (mascotas que le pertenecen a través de propietarios vinculados)
  if (mis_citas === 'true' && user) {
    // Filtramos citas cuya mascota tiene un propietario con el mismo email que el usuario
    params.push(user.sub);
    conditions.push(`c.id_mascota IN (
      SELECT m.id_mascota FROM mascotas m
      JOIN propietarios p ON p.id_propietario = m.id_propietario
      JOIN usuarios u ON u.email = p.email
      WHERE u.id_usuario = $${params.length}
    )`);
  }

  if (estado) {
    params.push(estado);
    conditions.push(`c.estado = $${params.length}`);
  }
  if (fecha) {
    params.push(fecha);
    conditions.push(`DATE(c.fecha_hora) = $${params.length}`);
  }
  if (id_veterinario) {
    params.push(id_veterinario);
    conditions.push(`c.id_veterinario = $${params.length}`);
  }
  if (id_mascota) {
    params.push(id_mascota);
    conditions.push(`c.id_mascota = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const r = await query(`${CITA_WITH_JOINS} ${where} ORDER BY c.fecha_hora DESC`, params);
    ok(res, r.rows);
  } catch (e) { logger.error(e); serverError(res); }
};

export const getCitaById = async (req: Request, res: Response) => {
  try {
    const citaR = await query(`${CITA_WITH_JOINS} WHERE c.id_cita = $1`, [req.params.id]);
    if (!citaR.rows[0]) { notFound(res, 'Cita no encontrada'); return; }

    const consultaR = await query(
      `SELECT co.*, 
              json_agg(json_build_object(
                'id_tratamiento', t.id_tratamiento,
                'medicamento', med.nombre,
                'dosis', t.dosis,
                'frecuencia', t.frecuencia,
                'duracion_dias', t.duracion_dias
              )) FILTER (WHERE t.id_tratamiento IS NOT NULL) AS tratamientos
       FROM consultas co
       LEFT JOIN tratamientos t   ON t.id_consulta    = co.id_consulta
       LEFT JOIN medicamentos med ON med.id_medicamento = t.id_medicamento
       WHERE co.id_cita = $1
       GROUP BY co.id_consulta`,
      [req.params.id],
    );

    const facturaR = await query('SELECT * FROM facturas WHERE id_cita = $1', [req.params.id]);

    ok(res, {
      ...citaR.rows[0],
      consulta: consultaR.rows[0] ?? null,
      factura:  facturaR.rows[0] ?? null,
    });
  } catch (e) { logger.error(e); serverError(res); }
};

export const createCita = async (req: Request, res: Response) => {
  const { id_mascota, id_veterinario, fecha_hora, motivo, observaciones } = req.body;
  try {
    // Validar que el veterinario esté activo
    const vetR = await query('SELECT activo FROM veterinarios WHERE id_veterinario=$1', [id_veterinario]);
    if (!vetR.rows[0]?.activo) { badRequest(res, ['Veterinario no disponible']); return; }

    const r = await query(
      `INSERT INTO citas (id_mascota, id_veterinario, fecha_hora, motivo, observaciones)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [id_mascota, id_veterinario, fecha_hora, motivo, observaciones],
    );
    created(res, r.rows[0]);
  } catch (e) { logger.error(e); serverError(res); }
};

export const updateEstadoCita = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { estado, observaciones } = req.body as { estado: EstadoCita; observaciones?: string };

  const validStates: EstadoCita[] = ['PENDIENTE', 'ATENDIDA', 'CANCELADA', 'NO_ASISTIO'];
  if (!validStates.includes(estado)) {
    badRequest(res, [`Estado inválido. Use: ${validStates.join(', ')}`]);
    return;
  }

  try {
    const r = await query(
      'UPDATE citas SET estado=$1, observaciones=COALESCE($2, observaciones) WHERE id_cita=$3 RETURNING *',
      [estado, observaciones, id],
    );
    if (!r.rows[0]) { notFound(res, 'Cita no encontrada'); return; }
    ok(res, r.rows[0]);
  } catch (e) { logger.error(e); serverError(res); }
};
