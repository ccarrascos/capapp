import "server-only";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL ?? "Capapp <onboarding@resend.dev>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function plantillaBienvenida(params: {
  nombres: string;
  email: string;
  password: string;
  rolLabel: string;
  rut: string;
}) {
  return `
<div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #14181B;">
  <div style="background: #0B4A85; padding: 20px 24px; display: flex; align-items: center; gap: 10px;">
    <span style="display:inline-block; width: 28px; height: 28px; background:#F2B705; text-align:center; line-height:28px; font-weight:700; color:#0B4A85; border-radius: 4px;">C</span>
    <span style="color: #fff; font-weight: 700; font-size: 18px; letter-spacing: 0.02em; text-transform: uppercase;">Capapp</span>
  </div>
  <div style="padding: 28px 24px; border: 1px solid #E2E4E1; border-top: none;">
    <p style="font-size: 15px; margin: 0 0 16px;">Hola ${params.nombres},</p>
    <p style="font-size: 14px; line-height: 1.6; color: #44494E; margin: 0 0 20px;">
      Se creó tu cuenta en <strong>Capapp</strong>, el sistema de gestión de capacitación en
      prevención de riesgos laborales (art. 16, DS N.º 44/2023), con el rol de
      <strong>${params.rolLabel}</strong>.
    </p>
    <div style="border: 1px solid #E2E4E1; padding: 16px; margin-bottom: 20px;">
      <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #6B7280; margin: 0 0 4px;">RUT de acceso</p>
      <p style="font-family: monospace; font-size: 14px; margin: 0 0 14px;">${params.rut}</p>
      <p style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #6B7280; margin: 0 0 4px;">Contraseña temporal</p>
      <p style="font-family: monospace; font-size: 16px; font-weight: 700; margin: 0;">${params.password}</p>
    </div>
    <a href="${APP_URL}/login" style="display: inline-block; background: #0B4A85; color: #fff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 10px 18px;">
      Iniciar sesión
    </a>
    <p style="font-size: 12px; color: #6B7280; margin-top: 24px; line-height: 1.5;">
      Por seguridad, cambia esta contraseña apenas ingreses (Mi perfil → Cambiar contraseña).
      Si no esperabas este correo, contacta a quien administra tu organización en Capapp.
    </p>
  </div>
</div>`.trim();
}

export async function enviarCorreoBienvenida(params: {
  nombres: string;
  email: string;
  password: string;
  rolLabel: string;
  rut: string;
}) {
  const { error } = await resend.emails.send({
    from: FROM,
    to: params.email,
    subject: "Tu cuenta en Capapp",
    html: plantillaBienvenida(params),
  });

  if (error) {
    return { ok: false as const, mensaje: error.message };
  }
  return { ok: true as const };
}
