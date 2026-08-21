import "server-only";

/**
 * Temporal: mientras el envío de correo no esté confirmado, todas las cuentas
 * nuevas se crean con esta clave fija para no depender del email. Cuando el
 * correo esté funcionando, volver a generar una aleatoria (randomBytes).
 */
export function generarPasswordTemporal() {
  return "Capapp2026!";
}
