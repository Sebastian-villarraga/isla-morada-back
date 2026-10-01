# Isla Morada Backend

API modular para reservas del restaurante Isla Morada. El backend es la fuente de verdad para disponibilidad, capacidad, códigos, estados y trazabilidad. El cliente no necesita una cuenta. Excel continúa en paralelo; no hay sincronización automática.

## Stack y arquitectura

- Node.js, NestJS y TypeScript
- PostgreSQL 16 y Prisma ORM
- JWT, bcrypt, class-validator y class-transformer
- Swagger en `/api/docs`
- Nodemailer con canal EMAIL
- Jest, ESLint, Prettier y pnpm

Los controllers validan y delegan; los services aplican reglas de negocio; `PrismaService` centraliza el acceso a PostgreSQL. Los módulos principales son Auth, Users, Customers, OperatingDays, Schedules, Reservations, Waitlist, Notifications, Audit, Settings y Prisma.

## Requisitos e instalación

Requisitos: Node.js 20.11 o posterior, pnpm 9.15.4 y Docker Desktop con Compose.

```powershell
Copy-Item .env.example .env
docker compose up -d
pnpm install
pnpm exec prisma generate
pnpm exec prisma migrate dev
pnpm exec prisma db seed
pnpm start:dev
```

El Compose publica PostgreSQL en `localhost:5433` por defecto, porque `5432` puede estar ocupado. Se puede cambiar con `POSTGRES_PORT`. Si no se usa pnpm, npm también funciona: `npm install`, `npm run start:dev`, `npm test`, `npm run test:e2e`, `npm run lint` y `npm run build`.

Configura `.env` antes de iniciar la API. No guardes ese archivo en Git. `JWT_SECRET` debe ser una clave aleatoria propia de al menos 32 caracteres; SMTP es opcional para desarrollo y obligatorio para enviar correos.

## Prisma y datos de desarrollo

```powershell
pnpm exec prisma generate
pnpm exec prisma migrate dev
pnpm exec prisma db seed
```

El seed es idempotente y se niega a correr con `NODE_ENV=production`. Crea tres cuentas de desarrollo:

| Rol | Correo | Contraseña local |
|---|---|---|
| ADMIN | `admin@islamorada.local` | `DevelopmentAdmin123!` |
| RESERVAS | `reservas@islamorada.local` | `DevelopmentReservas123!` |
| HOST | `host@islamorada.local` | `DevelopmentHost123!` |

Estas credenciales son únicamente para desarrollo; cámbialas antes de cualquier despliegue. El seed crea configuración con tolerancia de 25 minutos, capacidad inicial de 200 PAX y zona `America/Bogota`, más días/horarios de ejemplo.

## API

El prefijo global de la API es `/api`. Swagger: `http://localhost:3001/api/docs`.
Con el frontend local en el puerto 3000, configura `PORT=3001` y `FRONTEND_URL=http://localhost:3000,...` en `.env`.

| Grupo | Rutas principales | Acceso |
|---|---|---|
| Auth | `POST /auth/login`, `GET /auth/me` | Login público; `/me` autenticado |
| Users | `GET/POST /users`, `GET/PATCH /users/:id`, `PATCH /users/:id/status` | ADMIN |
| Customers | `GET /customers`, `GET /customers/:id` | ADMIN, RESERVAS, HOST |
| Operating days | `GET/POST /operating-days`, `GET/PATCH /operating-days/:id` | ADMIN, RESERVAS |
| Schedules | `GET/POST /schedules`, `GET/PATCH /schedules/:id`, `PATCH /schedules/:id/open`, `PATCH /schedules/:id/close` | ADMIN, RESERVAS |
| Calendar | `GET /availability/dates` | Público; devuelve un array de strings `YYYY-MM-DD`, solo días OPEN desde hoy en Bogotá, orden ascendente |
| Availability | `GET /availability?date=YYYY-MM-DD&pax=4` | Público; horarios abiertos, capacidad y PAX disponibles, sin datos de clientes |
| Reservations | `POST /reservations`, `GET /reservations/:id` | Público; creación devuelve ID/código/estado/fecha/hora/PAX; GET de confirmación solo devuelve esos campos públicos |
| Reservation operations | `GET /reservations`, `/reservations/today`, `GET /reservations/:id/internal`, `PATCH /reservations/:id`, `PATCH /reservations/:id/cancel`, `POST /reservations/:id/{arrival,entry,lost,notify-availability}` | Host/Reservas/Admin según operación |
| Waitlist | `GET/POST /waitlist`, `GET/PATCH /waitlist/:id`, `POST /waitlist/:id/notify`, `PATCH /waitlist/:id/cancel` | HOST, RESERVAS, ADMIN |
| Settings | `GET/PATCH /settings` | ADMIN |
| Audit | `GET /audit-logs` | ADMIN |
| Notifications | `GET /notifications`, `POST /notifications/:id/retry` | ADMIN, RESERVAS |

