import { Request, Response } from 'express';
import { query } from '../config/database';
import { ok, created, notFound, serverError } from '../utils/response';
import { logger } from '../utils/logger';

const MASCOTA_WITH_JOINS = `
  SELECT
    m.*,
    e.nombre        AS especie_nombre,
    p.nombres || ' ' || p.apellidos AS propietario_nombre,
    p.telefono      AS propietario_telefono,
    p.cedula        AS propietario_cedula
  FROM mascotas m
  JOIN especies     e ON e.id_especie     = m.id_especie
  JOIN propietarios p ON p.id_propietario = m.id_propietario
`;

export const getMascotas = async (req: Request, res: Response) => {
  const { search, id_especie, activa = 'true' } = req.query;
  const params: unknown[] = [activa === 'true'];
  const conditions: string[] = ['m.activa = $1'];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(m.nombre ILIKE $${params.length} OR p.nombres ILIKE $${params.length} OR p.apellidos ILIKE $${params.length})`);
  }
  if (id_especie) {
    params.push(id_especie);
    conditions.push(`m.id_especie = $${params.length}`);
  }

  try {
    const r = await query(
      `${MASCOTA_WITH_JOINS} WHERE ${conditions.join(' AND ')} ORDER BY m.nombre`,
      params,
    );
    ok(res, r.rows);
  } catch (e) { logger.error(e); serverError(res); }
};

export const getMascotaById = async (req: Request, res: Response) => {
  try {
    const mascR = await query(
      `${MASCOTA_WITH_JOINS} WHERE m.id_mascota = $1`,
      [req.params.id],
    );
    if (!mascR.rows[0]) { notFound(res, 'Mascota no encontrada'); return; }

    // Historial de citas
    const citasR = await query(
      `SELECT c.*, co.diagnostico, co.costo_consulta,
              v.nombres || ' ' || v.apellidos AS veterinario
       FROM citas c
       LEFT JOIN consultas   co ON co.id_cita        = c.id_cita
       LEFT JOIN veterinarios v ON v.id_veterinario  = c.id_veterinario
       WHERE c.id_mascota = $1
       ORDER BY c.fecha_hora DESC`,
      [req.params.id],
    );

    ok(res, { ...mascR.rows[0], historial: citasR.rows });
  } catch (e) { logger.error(e); serverError(res); }
};

export const createMascota = async (req: Request, res: Response) => {
  const { nombre, id_especie, raza, sexo, fecha_nac, peso_kg, color, id_propietario } = req.body;
  try {
    const r = await query(
      `INSERT INTO mascotas (nombre, id_especie, raza, sexo, fecha_nac, peso_kg, color, id_propietario)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [nombre, id_especie, raza, sexo, fecha_nac, peso_kg, color, id_propietario],
    );
    created(res, r.rows[0]);
  } catch (e) { logger.error(e); serverError(res); }
};

export const updateMascota = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { nombre, id_especie, raza, sexo, fecha_nac, peso_kg, color, id_propietario } = req.body;
  try {
    const r = await query(
      `UPDATE mascotas SET nombre=$1, id_especie=$2, raza=$3, sexo=$4,
       fecha_nac=$5, peso_kg=$6, color=$7, id_propietario=$8
       WHERE id_mascota=$9 RETURNING *`,
      [nombre, id_especie, raza, sexo, fecha_nac, peso_kg, color, id_propietario, id],
    );
    if (!r.rows[0]) { notFound(res, 'Mascota no encontrada'); return; }
    ok(res, r.rows[0]);
  } catch (e) { logger.error(e); serverError(res); }
};

export const deactivateMascota = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const r = await query(
      'UPDATE mascotas SET activa=FALSE WHERE id_mascota=$1 RETURNING id_mascota',
      [id],
    );
    if (!r.rows[0]) { notFound(res, 'Mascota no encontrada'); return; }
    ok(res, { message: 'Mascota desactivada' });
  } catch (e) { logger.error(e); serverError(res); }
};
