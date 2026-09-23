import "server-only";
import { randomBytes } from "node:crypto";

export function generarPasswordTemporal() {
  return randomBytes(9).toString("base64url");
}

const DURACION_PASSWORD_TEMPORAL_MS = 72 * 60 * 60 * 1000;

export function calcularExpiracionPasswordTemporal() {
  return new Date(Date.now() + DURACION_PASSWORD_TEMPORAL_MS);
}
