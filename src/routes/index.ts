import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware';

// Controllers
import { login, getMe, register } from '../controllers/auth.controller';
import {
  getEspecialidades, createEspecialidad, updateEspecialidad, deleteEspecialidad,
  getEspecies, createEspecie, updateEspecie,
} from '../controllers/catalogs.controller';
import {
  getPropietarios, getPropietarioById, createPropietario, updatePropietario,
} from '../controllers/propietarios.controller';
import {
  getMascotas, getMascotaById, createMascota, updateMascota, deactivateMascota,
} from '../controllers/mascotas.controller';
import {
  getCitas, getCitaById, createCita, updateEstadoCita,
} from '../controllers/citas.controller';
import {
  createConsulta, getConsultaById, getFacturas, updateFactura,
} from '../controllers/consultas.controller';
import {
  getMedicamentos, createMedicamento, updateMedicamento, ajustarStock,
} from '../controllers/medicamentos.controller';
import {
  getVeterinarios, getVeterinarioById, createVeterinario, updateVeterinario,
} from '../controllers/veterinarios.controller';
import {
  getDashboard, getIngresosPorMes, getMascotasPorEspecie, getCitasPorVeterinario,
} from '../controllers/dashboard.controller';
import {
  getUsuarios, createUsuario, updateUsuario, changePassword,
} from '../controllers/usuarios.controller';

const router = Router();

// ─── AUTH (pública) ───────────────────────────────────────────
router.post('/auth/login',          login);
router.post('/auth/register',       register);
router.get ('/auth/me',  authenticate, getMe);

// ─── CATÁLOGOS (CONSULTA+) ────────────────────────────────────
router.get ('/especialidades',              authenticate, authorize('CONSULTA'), getEspecialidades);
router.post('/especialidades',              authenticate, authorize('ADMIN'),    createEspecialidad);
router.put ('/especialidades/:id',          authenticate, authorize('ADMIN'),    updateEspecialidad);
router.delete('/especialidades/:id',        authenticate, authorize('SUPERADMIN'), deleteEspecialidad);

router.get ('/especies',                    authenticate, authorize('CONSULTA'), getEspecies);
router.post('/especies',                    authenticate, authorize('ADMIN'),    createEspecie);
router.put ('/especies/:id',                authenticate, authorize('ADMIN'),    updateEspecie);

// ─── VETERINARIOS ─────────────────────────────────────────────
router.get ('/veterinarios',                authenticate, authorize('CONSULTA'), getVeterinarios);
router.get ('/veterinarios/:id',            authenticate, authorize('CONSULTA'), getVeterinarioById);
router.post('/veterinarios',                authenticate, authorize('ADMIN'),    createVeterinario);
router.put ('/veterinarios/:id',            authenticate, authorize('ADMIN'),    updateVeterinario);

// ─── PROPIETARIOS ─────────────────────────────────────────────
router.get ('/propietarios',                authenticate, authorize('CONSULTA'), getPropietarios);
router.get ('/propietarios/:id',            authenticate, authorize('CONSULTA'), getPropietarioById);
router.post('/propietarios',                authenticate, authorize('USUARIO'),  createPropietario);
router.put ('/propietarios/:id',            authenticate, authorize('USUARIO'),  updatePropietario);

// ─── MASCOTAS ─────────────────────────────────────────────────
router.get ('/mascotas',                    authenticate, authorize('CONSULTA'), getMascotas);
router.get ('/mascotas/:id',                authenticate, authorize('CONSULTA'), getMascotaById);
router.post('/mascotas',                    authenticate, authorize('USUARIO'),  createMascota);
router.put ('/mascotas/:id',                authenticate, authorize('USUARIO'),  updateMascota);
router.patch('/mascotas/:id/desactivar',    authenticate, authorize('ADMIN'),    deactivateMascota);

// ─── CITAS ────────────────────────────────────────────────────
router.get ('/citas',                       authenticate, authorize('CONSULTA'), getCitas);
router.get ('/citas/:id',                   authenticate, authorize('CONSULTA'), getCitaById);
router.post('/citas',                       authenticate, authorize('USUARIO'),  createCita);
router.patch('/citas/:id/estado',           authenticate, authorize('USUARIO'),  updateEstadoCita);

// ─── CONSULTAS MÉDICAS ────────────────────────────────────────
router.get ('/consultas/:id',               authenticate, authorize('CONSULTA'), getConsultaById);
router.post('/consultas',                   authenticate, authorize('ADMIN'),    createConsulta);

// ─── FACTURAS ─────────────────────────────────────────────────
router.get ('/facturas',                    authenticate, authorize('ADMIN'),    getFacturas);
router.put ('/facturas/:id',                authenticate, authorize('ADMIN'),    updateFactura);

// ─── MEDICAMENTOS ─────────────────────────────────────────────
router.get ('/medicamentos',                authenticate, authorize('CONSULTA'), getMedicamentos);
router.post('/medicamentos',                authenticate, authorize('ADMIN'),    createMedicamento);
router.put ('/medicamentos/:id',            authenticate, authorize('ADMIN'),    updateMedicamento);
router.patch('/medicamentos/:id/stock',     authenticate, authorize('ADMIN'),    ajustarStock);

// ─── DASHBOARD / REPORTES ─────────────────────────────────────
router.get ('/dashboard',                   authenticate, authorize('CONSULTA'), getDashboard);
router.get ('/reportes/ingresos-mes',       authenticate, authorize('ADMIN'),    getIngresosPorMes);
router.get ('/reportes/mascotas-especie',   authenticate, authorize('CONSULTA'), getMascotasPorEspecie);
router.get ('/reportes/citas-veterinario',  authenticate, authorize('ADMIN'),    getCitasPorVeterinario);

// ─── USUARIOS (SUPERADMIN) ────────────────────────────────────
router.get ('/usuarios',                    authenticate, authorize('SUPERADMIN'), getUsuarios);
router.post('/usuarios',                    authenticate, authorize('SUPERADMIN'), createUsuario);
router.put ('/usuarios/:id',                authenticate, authorize('SUPERADMIN'), updateUsuario);
router.patch('/usuarios/:id/password',      authenticate, authorize('SUPERADMIN'), changePassword);

export default router;

// ─── SQL Runner (CONSULTA+) ───────────────────────────────────
import { Request, Response } from 'express'
import { query as dbQuery } from '../config/database'

router.post('/sql/run', authenticate, authorize('CONSULTA'), async (req: Request, res: Response) => {
  const { sql } = req.body as { sql?: string }
  if (!sql?.trim()) { res.status(400).json({ success: false, message: 'SQL requerido' }); return }

  // Bloquear sentencias peligrosas
  const forbidden = /^\s*(drop|truncate|delete|insert|update|alter|create|grant|revoke)/i
  if (forbidden.test(sql)) {
    res.status(403).json({ success: false, message: 'Solo se permiten consultas SELECT' })
    return
  }
  try {
    const result = await dbQuery(sql)
    res.json({ success: true, data: result.rows })
  } catch (e) {
    res.status(400).json({ success: false, message: (e as Error).message })
  }
})
