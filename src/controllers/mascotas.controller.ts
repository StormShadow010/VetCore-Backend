import { Request, Response } from "express";
import { query, getClient } from "../config/database";
import { ok, created, notFound, serverError } from "../utils/response";
import { logger } from "../utils/logger";

const MASCOTA_WITH_JOINS = `
  SELECT m.*, e.nombre AS especie_nombre,
    p.nombres AS propietario_nombre, p.apellidos AS propietario_apellidos,
    CONCAT(p.nombres, ' ', p.apellidos) AS propietario_nombre,
    p.telefono AS propietario_telefono, p.id_propietario
  FROM mascotas m
  JOIN especies e ON e.id_especie = m.id_especie
  JOIN propietarios p ON p.id_propietario = m.id_propietario
`;

export const getMascotas = async (req: Request, res: Response) => {
  const { search, id_especie, activa, mis_mascotas } = req.query;
  const user = (req as typeof req & { user?: { sub: number; email?: string } })
    .user;
  const params: unknown[] = [];
  const conditions: string[] = [];

  // activa='true' → solo activas | 'false' → solo inactivas | cualquier otro → todas
  if (activa === "true") {
    conditions.push("m.activa = TRUE");
  } else if (activa === "false") {
    conditions.push("m.activa = FALSE");
  }

  // USUARIO: solo las mascotas del propietario con mismo email
  if (mis_mascotas === "true" && user) {
    params.push(user.sub);
    conditions.push(`m.id_propietario IN (
      SELECT p.id_propietario FROM propietarios p
      JOIN usuarios u ON u.email = p.email
      WHERE u.id_usuario = $${params.length}
    )`);
  }

  if (search) {
    params.push(`%${search}%`);
    conditions.push(
      `(m.nombre ILIKE $${params.length} OR p.nombres ILIKE $${params.length} OR p.apellidos ILIKE $${params.length})`,
    );
  }
  if (id_especie) {
    params.push(id_especie);
    conditions.push(`m.id_especie = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const r = await query(
      `${MASCOTA_WITH_JOINS} ${where} ORDER BY m.activa DESC, m.nombre`,
      params,
    );
    ok(res, r.rows);
  } catch (e) {
    logger.error(e);
    serverError(res);
  }
};

export const getMascotaById = async (req: Request, res: Response) => {
  try {
    const r = await query(`${MASCOTA_WITH_JOINS} WHERE m.id_mascota = $1`, [
      req.params.id,
    ]);
    if (!r.rows[0]) {
      notFound(res, "Mascota no encontrada");
      return;
    }

    const citas = await query(
      `SELECT c.*, v.nombres||' '||v.apellidos AS veterinario_nombre, c.estado
       FROM citas c JOIN veterinarios v ON v.id_veterinario=c.id_veterinario
       WHERE c.id_mascota = $1 ORDER BY c.fecha_hora DESC`,
      [req.params.id],
    );
    ok(res, { ...r.rows[0], citas: citas.rows });
  } catch (e) {
    logger.error(e);
    serverError(res);
  }
};

export const createMascota = async (req: Request, res: Response) => {
  const { nombre, id_especie, raza, sexo, fecha_nac, peso_kg, color } =
    req.body;
  let { id_propietario } = req.body;
  const user = (req as typeof req & { user?: { sub: number; rol: string } })
    .user;

  // USUARIO: auto-asignar propietario vinculado a su email
  if (user?.rol === "USUARIO" && !id_propietario) {
    // Buscar propietario vinculado por email del usuario
    const userResult = await query(
      "SELECT email FROM usuarios WHERE id_usuario = $1",
      [user.sub],
    );
    const userEmail = userResult.rows[0]?.email;

    if (userEmail) {
      const propResult = await query(
        "SELECT id_propietario FROM propietarios WHERE email = $1 LIMIT 1",
        [userEmail],
      );
      if (propResult.rows[0]) {
        id_propietario = propResult.rows[0].id_propietario;
      }
    }

    if (!id_propietario) {
      // Si no tiene propietario vinculado, crearlo automáticamente
      const userInfo = await query(
        "SELECT username, email FROM usuarios WHERE id_usuario = $1",
        [user.sub],
      );
      if (userInfo.rows[0] && userInfo.rows[0].email) {
        const cedulaTemp = `USR${user.sub}${Date.now()}`.slice(0, 20);
        const newProp = await query(
          `INSERT INTO propietarios (cedula, nombres, apellidos, email, activo)
           VALUES ($1, $2, $2, $3, true) RETURNING id_propietario`,
          [cedulaTemp, userInfo.rows[0].username, userInfo.rows[0].email],
        );
        id_propietario = newProp.rows[0].id_propietario;
      } else {
        res
          .status(400)
          .json({
            success: false,
            message:
              "Tu cuenta no tiene email registrado. Contacta al administrador.",
          });
        return;
      }
    }
  }

  if (!id_propietario) {
    res
      .status(400)
      .json({ success: false, message: "El propietario es obligatorio" });
    return;
  }

  try {
    const r = await query(
      `INSERT INTO mascotas (nombre, id_especie, raza, sexo, fecha_nac, peso_kg, color, id_propietario)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        nombre,
        id_especie,
        raza,
        sexo,
        fecha_nac,
        peso_kg,
        color,
        id_propietario,
      ],
    );
    created(res, r.rows[0]);
  } catch (e) {
    logger.error(e);
    serverError(res);
  }
};

