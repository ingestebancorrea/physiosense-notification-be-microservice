# PhysioSense Notification Backend Microservice

Microservicio de notificaciones para PhysioSense que soporta múltiples canales:
- **Push Notifications** (Firebase Cloud Messaging / APNs)
- **Email** (SMTP - Gmail, SendGrid, Mailgun, etc.)
- **SMS** (Twilio)
- **In-App** (Base de datos, consultables via API)

## 🚀 Inicio Rápido

### Prerrequisitos
- Node.js 18+
- PostgreSQL 14+ (o Supabase)
- Cuenta Firebase (para push)
- Cuenta SMTP (para email)
- Cuenta Twilio (para SMS, opcional)

### Instalación

```bash
# 1. Clonar/entrar al directorio
cd physiosense-notification-be-microservice

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# 4. Ejecutar migraciones / crear tablas
# Opción A: Usar el script SQL directamente en Supabase/PostgreSQL
psql -d physiosense_notifications -f database-schema.sql

# Opción B: Usar TypeORM synchronize (solo desarrollo)
# Configurar synchronize: true en app.module.ts temporalmente

# 5. Iniciar en desarrollo
npm run start:dev
```

El servidor estará en `http://localhost:3002`
- API: `http://localhost:3002/api/v1`
- Swagger Docs: `http://localhost:3002/api/docs`

## 📁 Estructura del Proyecto

```
src/
├── main.ts                    # Entry point
├── app.module.ts              # Módulo principal
├── common/
│   └── enums/
│       └── notification.enums.ts   # Enums compartidos
├── notifications/             # Módulo de notificaciones
│   ├── entities/
│   │   ├── notification.entity.ts
│   │   └── notification-template.entity.ts
│   ├── dto/
│   │   └── create-notification.dto.ts
│   ├── notifications.service.ts
│   ├── notifications.controller.ts
│   └── notifications.module.ts
├── devices/                   # Módulo de device tokens (FCM/APNs)
│   ├── entities/
│   │   └── device-token.entity.ts
│   ├── dto/
│   │   └── register-device.dto.ts
│   ├── devices.service.ts
│   ├── devices.controller.ts
│   └── devices.module.ts
├── preferences/               # Módulo de preferencias de usuario
│   ├── entities/
│   │   └── notification-preference.entity.ts
│   ├── dto/
│   │   └── update-preferences.dto.ts
│   ├── preferences.service.ts
│   ├── preferences.controller.ts
│   └── preferences.module.ts
└── channels/                  # Servicios de envío por canal
    ├── services/
    │   ├── push-notification.service.ts   # Firebase
    │   ├── email-notification.service.ts  # Nodemailer
    │   ├── sms-notification.service.ts    # Twilio
    │   ├── in-app-notification.service.ts # Base de datos
    │   └── notification-dispatcher.service.ts # Orquestador
    └── channels.module.ts
```

## 📡 API Endpoints

### Notificaciones
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/v1/notifications` | Crear y enviar notificación |
| POST | `/api/v1/notifications/bulk` | Enviar a múltiples usuarios |
| POST | `/api/v1/notifications/topic/:topic` | Enviar a topic FCM |
| GET | `/api/v1/notifications` | Listar notificaciones (con filtros) |
| GET | `/api/v1/notifications/stats` | Estadísticas de usuario |
| GET | `/api/v1/notifications/:id` | Obtener notificación |
| PATCH | `/api/v1/notifications/:id/read` | Marcar como leída |
| PATCH | `/api/v1/notifications/read-all` | Marcar todas como leídas |
| DELETE | `/api/v1/notifications/:id` | Eliminar notificación |

### Plantillas
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/v1/notifications/templates` | Crear plantilla |
| GET | `/api/v1/notifications/templates` | Listar plantillas |
| PATCH | `/api/v1/notifications/templates/:id` | Actualizar plantilla |
| DELETE | `/api/v1/notifications/templates/:id` | Eliminar plantilla |

### Device Tokens
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/v1/devices/register` | Registrar device token |
| POST | `/api/v1/devices/unregister` | Desregistrar token |
| POST | `/api/v1/devices/unregister-all` | Desregistrar todos |
| GET | `/api/v1/devices` | Listar dispositivos de usuario |
| GET | `/api/v1/devices/stats` | Estadísticas por plataforma |
| POST | `/api/v1/devices/cleanup` | Limpiar tokens inactivos |

### Preferencias
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/preferences` | Obtener preferencias |
| GET | `/api/v1/preferences/effective` | Preferencias efectivas (con defaults) |
| PUT | `/api/v1/preferences` | Actualizar preferencias (bulk) |
| PATCH | `/api/v1/preferences/:channel` | Actualizar preferencia individual |
| DELETE | `/api/v1/preferences` | Resetear a defaults |

## 📝 Ejemplos de Uso