`GET /reservations/:id` es público para recuperar la confirmación; no incluye nombre, teléfono, email, observaciones ni historial.

### CORS

`FRONTEND_URL` acepta una lista separada por comas de orígenes exactos: por ejemplo `http://localhost:3000,https://tu-dominio.vercel.app,https://preview-aprobado.vercel.app`. Incluye explícitamente cada preview de Vercel que quieras autorizar; no se aceptan comodines en producción. Las solicitudes sin encabezado `Origin` (por ejemplo, llamadas de servidor a servidor) no usan CORS como mecanismo de autenticación.

Errores HTTP documentados para las rutas públicas: `400` validación/fecha o UUID inválido, `404` día/horario/reserva inexistente, `409` día u horario cerrado o capacidad agotada (`SCHEDULE_CAPACITY_EXCEEDED`), y `500` error interno. La capacidad se vuelve a validar transaccionalmente al crear la reserva.

Los endpoints internos usan JWT Bearer. HOST no puede administrar usuarios, roles ni settings. Los DTOs rechazan campos desconocidos y validan UUID, email, teléfono, PAX, fechas y estados.

## Reglas de negocio

- El restaurante abre solo en `OperatingDay` configurados explícitamente; no se infiere apertura por día de semana.
- Cada día tiene un prefijo alfabético asignado por Administración/Reservas. Se permiten de una a cuatro letras para no agotar los prefijos de un solo carácter; los prefijos no se reutilizan mientras el código tenga unicidad global.
- El backend construye el código `prefijo + secuencia`. La secuencia avanza por día operativo, no por horario. `code` es único y `(codeOperatingDayId, sequenceNumber)` también lo es. Cambiar fecha/horario conserva el código original.
- Capacidad significa personas. CONFIRMED, ARRIVED y ENTERED consumen PAX; CANCELLED y LOST no. La capacidad inicial de cada horario viene de `RestaurantSettings.defaultScheduleCapacity` (200) y puede ser configurada.
- La creación bloquea la fila de `OperatingDay` y luego `Schedule` con `SELECT ... FOR UPDATE` dentro de una transacción PostgreSQL. El mismo lock de día serializa la secuencia global y la comprobación/consumo de capacidad, incluso entre horarios. La restricción UNIQUE es una segunda barrera contra códigos duplicados. Modificaciones bloquean días en orden estable y la reserva afectada.
- Disponibilidad es informativa; `POST /reservations` vuelve a validar y responde 409 si ya no hay capacidad.
- Transiciones permitidas: CONFIRMED → ARRIVED → ENTERED; CONFIRMED → CANCELLED; CONFIRMED → LOST. Las reservas se conservan y se registran historial/auditoría.
- Tolerancia inicial 25 minutos, configurable. Superarla no cambia el estado automáticamente. HOST/RESERVAS/ADMIN decide cuándo marcar LOST. Una reserva LOST conserva llegada, teléfono, observación, usuario y momento, y deja de consumir capacidad.
- Waitlist es independiente de LOST. Su hora de llegada es del servidor; solo pasa a NOTIFIED si el email se envió correctamente.
- El email se registra como PENDING/SENT/FAILED. Un fallo SMTP no revierte la reserva. Reintentos: `POST /notifications/:id/retry`.
- Rate limiting en memoria: login 10 solicitudes/minuto por IP y disponibilidad/creación pública 60/minuto por IP y ruta. En despliegues con varias réplicas debe sustituirse por un limitador compartido.

## Fechas, zona y emails

Las fechas operativas son `DATE` de PostgreSQL y se conservan como calendario local, sin desplazarlas al serializar. Los horarios se guardan como `HH:mm`; para cálculos se interpretan en `America/Bogota` (UTC−05:00). Timestamps de llegada, ingreso, pérdida, auditoría y creación son `timestamptz` y se guardan como instantes UTC.

Los cinco templates HTML están en `src/notifications/templates`. El build Nest los copia a `dist/notifications/templates`. SMTP se configura con `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` y `SMTP_FROM`.

## Calidad y comprobaciones

```powershell
pnpm test
pnpm run test:e2e
pnpm lint
pnpm build
pnpm exec prisma validate
```

El e2e de concurrencia requiere PostgreSQL accesible mediante `DATABASE_URL`; prueba dos solicitudes que compiten por los últimos 5 PAX y diez reservas simultáneas distribuidas en distintos horarios del mismo día.

## Fuera del MVP

No incluye integración Excel, WhatsApp, llamadas automáticas, pagos, mesas, eventos, CRM, promociones, inventario ni delivery. El canal de notificación queda desacoplado para ampliar canales después, pero solo EMAIL está implementado.