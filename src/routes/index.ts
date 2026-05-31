import { Router } from "express";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { login, getMe, register } from "../controllers/auth.controller";
import {
  getEspecialidades,
  createEspecialidad,
  updateEspecialidad,
  deleteEspecialidad,
  getEspecies,
  createEspecie,
  updateEspecie,
  deleteEspecie,
} from "../controllers/catalogs.controller";
import {
  getPropietarios,
  getPropietarioById,
  createPropietario,
  updatePropietario,
  deletePropietario,
  reactivatePropietario,
  hardDeletePropietario,
} from "../controllers/propietarios.controller";
import {
  getMascotas,
  getMascotaById,
  createMascota,
  updateMascota,
  deactivateMascota,
  hardDeleteMascota,
  activateMascota,
} from "../controllers/mascotas.controller";
import {
  getCitas,
  getCitaById,
  createCita,
  updateEstadoCita,
} from "../controllers/citas.controller";
import {
  createConsulta,
  getConsultaById,
  getFacturas,
  updateFactura,
  createFactura,
  deleteFactura,
} from "../controllers/consultas.controller";
import {
  getMedicamentos,
  createMedicamento,
  updateMedicamento,
  ajustarStock,
  deleteMedicamento,
  reactivateMedicamento,
  hardDeleteMedicamento,
} from "../controllers/medicamentos.controller";
import {
  getVeterinarios,
  getVeterinarioById,
  createVeterinario,
  updateVeterinario,
} from "../controllers/veterinarios.controller";
import {
  getDashboard,
  getIngresosPorMes,
  getMascotasPorEspecie,
  getCitasPorVeterinario,
} from "../controllers/dashboard.controller";
import {
  getUsuarios,
  createUsuario,
  updateUsuario,
  changePassword,
  deleteUsuario,
} from "../controllers/usuarios.controller";
import { Request, Response } from "express";
import { query as dbQuery } from "../config/database";
import { ok, serverError } from "../utils/response";
import { logger } from "../utils/logger";

const router = Router();

// ─── AUTH ─────────────────────────────────────────────────────
router.post("/auth/login", login);
router.post("/auth/register", register);
router.get("/auth/me", authenticate, getMe);

// ─── CATÁLOGOS ────────────────────────────────────────────────
router.get(
  "/especialidades",
  authenticate,
  authorize("CONSULTA"),
  getEspecialidades,
);
router.post(
  "/especialidades",
  authenticate,
  authorize("ADMIN"),
  createEspecialidad,
);
router.put(
  "/especialidades/:id",
  authenticate,
  authorize("ADMIN"),
  updateEspecialidad,
);
router.delete(
  "/especialidades/:id",
  authenticate,
  authorize("SUPERADMIN"),
  deleteEspecialidad,
);

router.get("/especies", authenticate, authorize("CONSULTA"), getEspecies);
router.post("/especies", authenticate, authorize("ADMIN"), createEspecie);
router.put("/especies/:id", authenticate, authorize("ADMIN"), updateEspecie);
router.delete(
  "/especies/:id",
  authenticate,
  authorize("SUPERADMIN"),
  deleteEspecie,
);

