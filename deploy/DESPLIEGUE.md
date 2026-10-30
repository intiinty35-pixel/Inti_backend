# Despliegue con Docker (VPS Contabo)

Mismo esquema que el CRM: cada repo se construye en el servidor con `deploy/deploy.sh` y el Nginx del VPS publica el sitio con HTTPS.
Frontend y API salen por **un solo dominio**: `https://intinmobiliaria.com` (frontend) y `https://intinmobiliaria.com/api/` (backend).

```
Internet ──► Nginx (443) ── intinmobiliaria.com/      ──► 127.0.0.1:3102 ─► ariz_frontend (Next.js)
                         └─ intinmobiliaria.com/api/  ──► 127.0.0.1:3103 ─► ariz_backend  (NestJS)
                                                                              │ host.docker.internal:5432
                                                                              ▼
                                                           PostgreSQL instalado en el VPS (base inti_web)

Dentro de Docker (red ariz-net), las llamadas del servidor de Next al backend van a http://ariz_backend:4000.
```

- **El prefijo `/api` lo quita Nginx.** El backend no tiene prefijo global: `/api/auth/login` debe llegar como `/auth/login`. Por eso el `proxy_pass` del bloque `/api/` termina en `/` (`proxy_pass http://127.0.0.1:3103/;`). Sin la barra final llegaría `/api/auth/login` y daría 404.
- El navegador llama siempre a `/api/...` (`NEXT_PUBLIC_API_URL=/api`), mismo origen que el frontend: la cookie de sesión funciona sin CORS.
- Puertos en `127.0.0.1`: 3102 (frontend) y 3103 (backend). No chocan con el CRM (3100/3101) ni con el 3001 de otro proyecto.
- El backend usa `trust proxy` para ver la IP real del visitante (necesario para el límite de peticiones).
- Cambiar de dominio: `frontend/deploy/nginx/*.conf`, `NEXT_PUBLIC_SITE_URL` y `FRONTEND_URL` del backend.

## Primer despliegue

1. **DNS:** registros A `@` (y `www`) → IP del servidor. Comprueba que `intinmobiliaria.com` es el dominio correcto antes de seguir.
2. **Clonar** (en el servidor):
   ```bash
   mkdir -p ~/inti-web && cd ~/inti-web
   git clone https://github.com/intiinty35-pixel/Inti_backend.git
   git clone https://github.com/intiinty35-pixel/Inti_frontend.git
   docker network create ariz-net
   ```
3. **Base de datos PostgreSQL en el VPS** (el servidor ya tiene Postgres por el CRM; se crea una base y un usuario **nuevos**, sin tocar los del CRM):
   ```bash
   openssl rand -hex 24                    # genera la clave y guardala
   sudo -u postgres psql
   ```
   Dentro de `psql`:
   ```sql
   CREATE USER inti_user WITH PASSWORD 'LA_CLAVE';
   CREATE DATABASE inti_web OWNER inti_user;
   \q
   ```
   Permitir que los contenedores lleguen a esa base (Postgres ya escucha en `172.17.0.1` por el CRM; solo falta autorizar el usuario nuevo):
   ```bash
   ls /etc/postgresql                       # version instalada (16 en el CRM)
   echo "host  inti_web  inti_user  172.16.0.0/12  scram-sha-256" | sudo tee -a /etc/postgresql/16/main/pg_hba.conf
   sudo systemctl reload postgresql         # reload, no restart: no interrumpe el CRM
   ss -tlnp | grep 5432                     # debe verse 127.0.0.1 y 172.17.0.1, NUNCA 0.0.0.0
   PGPASSWORD='LA_CLAVE' psql -h 127.0.0.1 -U inti_user -d inti_web -c "select 1;"
   ```
   El puerto 5432 ya está abierto solo para redes Docker (`ufw allow from 172.16.0.0/12 to any port 5432`); no se abre al público.
4. **Backend `.env`** (`cp .env.example .env && chmod 600 .env`). Exigencias de producción del backend:
   - `DATABASE_URL` y `DIRECT_URL` (los dos iguales): `postgresql://inti_user:LA_CLAVE@host.docker.internal:5432/inti_web?schema=public`. Sin `sslmode`: el backend exime de TLS solo a `localhost`, `127.0.0.1` y `host.docker.internal`; una base remota sigue exigiendo `sslmode=verify-full`.
   - `FRONTEND_URL=https://intinmobiliaria.com` (debe ser `https`)
   - `JWT_SECRET` aleatorio (`node -e "console.log(require('crypto').randomBytes(64).toString('base64url'))"`), sin valores de ejemplo
   - `CLOUDINARY_URL`, `FIREBASE_PROJECT_ID`, `BREVO_*`, etc.
   - `NODE_ENV` y `PORT` los fija el compose.
5. **Migraciones y seed** (la imagen no incluye el CLI de Prisma, así que se corren desde tu PC por un **túnel SSH** a la base del VPS, que no es accesible desde internet):
   ```powershell
   # Terminal 1 (se queda abierta mientras dura el proceso):
   ssh -L 5433:127.0.0.1:5432 desarrollador@209.145.62.118

   # Terminal 2, en la carpeta del backend:
   $env:DIRECT_URL = "postgresql://inti_user:LA_CLAVE@localhost:5433/inti_web?schema=public"
   $env:DATABASE_URL = $env:DIRECT_URL
   $env:ADMIN_EMAIL = "correo-del-admin@dominio.com"
   $env:ADMIN_PASSWORD = "UNA_CLAVE_FUERTE"
   pnpm db:deploy          # aplica las migraciones (crea todas las tablas)
   pnpm db:seed            # primera vez: crea el admin y los planes por defecto
   Remove-Item Env:DIRECT_URL, Env:DATABASE_URL, Env:ADMIN_EMAIL, Env:ADMIN_PASSWORD
   ```
