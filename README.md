# LMS Simulator Backend

Backend sencillo en `Node.js + Express` para simular un LMS con persistencia en Supabase Postgres.

## Qué incluye

- CRUD de usuarios LMS
- CRUD de cursos
- Gestión de matrículas (`enrollments`)
- Auditoría básica de eventos
- Validación de entrada y manejo centralizado de errores

## Requisitos

- Node.js 20+ (probado con Node 24)
- Un proyecto de Supabase
- La cadena `DATABASE_URL` de tu base Postgres de Supabase

## Instalación

```bash
npm install
copy .env.example .env
```

Llena `DATABASE_URL` en `.env`.

## Base de datos

Tienes dos opciones:

1. Automática: deja `AUTO_RUN_SCHEMA=true` y el servidor creará las tablas al iniciar.
2. Manual: corre el contenido de [sql/schema.sql](/C:/Users/DanielVera/Documents/Test/test2/sql/schema.sql) en el SQL Editor de Supabase y usa `AUTO_RUN_SCHEMA=false`.

## Ejecutar

```bash
npm run dev
```

o

```bash
npm start
```

## Endpoints principales

- `GET /health`
- `POST /api/users`
- `GET /api/users`
- `GET /api/users/:userId`
- `PATCH /api/users/:userId`
- `DELETE /api/users/:userId`
- `POST /api/courses`
- `GET /api/courses`
- `GET /api/courses/:courseId`
- `PATCH /api/courses/:courseId`
- `DELETE /api/courses/:courseId`
- `POST /api/enrollments`
- `GET /api/enrollments`
- `GET /api/enrollments/:enrollmentId`
- `PATCH /api/enrollments/:enrollmentId`
- `DELETE /api/enrollments/:enrollmentId`
- `GET /api/audit-logs`

## Ejemplo rápido

Crear usuario:

```bash
curl -X POST http://localhost:3000/api/users ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"student1@example.com\",\"firstName\":\"Ana\",\"lastName\":\"Gomez\",\"contactType\":\"student\"}"
```

Crear curso:

```bash
curl -X POST http://localhost:3000/api/courses ^
  -H "Content-Type: application/json" ^
  -d "{\"courseCode\":\"ENG-101\",\"title\":\"English 101\"}"
```

Matricular:

```bash
curl -X POST http://localhost:3000/api/enrollments ^
  -H "Content-Type: application/json" ^
  -d "{\"userId\":\"USER_UUID\",\"courseId\":\"COURSE_UUID\"}"
```

## Notas de diseño

- `contact_type` permite distinguir alumnos de contactos de marketing.
- Los `DELETE` son lógicos: se archivan usuarios/cursos o se cancela la matrícula.
- La tabla `audit_logs` deja trazabilidad básica para soporte y monitoreo.