### Enviar notificación simple
```bash
curl -X POST http://localhost:3002/api/v1/notifications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "userId": "uuid-del-usuario",
    "title": "Nueva cita",
    "body": "Tu cita ha sido confirmada para mañana a las 10:00 AM",
    "channel": "PUSH",
    "priority": "HIGH",
    "data": { "appointmentId": "apt-123" },
    "actionUrl": "physiosense://appointments/apt-123"
  }'
```

### Enviar usando plantilla
```bash
curl -X POST http://localhost:3002/api/v1/notifications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "userId": "uuid-del-usuario",
    "templateId": "appointment_confirmed",
    "templateData": {
      "doctorName": "Dr. Pérez",
      "date": "2024-12-15",
      "time": "10:00 AM"
    },
    "priority": "HIGH"
  }'
```

### Registrar device token (desde app móvil)
```bash
curl -X POST http://localhost:3002/api/v1/devices/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer USER_JWT_TOKEN" \
  -d '{
    "userId": "uuid-del-usuario",
    "token": "fcm-token-from-device",
    "platform": "ANDROID",
    "appVersion": "1.2.3",
    "deviceModel": "Pixel 8",
    "osVersion": "Android 14"
  }'
```

### Actualizar preferencias
```bash
curl -X PUT http://localhost:3002/api/v1/preferences?userId=uuid-del-usuario \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "preferences": [
      { "channel": "PUSH", "enabled": true },
      { "channel": "EMAIL", "enabled": true },
      { "channel": "SMS", "enabled": false },
      { "channel": "IN_APP", "enabled": true },
      { "channel": "PUSH", "category": "marketing", "enabled": false }
    ]
  }'
```

## 🔧 Configuración por Canal

### Firebase (Push)
1. Crear proyecto en [Firebase Console](https://console.firebase.google.com)
2. Generar Service Account Key (Project Settings > Service Accounts)
3. Configurar en `.env`:
   ```env
   FIREBASE_PROJECT_ID=tu-project-id
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@tu-project.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nTU_KEY\n-----END PRIVATE KEY-----\n"
   ```

### Email (SMTP)
Configurar en `.env`:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-app-password  # No uses tu password real, usa App Password
SMTP_FROM=PhysioSense <noreply@physiosense.com>
```

### SMS (Twilio)
```env
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxx
TWILIO_FROM_NUMBER=+15551234567
```

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage
npm run test:cov
```

## 📦 Build para Producción

```bash
npm run build
npm run start:prod
```

## 🔐 Variables de Entorno Requeridas

| Variable | Descripción | Requerida |
|----------|-------------|-----------|
| `DATABASE_URL` | URL conexión PostgreSQL | ✅ |
| `JWT_SECRET` | Secreto para validar JWT | ✅ |
| `FIREBASE_PROJECT_ID` | ID proyecto Firebase | Para push |
| `FIREBASE_CLIENT_EMAIL` | Email service account | Para push |
| `FIREBASE_PRIVATE_KEY` | Private key Firebase | Para push |
| `SMTP_HOST` | Host SMTP | Para email |
| `SMTP_PORT` | Puerto SMTP | Para email |
| `SMTP_USER` | Usuario SMTP | Para email |
| `SMTP_PASS` | Password SMTP | Para email |
| `TWILIO_ACCOUNT_SID` | Account SID Twilio | Para SMS |
| `TWILIO_AUTH_TOKEN` | Auth Token Twilio | Para SMS |
| `TWILIO_FROM_NUMBER` | Número remitente | Para SMS |

## 📋 Base de Datos

Ejecuta `database-schema.sql` en tu PostgreSQL/Supabase. Incluye:
- Tablas: `notifications`, `device_tokens`, `notification_preferences`, `notification_templates`
- Enums tipados para type-safety
- Índices optimizados para consultas frecuentes
- Triggers para `updated_at`
- Row Level Security policies (Supabase)
- Plantillas por defecto

## 🏗️ Arquitectura

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Cliente App   │────▶│  API Gateway     │────▶│ Notification    │
│   (Mobile/Web)  │     │  (Auth Validate) │     │ Service         │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                        ┌─────────────────────────────────┼─────────────────────────────────┐
                        ▼                                 ▼                                 ▼
               ┌─────────────────┐              ┌─────────────────┐              ┌─────────────────┐
               │  Push Service   │              │  Email Service  │              │   SMS Service   │
               │   (Firebase)    │              │   (Nodemailer)  │              │    (Twilio)     │
               └─────────────────┘              └─────────────────┘              └─────────────────┘
                        │                                 │                                 │
                        └─────────────────────────────────┼─────────────────────────────────┘
                                                          ▼
                                               ┌─────────────────┐
                                               │  In-App Service │
                                               │  (Database)     │
                                               └─────────────────┘
```

## 📄 Licencia

UNLICENSED - PhysioSense Proprietary