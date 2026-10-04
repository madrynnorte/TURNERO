# Madryn Norte · Gestión de turnos

Aplicación web instalable (PWA) para administrar las canchas del Complejo Madryn Norte desde teléfono o PC. Centraliza agenda, reservas, cobros, descuentos, personal, reportes y exportaciones CSV.

## Funciones incluidas

- Agenda semanal de dos canchas, con grilla de 30 minutos y vista adaptable a celular.
- Alta de reservas con precio, descuento, estado, responsable y observaciones.
- Prevención transaccional de superposiciones por cancha y horario.
- Movimiento de turnos con arrastrar y soltar y control de cambios simultáneos.
- Registro de cobros parciales o totales, distintos medios de pago y saldo pendiente.
- Registro de horas y funciones del personal.
- Roles `administrador`, `encargado` y `consulta`, con sesiones seguras en cookie HttpOnly.
- Exportación CSV de reservas, cobros y personal.
- Instalación como app en iPhone, Android y PC mediante PWA.
- Base de datos relacional Cloudflare D1 y migraciones versionadas con Drizzle.

## Acceso inicial

| Rol | Usuario | Contraseña inicial |
| --- | --- | --- |
| Administrador | `admin` | `Madryn2026!` |
| Encargado | `encargado1` | `Madryn2026!` |
| Encargado | `encargado2` | `Madryn2026!` |
| Solo consulta | `consulta` | `Madryn2026!` |

Las claves están marcadas para cambio obligatorio. Antes de usar el sistema en producción, completar la pantalla de cambio de contraseña o sustituir las credenciales iniciales en `lib/seed.ts` y volver a sembrar una base vacía.

## Desarrollo local

Requisitos: Node.js 22.13 o superior y Git. En la carpeta del proyecto:

```powershell
npm install
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_gray_gorilla_man.sql
npm start
```

Abrir la dirección que imprime la consola, normalmente `http://127.0.0.1:8787`.

Para desarrollo con actualización automática:

```powershell
npm run dev
```

## Producción

La aplicación está preparada para ejecutarse como Worker con una base Cloudflare D1. El despliegue requiere una cuenta Cloudflare y crear una base D1; después se aplica la migración de `drizzle/` y se publica el artefacto generado en `dist/`.

La declaración de almacenamiento para OpenAI Sites está en `.openai/hosting.json`. El entorno debe aportar el binding D1 `DB`.

## Documentación

- [Instalación en teléfonos y PC](docs/INSTALACION.md)
- [Publicación en Internet](docs/PUBLICACION.md)
- [Arquitectura y seguridad](docs/ARQUITECTURA.md)
- [Pruebas y operación](docs/PRUEBAS.md)

## Respaldo

En producción, exportar D1 de forma periódica y conservar el SQL fuera de la cuenta operativa. En local, la base de desarrollo vive en `.wrangler/state/`, que no se versiona.

## Estado de esta entrega

La versión 1.0 funciona de punta a punta para el flujo diario. La importación inicial incorpora una muestra representativa del turnero vigente; la carga masiva automática de todas las hojas históricas, el editor de series recurrentes y el cambio de contraseña desde la interfaz quedan identificados como mejoras de segunda etapa.
