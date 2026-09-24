import "server-only";
import { randomBytes } from "node:crypto";
import { obtenerConfiguracion } from "@/lib/configuracion";

export function generarPasswordTemporal() {
  return randomBytes(9).toString("base64url");
}

export async function calcularExpiracionPasswordTemporal() {
  const { password_temporal_horas } = await obtenerConfiguracion();
  return new Date(Date.now() + password_temporal_horas * 60 * 60 * 1000);
}