export const updateMascota = async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    nombre,
    id_especie,
    raza,
    sexo,
    fecha_nac,
    peso_kg,
    color,
    id_propietario,
    activa,
  } = req.body;
  try {
    const r = await query(
      `UPDATE mascotas SET nombre=$1, id_especie=$2, raza=$3, sexo=$4,
       fecha_nac=$5, peso_kg=$6, color=$7, id_propietario=$8,
       activa=COALESCE($9, activa)
       WHERE id_mascota=$10 RETURNING *`,
      [
        nombre,
        id_especie,
        raza,
        sexo,
        fecha_nac,
        peso_kg,
        color,
        id_propietario,
        activa !== undefined ? activa : null,
        id,
      ],
    );
    if (!r.rows[0]) {
      notFound(res, "Mascota no encontrada");
      return;
    }
    ok(res, r.rows[0]);
  } catch (e) {
    logger.error(e);
    serverError(res);
  }
};

export const deactivateMascota = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const r = await query(
      "UPDATE mascotas SET activa=FALSE WHERE id_mascota=$1 RETURNING id_mascota, nombre",
      [id],
    );
    if (!r.rows[0]) {
      notFound(res, "Mascota no encontrada");
      return;
    }
    ok(res, { message: `Mascota "${r.rows[0].nombre}" desactivada` });
  } catch (e) {
    logger.error(e);
    serverError(res);
  }
};

export const activateMascota = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const r = await query(
      "UPDATE mascotas SET activa=TRUE WHERE id_mascota=$1 RETURNING id_mascota, nombre",
      [id],
    );
    if (!r.rows[0]) {
      notFound(res, "Mascota no encontrada");
      return;
    }
    ok(res, { message: `Mascota "${r.rows[0].nombre}" reactivada` });
  } catch (e) {
    logger.error(e);
    serverError(res);
  }
};

export const hardDeleteMascota = async (req: Request, res: Response) => {
  const { id } = req.params;
  const client = await getClient();
  try {
    await client.query("BEGIN");
    await client.query(
      `DELETE FROM tratamientos WHERE id_consulta IN (
      SELECT co.id_consulta FROM consultas co
      JOIN citas c ON c.id_cita = co.id_cita WHERE c.id_mascota = $1)`,
      [id],
    );
    await client.query(
      `DELETE FROM facturas WHERE id_cita IN (
      SELECT id_cita FROM citas WHERE id_mascota = $1)`,
      [id],
    );
    await client.query(
      `DELETE FROM consultas WHERE id_cita IN (
      SELECT id_cita FROM citas WHERE id_mascota = $1)`,
      [id],
    );
    await client.query("DELETE FROM citas WHERE id_mascota = $1", [id]);
    const r = await client.query(
      "DELETE FROM mascotas WHERE id_mascota = $1 RETURNING nombre",
      [id],
    );
    await client.query("COMMIT");
    if (!r.rows[0]) {
      notFound(res, "Mascota no encontrada");
      return;
    }
    ok(res, {
      message: `Mascota "${r.rows[0].nombre}" eliminada permanentemente`,
    });
  } catch (e) {
    await client.query("ROLLBACK");
    logger.error("hardDeleteMascota", e);
    serverError(res);
  } finally {
    client.release();
  }
};
