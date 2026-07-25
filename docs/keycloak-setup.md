# Configuración de Keycloak (Realm, Clients, Roles)

El realm `ecosystem` se crea automáticamente al levantar el contenedor gracias al
archivo de importación `keycloak/realm-export/ecosystem-realm.json`, montado en
`/opt/keycloak/data/import` y cargado con la flag `start-dev --import-realm`.

Si prefieres crearlo manualmente desde la consola admin (`http://localhost:8080`,
usuario `admin` / `admin`), sigue estos pasos:

## 1. Crear el Realm

1. Consola admin → menú superior izquierdo → **Create Realm**.
2. Nombre: `ecosystem`.

## 2. Crear los Clients

### moodle-client
- Client ID: `moodle-client`
- Client authentication: **On** (confidential)
- Standard flow: **On**
- Direct access grants: **On**
- Valid redirect URIs: `http://localhost:3000/auth/callback`, `http://localhost:8090/*`
- Client secret (Credentials tab): `moodle-secret`

### nextcloud-client
- Client ID: `nextcloud-client`
- Client authentication: **On** (confidential)
- Standard flow: **On**
- Direct access grants: **On**
- Valid redirect URIs: `http://localhost:8091/*`
- Client secret: `nextcloud-secret`

## 3. Crear los Roles (Realm roles)

En **Realm roles** crear:
- `admin`
- `teacher`
- `student`

## 4. Mapper para incluir `roles` como claim plano en el JWT

Por defecto Keycloak agrega los roles dentro de `realm_access.roles`. Para exponerlos
como un array plano `"roles": [...]` (como pide el contrato del JWT), en cada client
(`moodle-client`, `nextcloud-client`) → pestaña **Client scopes** → `<client>-dedicated`
→ **Add mapper** → **By configuration** → **User Realm Role**:

- Name: `realm-roles-mapper`
- Token Claim Name: `roles`
- Claim JSON Type: `String`
- Multivalued: **On**
- Add to ID token / Add to access token / Add to userinfo: **On**

## 5. Crear usuarios de prueba

| Username | Email | Password | Rol |
|---|---|---|---|
| demo | demo@test.com | demo1234 | teacher |
| student1 | student1@test.com | student1234 | student |

Ir a **Users → Add user**, luego pestaña **Credentials** para setear el password
(Temporary: **Off**), y pestaña **Role mapping** para asignar el rol de realm.

## Verificación rápida vía CLI

```bash
# Password grant (útil para pruebas de API sin navegador)
curl -X POST http://localhost:8080/realms/ecosystem/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=moodle-client" \
  -d "client_secret=moodle-secret" \
  -d "username=demo" \
  -d "password=demo1234" \
  -d "scope=openid"
```

La respuesta debe incluir un `access_token` JWT; decodificándolo (p. ej. en jwt.io)
se debe ver `"email": "demo@test.com"` y `"roles": ["teacher"]`.