// ─── VETERINARIOS ─────────────────────────────────────────────
router.get(
  "/veterinarios",
  authenticate,
  authorize("CONSULTA"),
  getVeterinarios,
);
router.get(
  "/veterinarios/:id",
  authenticate,
  authorize("CONSULTA"),
  getVeterinarioById,
);
router.post(
  "/veterinarios",
  authenticate,
  authorize("ADMIN"),
  createVeterinario,
);
router.put(
  "/veterinarios/:id",
  authenticate,
  authorize("ADMIN"),
  updateVeterinario,
);
// Desactivar (borrado lógico) — ADMIN
router.patch(
  "/veterinarios/:id/desactivar",
  authenticate,
  authorize("ADMIN"),
  async (req: Request, res: Response) => {
    try {
      const r = await dbQuery(
        "UPDATE veterinarios SET activo=FALSE WHERE id_veterinario=$1 RETURNING id_veterinario, nombres, apellidos",
        [req.params.id],
      );
      if (!r.rows[0]) {
        res
          .status(404)
          .json({ success: false, message: "Veterinario no encontrado" });
        return;
      }
      ok(res, {
        message: `Veterinario "${r.rows[0].nombres} ${r.rows[0].apellidos}" desactivado`,
      });
    } catch (e) {
      logger.error(e);
      serverError(res);
    }
  },
);
// Reactivar — ADMIN
router.patch(
  "/veterinarios/:id/activar",
  authenticate,
  authorize("ADMIN"),
  async (req: Request, res: Response) => {
    try {
      const r = await dbQuery(
        "UPDATE veterinarios SET activo=TRUE WHERE id_veterinario=$1 RETURNING id_veterinario",
        [req.params.id],
      );
      if (!r.rows[0]) {
        res
          .status(404)
          .json({ success: false, message: "Veterinario no encontrado" });
        return;
      }
      ok(res, { message: "Veterinario reactivado" });
    } catch (e) {
      logger.error(e);
      serverError(res);
    }
  },
);
// Eliminar permanente — SUPERADMIN (transacción con cascada)
router.delete(
  "/veterinarios/:id",
  authenticate,
  authorize("SUPERADMIN"),
  async (req: Request, res: Response) => {
    const id = req.params.id;
    const client = await import("../config/database").then((m) =>
      m.getClient(),
    );
    try {
      await client.query("BEGIN");
      await client.query(
        `DELETE FROM tratamientos WHERE id_consulta IN (
      SELECT co.id_consulta FROM consultas co
      JOIN citas c ON c.id_cita = co.id_cita WHERE c.id_veterinario = $1)`,
        [id],
      );
      await client.query(
        `DELETE FROM facturas WHERE id_cita IN (
      SELECT id_cita FROM citas WHERE id_veterinario = $1)`,
        [id],
      );
      await client.query(
        `DELETE FROM consultas WHERE id_cita IN (
      SELECT id_cita FROM citas WHERE id_veterinario = $1)`,
        [id],
      );
      await client.query("DELETE FROM citas WHERE id_veterinario = $1", [id]);
      await client.query(
        "UPDATE usuarios SET id_veterinario = NULL WHERE id_veterinario = $1",
        [id],
      );
      const r = await client.query(
        "DELETE FROM veterinarios WHERE id_veterinario = $1 RETURNING nombres, apellidos",
        [id],
      );
      await client.query("COMMIT");
      if (!r.rows[0]) {
        res
          .status(404)
          .json({ success: false, message: "Veterinario no encontrado" });
        return;
      }
      ok(res, {
        message: `Veterinario "${r.rows[0].nombres} ${r.rows[0].apellidos}" eliminado permanentemente`,
      });
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error(e);
      serverError(res);
    } finally {
      client.release();
    }
  },
);

// ─── PROPIETARIOS ─────────────────────────────────────────────
router.get(
  "/propietarios",
  authenticate,
  authorize("CONSULTA"),
  getPropietarios,
);
router.get(
  "/propietarios/:id",
  authenticate,
  authorize("CONSULTA"),
  getPropietarioById,
);
router.post(
  "/propietarios",
  authenticate,
  authorize("ADMIN"),
  createPropietario,
);
router.put(
  "/propietarios/:id",
  authenticate,
  authorize("ADMIN"),
  updatePropietario,
);
// Desactivar (borrado lógico) — ADMIN
router.patch(
  "/propietarios/:id/desactivar",
  authenticate,
  authorize("ADMIN"),
  deletePropietario,
);
// Reactivar — ADMIN
router.patch(
  "/propietarios/:id/activar",
  authenticate,
  authorize("ADMIN"),
  reactivatePropietario,
);
// Eliminar permanente — SUPERADMIN
router.delete(
  "/propietarios/:id",
  authenticate,
  authorize("SUPERADMIN"),
  hardDeletePropietario,
);

// ─── MASCOTAS ─────────────────────────────────────────────────
router.get("/mascotas", authenticate, authorize("CONSULTA"), getMascotas);
router.get(
  "/mascotas/:id",
  authenticate,
  authorize("CONSULTA"),
  getMascotaById,
);
router.post("/mascotas", authenticate, authorize("USUARIO"), createMascota);
router.put("/mascotas/:id", authenticate, authorize("USUARIO"), updateMascota);
// Desactivar (borrado lógico) — ADMIN
router.patch(
  "/mascotas/:id/desactivar",
  authenticate,
  authorize("ADMIN"),
  deactivateMascota,
);
// Reactivar — ADMIN
router.patch(
  "/mascotas/:id/activar",
  authenticate,
  authorize("ADMIN"),
  activateMascota,
);
// Eliminar permanente — SUPERADMIN
router.delete(
  "/mascotas/:id",
  authenticate,
  authorize("SUPERADMIN"),
  hardDeleteMascota,
);