6. **Backend:** `cd ~/inti-web/Inti_backend && sh deploy/deploy.sh`. Comprobar: `curl -s http://127.0.0.1:3103/promotions/current` (devuelve JSON; el backend responde **sin** `/api`).
7. **Frontend `.env`:** `cp .env.example .env` y completar:
   - `NEXT_PUBLIC_FIREBASE_*` (obligatorias para compilar), Google Maps y datos de pago.
   - `NEXT_PUBLIC_API_URL=/api`
   - `NEXT_PUBLIC_SITE_URL=https://intinmobiliaria.com`
   - `BACKEND_URL=http://ariz_backend:4000` (no `localhost`, no el dominio público)
8. **Frontend:** `cd ~/inti-web/Inti_frontend && sh deploy/deploy.sh` (~3 min). Comprobar: `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3102/` → 200.
9. **Nginx + HTTPS:**
   ```bash
   sudo cp ~/inti-web/Inti_frontend/deploy/nginx/intinmobiliaria.com.conf /etc/nginx/sites-available/intinmobiliaria.com
   sudo ln -s /etc/nginx/sites-available/intinmobiliaria.com /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot --nginx -d intinmobiliaria.com -d www.intinmobiliaria.com   # elegir "redirigir HTTP a HTTPS"
   sudo certbot renew --dry-run                                              # comprueba la renovación automática
   ```
   El DNS debe resolver ya a la IP del servidor, o Certbot fallará al validar.
10. **Firebase:** añadir `intinmobiliaria.com` en Authentication → Settings → Authorized domains.

## Verificación desde el dominio

```bash
# 1. Frontend por HTTPS
curl -sI https://intinmobiliaria.com/ | head -1                      # HTTP/2 200
# 2. HTTP redirige a HTTPS
curl -sI http://intinmobiliaria.com/ | grep -i location              # https://intinmobiliaria.com/
# 3. API real a traves del dominio (endpoint publico, devuelve JSON, NO 404)
curl -s -w "\n%{http_code}\n" https://intinmobiliaria.com/api/promotions/current
# 4. El prefijo no se duplica: esto debe dar 404 del backend, no 200
curl -s -o /dev/null -w "%{http_code}\n" https://intinmobiliaria.com/api/api/promotions/current
# 5. Login (credenciales invalidas deben dar 401, no 404 ni 502)
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://intinmobiliaria.com/api/auth/login \
  -H "Content-Type: application/json" -d '{"email":"x@x.com","password":"x"}'
```
Y en el navegador: abrir `https://intinmobiliaria.com`, iniciar sesión (F12 → Network: las llamadas van a `/api/...` y no hay errores CORS ni de cookies) y comprobar que la cookie de sesión tiene `Secure` y `HttpOnly`.

## Actualizar
```
local: commit + push a main ─► servidor: sh deploy/deploy.sh (en el repo que cambió)
```
- Con migraciones nuevas: corre `pnpm db:deploy` por el túnel SSH (paso 5) **antes** de desplegar el backend, y haz un backup con `pg_dump` primero.
- Cambios en backend y frontend a la vez: primero backend, luego frontend.
- Las variables `NEXT_PUBLIC_*` y `BACKEND_URL` se fijan al compilar: si cambian, vuelve a correr `deploy.sh` del frontend.
- Cambios en Nginx: edita `/etc/nginx/sites-available/intinmobiliaria.com`, luego `sudo nginx -t && sudo systemctl reload nginx` (Certbot ya habrá modificado ese archivo para el HTTPS; no lo sobrescribas con el de `deploy/`).

## Problemas típicos
| Síntoma | Causa | Solución |
|---|---|---|
| `/api/...` da 404 del backend | `proxy_pass` sin la barra final, o el prefijo llega duplicado | debe ser `proxy_pass http://127.0.0.1:3103/;` (con `/` al final) |
| `/api/...` da 502 | backend caído o puerto distinto | `docker logs ariz_backend`; `curl http://127.0.0.1:3103/promotions/current` |
| Login falla pero la API responde | `NODE_ENV` sin `production` o sitio servido por HTTP (la cookie es `Secure`) | usar HTTPS y `NODE_ENV=production` (lo fija el compose) |
| Error "Too Many Requests" con pocos usuarios | backend sin `trust proxy` (todos comparten IP) | usar la versión con `app.set('trust proxy', 1)` en `main.ts` |
| Backend en `Restarting` | `.env` no pasa la validación (placeholder, `FRONTEND_URL` sin https, falta `sslrootcert`) | `docker logs ariz_backend` indica la variable |
| `network ariz-net not found` | no se creó la red | `docker network create ariz-net` (deploy.sh ya lo hace) |
| Error de Firebase en el navegador | dominio no autorizado o `NEXT_PUBLIC_FIREBASE_*` vacías al compilar | ver paso 9 y 6; reconstruir |
| Certbot falla | el DNS aún no apunta al servidor, o el puerto 80 está bloqueado | `dig intinmobiliaria.com`, revisar `ufw` |
