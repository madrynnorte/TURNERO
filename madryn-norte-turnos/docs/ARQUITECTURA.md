# Arquitectura y seguridad

## Componentes

- **Interfaz:** React 19 y Next/Vinext, responsive y preparada como PWA.
- **API:** rutas de servidor bajo `app/api/`.
- **Persistencia:** Cloudflare D1, consultada con Drizzle ORM.
- **Despliegue:** Cloudflare Worker generado en `dist/server`.
- **Modelo temporal:** fechas almacenadas en UTC y presentadas en hora local del navegador.

## Modelo de datos

Las tablas principales son usuarios, sesiones, canchas, tipos de reserva, reservas, intervalos de reserva, cobros, personal, horas trabajadas y auditoría. Cada turno ocupa intervalos únicos de 30 minutos en `reservation_slots`; la restricción única en base de datos impide una doble reserva aunque dos operadores confirmen al mismo tiempo.

Las actualizaciones de reservas incluyen un número de versión. Si una segunda pantalla intenta guardar una versión vencida, la API responde con conflicto y obliga a recargar los datos.

## Autenticación y permisos

- Las contraseñas se derivan con PBKDF2-SHA-256, sal aleatoria y 210.000 iteraciones.
- La sesión usa un token aleatorio almacenado como hash y una cookie `HttpOnly`, `SameSite=Lax` y `Secure` en HTTPS.
- Las rutas de escritura validan la sesión y el rol en el servidor.
- `administrador` y `encargado` pueden operar; `consulta` es de solo lectura.
- Los cambios sensibles quedan trazados en `audit_log`.

## Límites conocidos de la versión 1.0

- La pantalla de cambio de contraseña está pendiente; las claves iniciales deben reemplazarse antes de producción.
- Las reservas recurrentes se identifican por serie, pero aún no existe edición masiva desde la interfaz.
- La importación completa de todas las hojas históricas del Excel no está automatizada.
- El service worker entrega una experiencia instalable y conserva recursos estáticos; las operaciones de escritura requieren conexión.