// ─── CITAS ────────────────────────────────────────────────────
router.get("/citas", authenticate, authorize("CONSULTA"), getCitas);
router.get("/citas/:id", authenticate, authorize("CONSULTA"), getCitaById);
router.post("/citas", authenticate, authorize("USUARIO"), createCita);
router.patch(
  "/citas/:id/estado",
  authenticate,
  authorize("USUARIO"),
  updateEstadoCita,
);

// ─── CONSULTAS MÉDICAS ────────────────────────────────────────
router.get(
  "/consultas/:id",
  authenticate,
  authorize("CONSULTA"),
  getConsultaById,
);
router.post("/consultas", authenticate, authorize("ADMIN"), createConsulta);

// ─── FACTURAS ─────────────────────────────────────────────────
router.get("/facturas", authenticate, authorize("CONSULTA"), getFacturas);
router.post("/facturas", authenticate, authorize("ADMIN"), createFactura);
router.put("/facturas/:id", authenticate, authorize("ADMIN"), updateFactura);
router.delete(
  "/facturas/:id",
  authenticate,
  authorize("SUPERADMIN"),
  deleteFactura,
);

// ─── MEDICAMENTOS ─────────────────────────────────────────────
router.get(
  "/medicamentos",
  authenticate,
  authorize("CONSULTA"),
  getMedicamentos,
);
router.post(
  "/medicamentos",
  authenticate,
  authorize("ADMIN"),
  createMedicamento,
);
router.put(
  "/medicamentos/:id",
  authenticate,
  authorize("ADMIN"),
  updateMedicamento,
);
router.patch(
  "/medicamentos/:id/stock",
  authenticate,
  authorize("ADMIN"),
  ajustarStock,
);
// Desactivar — ADMIN
router.patch(
  "/medicamentos/:id/desactivar",
  authenticate,
  authorize("ADMIN"),
  deleteMedicamento,
);
// Reactivar — ADMIN
router.patch(
  "/medicamentos/:id/activar",
  authenticate,
  authorize("ADMIN"),
  reactivateMedicamento,
);
// Eliminar permanente — SUPERADMIN
router.delete(
  "/medicamentos/:id",
  authenticate,
  authorize("SUPERADMIN"),
  hardDeleteMedicamento,
);

// ─── DASHBOARD / REPORTES ─────────────────────────────────────
router.get("/dashboard", authenticate, authorize("CONSULTA"), getDashboard);
router.get(
  "/reportes/ingresos-mes",
  authenticate,
  authorize("ADMIN"),
  getIngresosPorMes,
);
router.get(
  "/reportes/mascotas-especie",
  authenticate,
  authorize("CONSULTA"),
  getMascotasPorEspecie,
);
router.get(
  "/reportes/citas-veterinario",
  authenticate,
  authorize("ADMIN"),
  getCitasPorVeterinario,
);

// ─── USUARIOS (SUPERADMIN) ────────────────────────────────────
router.get("/usuarios", authenticate, authorize("SUPERADMIN"), getUsuarios);
router.post("/usuarios", authenticate, authorize("SUPERADMIN"), createUsuario);
router.put(
  "/usuarios/:id",
  authenticate,
  authorize("SUPERADMIN"),
  updateUsuario,
);
router.patch(
  "/usuarios/:id/password",
  authenticate,
  authorize("SUPERADMIN"),
  changePassword,
);
router.delete(
  "/usuarios/:id",
  authenticate,
  authorize("SUPERADMIN"),
  deleteUsuario,
);

// ─── SQL RUNNER ───────────────────────────────────────────────
router.post(
  "/sql/run",
  authenticate,
  authorize("CONSULTA"),
  async (req: Request, res: Response) => {
    const { sql } = req.body as { sql?: string };
    if (!sql?.trim()) {
      res.status(400).json({ success: false, message: "SQL requerido" });
      return;
    }
    const isSuperAdmin =
      (req as typeof req & { user?: { rol: string } }).user?.rol ===
      "SUPERADMIN";
    if (!isSuperAdmin) {
      const forbidden =
        /^\s*(drop|truncate|delete|insert|update|alter|create|grant|revoke)/i;
      if (forbidden.test(sql)) {
        res.status(403).json({
          success: false,
          message: `Operación bloqueada: '${sql.trim().split(/\s/)[0].toUpperCase()}' no está permitido. Solo SELECT.`,
        });
        return;
      }
    }
    try {
      const result = await dbQuery(sql);
      res.json({
        success: true,
        data: result.rows ?? [],
        rowsAffected: result.rowCount,
      });
    } catch (e) {
      res.status(400).json({ success: false, message: (e as Error).message });
    }
  },
);

export default router;
