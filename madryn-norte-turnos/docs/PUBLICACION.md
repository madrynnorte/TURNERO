# Publicación en Internet

La aplicación está lista para Cloudflare Workers + D1. Hace falta una cuenta Cloudflare autenticada para crear los recursos y obtener la URL HTTPS.

## 1. Autenticar la cuenta

```powershell
npx wrangler login
```

## 2. Crear la base de datos

```powershell
npx wrangler d1 create madryn-norte-turnos
```

El comando devuelve un `database_id`. Copiar `wrangler.production.jsonc.example` como `wrangler.production.jsonc` y reemplazar `REEMPLAZAR_CON_DATABASE_ID` por ese identificador. El archivo de producción real está ignorado por Git para evitar publicar por accidente una configuración de cuenta.

## 3. Crear las tablas remotas

```powershell
npx wrangler d1 execute madryn-norte-turnos --remote --file drizzle/0000_gray_gorilla_man.sql
```

## 4. Compilar y publicar

```powershell
npm install
npm run build
npx wrangler deploy --config wrangler.production.jsonc
```

Wrangler informa la URL HTTPS al finalizar. Abrirla, ingresar como administrador y verificar agenda, cobros y exportación antes de compartirla.

## 5. Actualizaciones

Para cada versión nueva:

```powershell
git pull
npm install
npm run build
npx wrangler deploy --config wrangler.production.jsonc
```

Las migraciones nuevas deben aplicarse en orden antes del despliegue que dependa de ellas.

## Repositorio remoto

Desde la carpeta raíz del repositorio local:

```powershell
git remote add origin URL_DEL_REPOSITORIO
git push -u origin master
```

No publicar `.wrangler/`, `node_modules/`, `dist/` ni la base local. Ya están excluidos por `.gitignore`.
