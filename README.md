# PhysioSense Notification Backend Microservice

Microservicio de notificaciones para PhysioSense. Para este MVP soporta un único canal:
- **Push Notifications** (Firebase Cloud Messaging / APNs)

## 🚀 Inicio Rápido

### Prerrequisitos
- Node.js 18+
- PostgreSQL 14+ (o Supabase)
- Cuenta Firebase (para push)

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
    "userId": "26",
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
    "userId": "26",
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
    "userId": "26",
    "token": "fcm-token-from-device",
    "platform": "ANDROID",
    "appVersion": "1.2.3",
    "deviceModel": "Pixel 8",
    "osVersion": "Android 14"
  }'
```

### Actualizar preferencias
```bash
curl -X PUT http://localhost:3002/api/v1/preferences?userId=26 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "preferences": [
      { "channel": "PUSH", "enabled": true },
      { "channel": "PUSH", "category": "marketing", "enabled": false }
    ]
  }'
```

## 🔧 Configuración del Canal Push

### Firebase (Push)

#### 1. Registrar la app Android (React Native)
1. Firebase Console → ⚙️ **Configuración del proyecto** → **Tus apps** → **Agregar app** → **Android**.
2. Usa el `applicationId` exacto de `android/app/build.gradle` (p. ej. `com.physiosense.app`).
3. Descarga `google-services.json` y colócalo en `android/app/google-services.json`.
4. Aplica el plugin de Google Services:
   - `android/build.gradle` → `classpath 'com.google.gms:google-services:4.4.2'`
   - `android/app/build.gradle` → `apply plugin: 'com.google.gms.google-services'`
5. Instala las librerías:
   ```bash
   npm install @react-native-firebase/app @react-native-firebase/messaging
   ```
   > Con **Expo** necesitas un *development build* (no funciona en Expo Go);
   > alternativamente usa `expo-notifications` + `getDevicePushTokenAsync()`.

> Cloud Messaging ya viene habilitado por defecto en proyectos nuevos. No hace falta
> subir nada más para Android (para iOS sí necesitas una APNs key).

#### 2. Generar la service account (backend)
1. Firebase Console → ⚙️ **Configuración del proyecto** → **Cuentas de servicio**.
2. Pulsa **Generar nueva clave privada** y descarga el `.json`.
3. Guárdalo como `secrets/firebase-service-account.json` en la raíz del repo
   (esa carpeta está en `.gitignore`; **nunca** la subas a git).
4. En `.env` deja solo:
   ```env
   FIREBASE_SERVICE_ACCOUNT_PATH=./secrets/firebase-service-account.json
   ```

Alternativas soportadas:
```env
# JSON completo (o base64) en una sola línea, útil para CI/CD
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}

# O las tres variables clásicas (la clave con \n literales y entre comillas)
FIREBASE_PROJECT_ID=tu-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@tu-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nTU_KEY\n-----END PRIVATE KEY-----\n"
```

#### 3. Verificar que el backend quedó conectado
```bash
curl http://localhost:3002/api/v1/push/status
# { "configured": true, "projectId": "tu-project-id", "source": "file ..." }
```
Si `configured` es `false`, el campo `error` dice exactamente qué falta
(archivo inexistente, JSON inválido, credenciales placeholder, etc.).

#### 4. React Native: obtener el token y registrarlo

> `@react-native-firebase/messaging` v22+ usa la **API modular** (no hay
> `export default`). El `userId` es el id numérico del auth service convertido
> a string, por ejemplo `"26"` (la columna `userId` es `varchar(64)`).

```ts
import {
  getMessaging,
  getToken,
  registerDeviceForRemoteMessages,
} from '@react-native-firebase/messaging';
import { PermissionsAndroid, Platform } from 'react-native';

export async function registerForPush(userId: number) {
  // Android 13+ requiere permiso explícito
  if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
  }

  const messaging = getMessaging();

  if (Platform.OS === 'ios') {
    await registerDeviceForRemoteMessages(messaging);
  }

  const token = await getToken(messaging);

  await fetch('http://<IP-DEL-BACKEND>:3002/api/v1/devices/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: String(userId), token, platform: 'ANDROID' }),
  });
}
```

Manejo de mensajes (fuera del componente, en `index.js` para el background):
```ts
import {
  getMessaging,
  onMessage,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';

setBackgroundMessageHandler(getMessaging(), async remoteMessage => {
  console.log('Push en background:', remoteMessage);
});

// En un componente:
onMessage(getMessaging(), async remoteMessage => {
  console.log('Push en foreground:', remoteMessage);
});
```

Canal de Android (opcional pero recomendado):
```ts
import notifee, { AndroidImportance } from '@notifee/react-native';

await notifee.createChannel({
  id: 'physiosense_default',
  name: 'PhysioSense',
  importance: AndroidImportance.HIGH,
});
```
Si creas ese canal, agrega en el `.env` del backend:
```env
ANDROID_NOTIFICATION_CHANNEL_ID=physiosense_default
```
Si no lo creas, deja la variable vacía y FCM usará su canal de respaldo.

#### 5. Probar un envío
```bash
# 1) Registrar el token real del dispositivo (ver paso 4)
# 2) Crear la notificación
curl -X POST http://localhost:3002/api/v1/notifications \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "26",
    "title": "Cita confirmada",
    "body": "Tu cita es mañana a las 10:00",
    "channel": "PUSH",
    "priority": "HIGH",
    "data": { "appointmentId": "apt-123", "attempt": 1 }
  }'

# 3) Revisar el resultado del envío (status SENT/FAILED y errorMessage)
curl "http://localhost:3002/api/v1/notifications?userId=26"
```

> El teléfono/emulador no puede usar `localhost` del PC. Opciones:
> `adb reverse tcp:3002 tcp:3002` (emulador o USB) o usar la IP LAN del PC
> (`ipconfig`) y permitir el puerto en el firewall.

Notas:
- Los valores de `data` se convierten automáticamente a string (FCM lo exige).
- Si `imageUrl` es `null` se omite del payload (FCM rechaza `null`).
- Errores típicos: `invalid_grant` → service account revocada o reloj desincronizado;
  `messaging/registration-token-not-registered` → token viejo, hay que volver a registrarlo.



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
                         ┌────────────────────────────────┘
                         ▼
                ┌─────────────────┐
                │  Push Service   │
                │   (Firebase)    │
                └─────────────────┘
```

## 📄 Licencia

UNLICENSED - PhysioSense Proprietary