# Pruebas y operación

## Verificaciones realizadas

- Compilación de producción completa.
- Inicio del Worker local con D1.
- Inicio y cierre de sesión.
- Lectura de agenda y métricas.
- Alta de una reserva válida.
- Rechazo de una reserva superpuesta con HTTP 409.
- Registro de un cobro y actualización de recaudado/pendiente.
- Registro de horas de personal.
- Exportación CSV.
- Validación visual de la agenda en navegador.

## Prueba rápida después de instalar

1. Ingresar como administrador.
2. Crear una reserva de prueba en un horario libre.
3. Intentar crear otra reserva en la misma cancha y horario; debe rechazarse.
4. Registrar un cobro parcial.
5. Verificar el saldo pendiente en el panel.
6. Exportar reservas y abrir el CSV.
7. Ingresar con `consulta`; los formularios de escritura deben quedar inaccesibles o responder sin autorización.

## Respaldo y recuperación

Programar una exportación periódica de la base D1. Conservar al menos una copia diaria y una semanal en una ubicación distinta de la cuenta Cloudflare. Probar la restauración en una base separada antes de depender del procedimiento.

## Incidentes

- Si una reserva informa conflicto, actualizar la agenda antes de reintentar.
- Si una pantalla quedó abierta durante mucho tiempo, cerrar sesión y volver a ingresar.
- Si la PWA muestra una versión anterior, cerrar todas las ventanas, reabrirla y actualizar una vez desde el navegador.
