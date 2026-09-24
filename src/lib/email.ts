import "server-only";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL ?? "Capapp <onboarding@resend.dev>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// Mientras no haya un dominio verificado en Resend, el remitente sandbox
// sólo puede entregar al correo de la propia cuenta de Resend. Con esta
// variable seteada, todo correo real se redirige ahí igual — pensado
// puramente para probar el flujo completo con destinatarios "reales"
// mientras se verifica un dominio. Quitar la variable apaga la redirección.
const REDIRIGIR_A_PRUEBA = process.env.EMAIL_REDIRIGIR_A_PRUEBA || null;

function escaparHtml(valor: string) {
  return valor
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatearFechaHora(fecha: Date) {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(fecha);
}

function plantillaBienvenida(params: {
  nombres: string;
  password: string;
  rolLabel: string;
  rut: string;
  expiraEn: Date;
  motivo: "cuenta_nueva" | "nuevo_acceso";
  destinatarioReal?: string;
}) {
  const expiraTexto = escaparHtml(formatearFechaHora(params.expiraEn));
  const bannerPrueba = params.destinatarioReal
    ? `<div style="background:#004e90; color:#f6f9fc; padding: 8px 24px; font-size: 12px; text-align: center;">
        Modo de prueba: este correo era en realidad para <strong>${escaparHtml(params.destinatarioReal)}</strong>.
      </div>`
    : "";
  const introTexto =
    params.motivo === "cuenta_nueva"
      ? `Se creó tu cuenta en <strong>Capapp</strong>, el sistema de gestión de capacitación en
        prevención de riesgos laborales (art. 16, DS N.º 44/2023), con el rol de
        <strong>${escaparHtml(params.rolLabel)}</strong>.`
      : `Generamos una nueva contraseña temporal para tu cuenta en <strong>Capapp</strong>, el sistema
        de gestión de capacitación en prevención de riesgos laborales (art. 16, DS N.º 44/2023).
        Si no la solicitaste tú, cambia tu contraseña apenas ingreses y avisa a quien administra tu
        organización.`;
  return `
<div style="background:#f0f5f2; padding: 32px 16px; font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 480px; margin: 0 auto; color: #0e151a;">
    ${bannerPrueba}
    <div style="background:#e5b400; height: 4px; line-height:4px; font-size:0;">&nbsp;</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #050c12;">
      <tr>
        <td style="padding: 20px 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-right: 10px;">
                <img src="${APP_URL}/logo-icon.png" width="28" height="28" alt="" style="display:block; width:28px; height:28px;" />
              </td>
              <td style="color: #e5e9e6; font-weight: 700; font-size: 18px; letter-spacing: 0.04em; text-transform: uppercase; font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;">
                Capapp
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <div style="background:#fafcfb; padding: 28px 24px; border: 1px solid #bcc7c7; border-top: none;">
      <p style="font-size: 15px; margin: 0 0 16px;">Hola ${escaparHtml(params.nombres)},</p>
      <p style="font-size: 14px; line-height: 1.6; color: #4b545a; margin: 0 0 20px;">
        ${introTexto}
      </p>
      <div style="border: 1px solid #bcc7c7; padding: 16px; margin-bottom: 20px;">
        <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #4b545a; margin: 0 0 4px;">RUT de acceso</p>
        <p style="font-family: monospace; font-size: 14px; margin: 0 0 14px;">${escaparHtml(params.rut)}</p>
        <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #4b545a; margin: 0 0 4px;">Contraseña temporal</p>
        <p style="font-family: monospace; font-size: 16px; font-weight: 700; margin: 0;">${escaparHtml(params.password)}</p>
      </div>
      <a href="${APP_URL}/login" style="display: inline-block; background: #004e90; color: #f6f9fc; text-decoration: none; font-size: 14px; font-weight: 600; padding: 10px 18px;">
        Iniciar sesión
      </a>
      <div style="border: 1px solid #e3a0a6; background: #fbeaec; padding: 12px 14px; margin-top: 20px;">
        <p style="font-size: 12px; color: #b71824; margin: 0; line-height: 1.5;">
          Esta contraseña es válida hasta el <strong>${expiraTexto}</strong> (72 horas desde el envío).
          Si no alcanzas a ingresar antes, ve a la página de inicio de sesión y usa la opción
          «¿Olvidaste tu contraseña?» para solicitar una nueva.
        </p>
      </div>
      <p style="font-size: 12px; color: #4b545a; margin-top: 20px; line-height: 1.5;">
        Por seguridad, cambia esta contraseña apenas ingreses (Mi perfil → Cambiar contraseña).
        Si no esperabas este correo, contacta a quien administra tu organización en Capapp.
      </p>
    </div>
  </div>
</div>`.trim();
}

export async function enviarCorreoBienvenida(params: {
  nombres: string;
  email: string;
  password: string;
  rolLabel: string;
  rut: string;
  expiraEn: Date;
  motivo?: "cuenta_nueva" | "nuevo_acceso";
}) {
  const motivo = params.motivo ?? "cuenta_nueva";
  const destinoReal = REDIRIGIR_A_PRUEBA && params.email !== REDIRIGIR_A_PRUEBA ? params.email : undefined;
  const destino = REDIRIGIR_A_PRUEBA ?? params.email;

  const subjectBase = motivo === "cuenta_nueva" ? "Tu cuenta en Capapp" : "Nuevo acceso temporal a tu cuenta en Capapp";
  const subject = destinoReal ? `[PRUEBA → ${destinoReal}] ${subjectBase}` : subjectBase;

  const { error } = await resend.emails.send({
    from: FROM,
    to: destino,
    subject,
    html: plantillaBienvenida({ ...params, motivo, destinatarioReal: destinoReal }),
  });

  if (error) {
    return { ok: false as const, mensaje: error.message };
  }
  return { ok: true as const };
}
