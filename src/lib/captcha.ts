import "server-only";

/**
 * Verificación de Cloudflare Turnstile. Sólo se exige cuando
 * TURNSTILE_SECRET_KEY está definida: mientras no lo esté, no hace nada.
 * Antes de definirla hay que agregar el widget en el formulario y enviar su
 * token como `captchaToken`; si no, el login quedaría rechazando a todos.
 */
export async function captchaValido(token: unknown, ip?: string): Promise<boolean> {
  const secreto = process.env.TURNSTILE_SECRET_KEY;
  if (!secreto) return true;
  if (typeof token !== "string" || token.length === 0 || token.length > 2048) return false;

  try {
    const cuerpo = new URLSearchParams({ secret: secreto, response: token });
    if (ip) cuerpo.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: cuerpo,
      signal: AbortSignal.timeout(5000),
    });
    const datos = (await res.json()) as { success?: boolean };
    return datos.success === true;
  } catch {
    return false;
  }
}
