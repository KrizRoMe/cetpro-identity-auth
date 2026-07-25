# identity-auth: Identity & Integración

Stack de autenticación
centralizada (Keycloak/SSO) e integración (orquestador NestJS), según la división
de tareas del proyecto.

## Servicios (docker-compose)

| Servicio | Imagen | Puerto host | Descripción |
|---|---|---|---|
| `keycloak` | `quay.io/keycloak/keycloak:25.0` | `8080` | SSO / OAuth2 / OIDC, realm `ecosystem` autoimportado |
| `postgres-auth` | `postgres:16-alpine` | `5433` (interno `5432`) | Base de datos de Keycloak |
| `nestjs-orchestrator-api` | build local (`./nestjs-orchestrator-api`) | `3000` | Orquestador: login flow, verificación de JWT, endpoints protegidos por rol |

> Nota de puertos: `5432` estaba ocupado por otro contenedor en este equipo, por
> lo que `postgres-auth` se expone en `5433` en el host (dentro de la red docker
> sigue usando el `5432` estándar).

## Levantar el stack (desarrollo)

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

Espera ~30-60s en el primer arranque (Keycloak importa el realm). Verifica salud:

```bash
curl -s http://localhost:8080/realms/ecosystem/.well-known/openid-configuration | head -c 200
curl -s http://localhost:3000/health
```

## Realm preconfigurado (`ecosystem`)

- **Clients**: `moodle-client`, `nextcloud-client` (confidential, secrets
  `moodle-secret` / `nextcloud-secret`).
- **Roles**: `admin`, `teacher`, `student`.
- **Usuarios demo**: `demo@test.com` / `demo1234` (rol `teacher`),
  `student1@test.com` / `student1234` (rol `student`).
- Consola admin: `http://localhost:8080/admin` (`admin` / `admin`).

Detalle completo de la configuración manual: [`docs/keycloak-setup.md`](docs/keycloak-setup.md).

## Flujo de login y contrato del JWT

Ver [`docs/AUTH_FLOW.md`](docs/AUTH_FLOW.md) para el diagrama completo:

```
Frontend → GET /auth/login → Keycloak (login) → /auth/callback?code=...
        → NestJS intercambia code por JWT → devuelve JWT a la app
```

## Despliegue en producción

`docker-compose.prod.yml` está pensado para convivir con los demás repos del
ecosistema (Moodle, Nextcloud, Mattermost, OpenProject) en el mismo VPS/EC2,
todos unidos por una red Docker externa compartida y expuestos por un único
reverse proxy (Nginx/Traefik) con dominios reales.

```bash
# una sola vez en el servidor
docker network create ecosystem-net

cp .env.prod.example .env.prod   # completar dominios, secrets y passwords reales

docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Diferencias clave respecto a `docker-compose.dev.yml`:
- Red `ecosystem-net` **externa**, no propia — para que otros repos (apps de
  DEV2, Mattermost, OpenProject) se conecten por nombre de contenedor.
- No publica puertos al host: el reverse proxy se conecta internamente
  (ej. `identity-auth-keycloak:8080`, `identity-auth-nestjs-orchestrator:3000`).
- Secrets y hostnames vía variables de entorno (`.env.prod`), nunca hardcodeados.
- `KC_HOSTNAME` / `KC_PROXY=edge` configurados para funcionar detrás de HTTPS.

## Probar manualmente

1. Abrir `http://localhost:3000` → clic en "Iniciar sesion con Keycloak".
2. Ingresar `demo@test.com` / `demo1234` en el login de Keycloak.
3. Verás la página de callback con el JWT decodificado (`email`, `roles`).

También vía API (password grant), sin navegador:

```bash
curl -X POST http://localhost:3000/auth/token \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo1234"}'
```

Y para probar rutas protegidas:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/auth/token -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo1234"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).access_token')

curl -s http://localhost:3000/auth/me -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:3000/auth/protected/teacher -H "Authorization: Bearer $TOKEN"
```

## Estructura del proyecto

```
identity-auth/
├── docker-compose.dev.yml    # desarrollo local (red bridge propia, puertos en host)
├── docker-compose.prod.yml   # produccion (red externa "ecosystem-net", sin puertos publicados)
├── .env.prod.example         # variables de entorno para docker-compose.prod.yml
├── keycloak/realm-export/ecosystem-realm.json   # realm autoimportado
├── nestjs-orchestrator-api/                      # orquestador NestJS
│   └── src/auth/                                 # login, callback, guards de JWT y roles
└── docs/
    ├── AUTH_FLOW.md         # diagrama + contrato JWT + endpoints
    └── keycloak-setup.md    # pasos manuales de realm/clients/roles
```
