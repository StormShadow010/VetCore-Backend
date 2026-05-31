# 🐾 VetCore — Backend

API REST desarrollada en **Node.js + TypeScript + Express**, conectada a **PostgreSQL en Render**.

---

## 📑 Tabla de contenido

1. [Tecnologías](#1-tecnologías)
2. [Estructura del proyecto](#2-estructura-del-proyecto)
3. [Instalación y ejecución](#3-instalación-y-ejecución)
4. [Variables de entorno](#4-variables-de-entorno)
5. [Migración de base de datos](#5-migración-de-base-de-datos)
6. [Sistema de autenticación](#6-sistema-de-autenticación)
7. [Roles y jerarquía](#7-roles-y-jerarquía)
8. [Endpoints completos](#8-endpoints-completos)
9. [Usuarios de prueba](#9-usuarios-de-prueba)
10. [Seguridad](#10-seguridad)

---

## 1. Tecnologías

| Herramienta        | Versión | Uso                         |
| ------------------ | ------- | --------------------------- |
| Node.js            | 20.x    | Runtime                     |
| TypeScript         | 5.x     | Tipado estático             |
| Express.js         | 4.x     | Framework HTTP              |
| pg (node-postgres) | 8.x     | Driver PostgreSQL           |
| bcrypt             | 5.x     | Hash de contraseñas         |
| jsonwebtoken       | 9.x     | Autenticación JWT           |
| helmet             | 7.x     | Cabeceras de seguridad HTTP |
| express-rate-limit | 7.x     | Rate limiting               |
| Winston            | 3.x     | Logging                     |

---

## 2. Estructura del proyecto

```
vetcore-backend/
├── src/
│   ├── config/
│   │   └── database.ts          ← Pool PostgreSQL con SSL (Render)
│   ├── controllers/
│   │   ├── auth.controller.ts       ← login, register, getMe
│   │   ├── mascotas.controller.ts   ← CRUD + activar/desactivar + hardDelete
│   │   ├── propietarios.controller.ts
│   │   ├── veterinarios.controller.ts
│   │   ├── citas.controller.ts
│   │   ├── consultas.controller.ts  ← consultas médicas + facturas
│   │   ├── medicamentos.controller.ts
│   │   ├── catalogs.controller.ts   ← especialidades + especies
│   │   ├── dashboard.controller.ts
│   │   └── usuarios.controller.ts
│   ├── middlewares/
│   │   ├── auth.middleware.ts    ← authenticate + authorize(rol)
│   │   └── error.middleware.ts
│   ├── routes/
│   │   └── index.ts              ← todas las rutas con permisos
│   ├── types/
│   │   └── index.ts              ← interfaces TypeScript
│   ├── utils/
│   │   ├── jwt.ts
│   │   ├── logger.ts             ← Winston
│   │   └── response.ts           ← helpers ok, created, notFound, serverError
│   ├── app.ts                    ← Express: CORS, Helmet, rate limit, rutas
│   └── index.ts                  ← entry point
├── sql_migration.sql             ← ⚠ ejecutar en TablePlus antes de iniciar
├── .env
├── package.json
└── tsconfig.json
```

---

## 3. Instalación y ejecución

```bash
cd vetcore-backend
npm install

# Desarrollo con hot-reload
npm run dev

# Compilar TypeScript
npm run build

# Producción
npm start
```

Al iniciar correctamente verás:

```
✅ Conexión a PostgreSQL establecida
🚀 VetCore API corriendo en puerto 5000 [development]
```

---

## 4. Variables de entorno

Crear `.env` en la raíz del proyecto:

```env
DATABASE_URL=postgresql://vetcore_db_user:PASSWORD@host/vetcore_db
JWT_SECRET=vetcore_super_secreto_2024
JWT_EXPIRES_IN=8h
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

> Si el frontend corre en un puerto diferente al 5173, actualizar `CORS_ORIGIN`.

---

## 5. Migración de base de datos

Ejecutar **una sola vez** en TablePlus antes de iniciar el backend:

```sql
-- Agregar columna activo a propietarios
ALTER TABLE propietarios ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;

-- Actualizar contraseñas de demo (hash de "password")
UPDATE usuarios
SET password_hash = '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'
WHERE username IN ('superadmin', 'admin', 'dr_ana', 'usuario', 'consulta');
```

El archivo `sql_migration.sql` incluido en el proyecto contiene estos mismos comandos.

---

## 6. Sistema de autenticación

- JWT firmado con HS256, expira en 8 horas
- Contraseñas hasheadas con bcrypt (salt factor 10)
- El token se envía en el header: `Authorization: Bearer <token>`
- El payload del JWT contiene: `{ sub: id_usuario, rol, username, email }`

---

## 7. Roles y jerarquía

Los roles son jerárquicos — cada nivel hereda los permisos del nivel inferior.

| Nivel | Rol          | Descripción                                               |
| ----- | ------------ | --------------------------------------------------------- |
| 4     | `SUPERADMIN` | Dueño: acceso total, elimina permanentemente de la BD     |
| 3     | `ADMIN`      | Auxiliar/secretario: CRUD operativo, desactiva registros  |
| 2     | `USUARIO`    | Cliente registrado: gestiona sus propias mascotas y citas |
| 1     | `CONSULTA`   | Solo lectura de toda la información                       |

El middleware `authorize('ADMIN')` permite el acceso a ADMIN, SUPERADMIN (y los niveles superiores). Para requerir un rol exacto se combina con lógica adicional en el controller.

---

## 8. Endpoints completos

**Base URL:** `http://localhost:5000/api/v1`

### Autenticación

| Método | Ruta             | Descripción                                               | Acceso    |
| ------ | ---------------- | --------------------------------------------------------- | --------- |
| `POST` | `/auth/login`    | Iniciar sesión, retorna JWT                               | Público   |
| `POST` | `/auth/register` | Crear cuenta (crea usuario + propietario automáticamente) | Público   |
| `GET`  | `/auth/me`       | Datos del usuario autenticado                             | CONSULTA+ |

### Especialidades

| Método   | Ruta                  | Descripción         | Rol        |
| -------- | --------------------- | ------------------- | ---------- |
| `GET`    | `/especialidades`     | Listar              | CONSULTA+  |
| `POST`   | `/especialidades`     | Crear               | ADMIN+     |
| `PUT`    | `/especialidades/:id` | Editar              | ADMIN+     |
| `DELETE` | `/especialidades/:id` | Eliminar permanente | SUPERADMIN |

### Especies

| Método   | Ruta            | Descripción         | Rol        |
| -------- | --------------- | ------------------- | ---------- |
| `GET`    | `/especies`     | Listar              | CONSULTA+  |
| `POST`   | `/especies`     | Crear               | ADMIN+     |
| `PUT`    | `/especies/:id` | Editar              | ADMIN+     |
| `DELETE` | `/especies/:id` | Eliminar permanente | SUPERADMIN |

### Veterinarios

| Método   | Ruta                           | Descripción                         | Rol        |
| -------- | ------------------------------ | ----------------------------------- | ---------- |
| `GET`    | `/veterinarios`                | Listar (`?activo=true/false/todas`) | CONSULTA+  |
| `GET`    | `/veterinarios/:id`            | Detalle                             | CONSULTA+  |
| `POST`   | `/veterinarios`                | Crear                               | ADMIN+     |
| `PUT`    | `/veterinarios/:id`            | Editar                              | ADMIN+     |
| `PATCH`  | `/veterinarios/:id/desactivar` | Borrado lógico                      | ADMIN+     |
| `PATCH`  | `/veterinarios/:id/activar`    | Reactivar                           | ADMIN+     |
| `DELETE` | `/veterinarios/:id`            | Eliminar permanente con cascada     | SUPERADMIN |

### Propietarios

| Método   | Ruta                           | Descripción                         | Rol        |
| -------- | ------------------------------ | ----------------------------------- | ---------- |
| `GET`    | `/propietarios`                | Listar (`?activo=true/false/todas`) | CONSULTA+  |
| `GET`    | `/propietarios/:id`            | Detalle con mascotas                | CONSULTA+  |
| `POST`   | `/propietarios`                | Crear                               | ADMIN+     |
| `PUT`    | `/propietarios/:id`            | Editar                              | ADMIN+     |
| `PATCH`  | `/propietarios/:id/desactivar` | Borrado lógico                      | ADMIN+     |
| `PATCH`  | `/propietarios/:id/activar`    | Reactivar                           | ADMIN+     |
| `DELETE` | `/propietarios/:id`            | Eliminar permanente con cascada     | SUPERADMIN |

### Mascotas

| Método   | Ruta                       | Descripción                                           | Rol        |
| -------- | -------------------------- | ----------------------------------------------------- | ---------- |
| `GET`    | `/mascotas`                | Listar (`?activa=true/false/todas&mis_mascotas=true`) | CONSULTA+  |
| `GET`    | `/mascotas/:id`            | Detalle + historial de citas                          | CONSULTA+  |
| `POST`   | `/mascotas`                | Crear (USUARIO: auto-asigna su propietario)           | USUARIO+   |
| `PUT`    | `/mascotas/:id`            | Editar                                                | USUARIO+   |
| `PATCH`  | `/mascotas/:id/desactivar` | Borrado lógico                                        | ADMIN+     |
| `PATCH`  | `/mascotas/:id/activar`    | Reactivar                                             | ADMIN+     |
| `DELETE` | `/mascotas/:id`            | Eliminar permanente con cascada                       | SUPERADMIN |

> `mis_mascotas=true` filtra por el propietario vinculado al email del usuario autenticado.

### Citas

| Método  | Ruta                | Descripción                        | Rol       |
| ------- | ------------------- | ---------------------------------- | --------- |
| `GET`   | `/citas`            | Listar (`?estado=&mis_citas=true`) | CONSULTA+ |
| `GET`   | `/citas/:id`        | Detalle + consulta + factura       | CONSULTA+ |
| `POST`  | `/citas`            | Agendar nueva cita                 | USUARIO+  |
| `PATCH` | `/citas/:id/estado` | Cambiar estado                     | USUARIO+  |

> `mis_citas=true` filtra las citas de las mascotas del propietario vinculado al usuario.

### Consultas médicas

| Método | Ruta             | Descripción                                                                           | Rol       |
| ------ | ---------------- | ------------------------------------------------------------------------------------- | --------- |
| `GET`  | `/consultas/:id` | Ver consulta con tratamientos                                                         | CONSULTA+ |
| `POST` | `/consultas`     | Crear consulta (transacción: crea consulta + tratamientos + factura + actualiza cita) | ADMIN+    |

### Facturas

| Método   | Ruta            | Descripción                      | Rol        |
| -------- | --------------- | -------------------------------- | ---------- |
| `GET`    | `/facturas`     | Listar todas                     | CONSULTA+  |
| `POST`   | `/facturas`     | Crear factura manual             | ADMIN+     |
| `PUT`    | `/facturas/:id` | Editar (descuento, pago, método) | ADMIN+     |
| `DELETE` | `/facturas/:id` | Eliminar permanente              | SUPERADMIN |

### Medicamentos

| Método   | Ruta                           | Descripción                         | Rol        |
| -------- | ------------------------------ | ----------------------------------- | ---------- |
| `GET`    | `/medicamentos`                | Listar (`?activo=true/false/todas`) | CONSULTA+  |
| `POST`   | `/medicamentos`                | Crear                               | ADMIN+     |
| `PUT`    | `/medicamentos/:id`            | Editar                              | ADMIN+     |
| `PATCH`  | `/medicamentos/:id/stock`      | Ajustar stock                       | ADMIN+     |
| `PATCH`  | `/medicamentos/:id/desactivar` | Borrado lógico                      | ADMIN+     |
| `PATCH`  | `/medicamentos/:id/activar`    | Reactivar                           | ADMIN+     |
| `DELETE` | `/medicamentos/:id`            | Eliminar permanente                 | SUPERADMIN |

### Dashboard y reportes

| Método | Ruta                          | Descripción                                         | Rol       |
| ------ | ----------------------------- | --------------------------------------------------- | --------- |
| `GET`  | `/dashboard`                  | Estadísticas (filtradas por usuario si rol=USUARIO) | CONSULTA+ |
| `GET`  | `/reportes/ingresos-mes`      | Ingresos por mes                                    | ADMIN+    |
| `GET`  | `/reportes/mascotas-especie`  | Mascotas por especie                                | CONSULTA+ |
| `GET`  | `/reportes/citas-veterinario` | Citas por veterinario                               | ADMIN+    |

### Usuarios

| Método   | Ruta                     | Descripción         | Rol        |
| -------- | ------------------------ | ------------------- | ---------- |
| `GET`    | `/usuarios`              | Listar              | SUPERADMIN |
| `POST`   | `/usuarios`              | Crear               | SUPERADMIN |
| `PUT`    | `/usuarios/:id`          | Editar rol y estado | SUPERADMIN |
| `PATCH`  | `/usuarios/:id/password` | Cambiar contraseña  | SUPERADMIN |
| `DELETE` | `/usuarios/:id`          | Eliminar permanente | SUPERADMIN |

### SQL Runner

| Método | Ruta       | Descripción           | Rol       |
| ------ | ---------- | --------------------- | --------- |
| `POST` | `/sql/run` | Ejecutar consulta SQL | CONSULTA+ |

> SUPERADMIN puede ejecutar cualquier sentencia (SELECT, INSERT, UPDATE, DELETE, DROP). Los demás roles solo pueden ejecutar SELECT.

---

## 9. Usuarios de prueba

Contraseña para todos: `password`

| Username     | Rol        | Descripción                            |
| ------------ | ---------- | -------------------------------------- |
| `superadmin` | SUPERADMIN | Acceso total, gestión de usuarios      |
| `admin`      | ADMIN      | CRUD operativo, facturas               |
| `dr_ana`     | ADMIN      | CRUD operativo (veterinaria vinculada) |
| `usuario`    | USUARIO    | Solo sus mascotas y sus citas          |
| `consulta`   | CONSULTA   | Solo lectura y SQL                     |

---

## 10. Seguridad

| Característica         | Implementación                                                                   |
| ---------------------- | -------------------------------------------------------------------------------- |
| Autenticación          | JWT HS256, expira en 8h                                                          |
| Contraseñas            | bcrypt con salt factor 10                                                        |
| Autorización           | Middleware jerárquico por rol                                                    |
| SSL/TLS                | Conexión PostgreSQL con `rejectUnauthorized: false` (Render)                     |
| Rate limiting          | 200 peticiones por IP cada 15 minutos                                            |
| Cabeceras HTTP         | Helmet.js                                                                        |
| CORS                   | Origen configurado en `.env`                                                     |
| Borrado lógico         | Columnas `activo`/`activa` en mascotas, propietarios, veterinarios, medicamentos |
| Eliminación permanente | Solo SUPERADMIN, con cascada en transacción `BEGIN/COMMIT/ROLLBACK`              |
| SQL parametrizado      | Todas las queries usan `$1, $2…` (prevención de SQL injection)                   |
| SQL Runner restringido | Solo SELECT para roles distintos de SUPERADMIN                                   |

---

_VetCore Backend — ETITC Facultad de Sistemas — Bogotá, mayo 2026_
