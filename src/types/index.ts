// ─── Enums (espejo de los tipos PostgreSQL) ──────────────────
export type RolUsuario      = 'SUPERADMIN' | 'ADMIN' | 'USUARIO' | 'CONSULTA';
export type EstadoCita      = 'PENDIENTE'  | 'ATENDIDA' | 'CANCELADA' | 'NO_ASISTIO';
export type MetodoPago      = 'EFECTIVO'   | 'TARJETA' | 'TRANSFERENCIA' | 'NEQUI';
export type SexoTipo        = 'M' | 'F';

// ─── Entidades ────────────────────────────────────────────────
export interface Usuario {
  id_usuario:     number;
  username:       string;
  email:          string;
  password_hash:  string;
  rol:            RolUsuario;
  id_veterinario: number | null;
  activo:         boolean;
  creado_en:      Date;
}

export interface Veterinario {
  id_veterinario:  number;
  cedula:          string;
  nombres:         string;
  apellidos:       string;
  telefono:        string | null;
  email:           string;
  id_especialidad: number;
  activo:          boolean;
  fecha_ingreso:   Date;
}

export interface Especie {
  id_especie:  number;
  nombre:      string;
  descripcion: string | null;
}

export interface Especialidad {
  id_especialidad: number;
  nombre:          string;
  descripcion:     string | null;
}

export interface Propietario {
  id_propietario: number;
  cedula:         string;
  nombres:        string;
  apellidos:      string;
  telefono:       string | null;
  email:          string | null;
  direccion:      string | null;
  ciudad:         string | null;
  fecha_registro: Date;
}

export interface Mascota {
  id_mascota:     number;
  nombre:         string;
  id_especie:     number;
  raza:           string | null;
  sexo:           SexoTipo;
  fecha_nac:      Date | null;
  peso_kg:        number | null;
  color:          string | null;
  id_propietario: number;
  activa:         boolean;
}

export interface Cita {
  id_cita:        number;
  id_mascota:     number;
  id_veterinario: number;
  fecha_hora:     Date;
  motivo:         string | null;
  estado:         EstadoCita;
  observaciones:  string | null;
}

export interface Consulta {
  id_consulta:    number;
  id_cita:        number;
  diagnostico:    string | null;
  sintomas:       string | null;
  temperatura:    number | null;
  peso_consulta:  number | null;
  proxima_cita:   Date | null;
  costo_consulta: number;
}

export interface Medicamento {
  id_medicamento: number;
  nombre:         string;
  principio_act:  string | null;
  presentacion:   string | null;
  stock:          number;
  precio_unit:    number;
  activo:         boolean;
}

export interface Tratamiento {
  id_tratamiento: number;
  id_consulta:    number;
  id_medicamento: number;
  dosis:          string | null;
  frecuencia:     string | null;
  duracion_dias:  number | null;
  cantidad:       number | null;
}

export interface Factura {
  id_factura:    number;
  id_cita:       number;
  fecha_emision: Date;
  subtotal:      number;
  descuento_pct: number;
  total:         number;
  pagado:        boolean;
  metodo_pago:   MetodoPago | null;
}

// ─── JWT Payload ──────────────────────────────────────────────
export interface JwtPayload {
  sub:      number;   // id_usuario
  username: string;
  rol:      RolUsuario;
  iat?:     number;
  exp?:     number;
}

// ─── Express Request extendido ────────────────────────────────
import { Request } from 'express';
export interface AuthRequest extends Request {
  user?: JwtPayload;
}

// ─── Respuesta estándar de la API ────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?:   T;
  message?: string;
  errors?: string[];
  meta?: {
    total?: number;
    page?:  number;
    limit?: number;
  };
}
