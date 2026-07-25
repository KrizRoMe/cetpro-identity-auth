# Flujo de autenticación (DEV1 - Identity & Integración)

## Diagrama de flujo (Authorization Code Flow)

```
Frontend (app cliente: Moodle / Nextcloud / navegador)
   │
   │ 1. GET /auth/login
   ▼
NestJS Orchestrator (nestjs-orchestrator-api)
   │
   │ 2. redirect 302 -> Keycloak /realms/ecosystem/protocol/openid-connect/auth
   ▼
Keycloak (realm "ecosystem")
   │
   │ 3. Usuario ingresa credenciales en el login form de Keycloak
   │ 4. Keycloak redirige a redirect_uri con ?code=XXXX
   ▼
NestJS Orchestrator  GET /auth/callback?code=XXXX
   │
   │ 5. POST /realms/ecosystem/protocol/openid-connect/token
   │    (grant_type=authorization_code, client_id, client_secret, code)
   ▼
Keycloak devuelve { access_token (JWT), refresh_token, id_token }
   │
   │ 6. Orchestrator decodifica el JWT y lo entrega a la app cliente
   ▼
App cliente (Moodle / Nextcloud / OpenProject / Mattermost)
   usa el JWT en el header:  Authorization: Bearer <access_token>
```

## Contrato del JWT

El `access_token` emitido por Keycloak incluye (via protocol mapper `oidc-usermodel-realm-role-mapper`):

```json
{
  "sub": "f47ac10b-58cc-...",
  "email": "demo@test.com",
  "roles": ["teacher"],
  "iss": "http://localhost:8080/realms/ecosystem",
  "aud": "account",
  "exp": 1234567890
}
```

- `sub`: id único del usuario en Keycloak.
- `email`: correo del usuario (scope `email`, activo por defecto).
- `roles`: roles de realm asignados (`admin`, `teacher`, `student`), aplanados como array plano gracias al mapper custom `realm-roles-mapper` definido en cada client (`moodle-client`, `nextcloud-client`).

## Endpoints expuestos por el orquestador NestJS

| Método | Ruta                        | Descripción                                                                 | Auth requerida |
|--------|-----------------------------|------------------------------------------------------------------------------|----------------|
| GET    | `/`                         | Página HTML con link "Iniciar sesión con Keycloak"                          | No |
| GET    | `/auth/login`               | Redirige (302) al authorization endpoint de Keycloak                        | No |
| GET    | `/auth/callback?code=...`   | Intercambia el `code` por tokens y muestra el JWT decodificado (HTML)        | No (usa el code de Keycloak) |
| POST   | `/auth/token` `{username,password}` | Password grant directo (uso en pruebas/API), devuelve tokens JSON     | No |
| GET    | `/auth/me`                  | Verifica el `Bearer` JWT contra las JWKS de Keycloak y devuelve el payload   | Sí (Bearer JWT) |
| GET    | `/auth/protected/teacher`   | Ejemplo de endpoint protegido por rol `teacher`                             | Sí (Bearer JWT + rol `teacher`) |
| GET    | `/health`                   | Health check del servicio                                                   | No |

## Endpoints de Keycloak usados directamente

| Endpoint | Uso |
|---|---|
| `GET /realms/ecosystem/protocol/openid-connect/auth` | Authorization endpoint (login interactivo) |
| `POST /realms/ecosystem/protocol/openid-connect/token` | Token endpoint (exchange de `code` o password grant) |
| `GET /realms/ecosystem/protocol/openid-connect/certs` | JWKS públicas para verificar la firma RS256 del JWT |
| `http://localhost:8080/admin` | Consola administrativa de Keycloak (`admin` / `admin`) |

## Verificación del JWT en las apps consumidoras (Moodle, Nextcloud, etc.)

1. Obtener las llaves públicas desde `GET /realms/ecosystem/protocol/openid-connect/certs`.
2. Verificar la firma RS256 del `access_token` usando el `kid` del header.
3. Validar `iss` (`http://localhost:8080/realms/ecosystem`) y `exp`.
4. Leer el claim `roles` para aplicar autorización (RBAC) en la app.

Este mismo mecanismo es el que implementa `JwtAuthGuard` + `RolesGuard` dentro del orquestador NestJS (`src/auth/jwt-auth.guard.ts`, `src/auth/roles.guard.ts`).
