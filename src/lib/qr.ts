import "server-only";
import QRCode from "qrcode";

export async function generarQrDataUrl(texto: string): Promise<string> {
  return QRCode.toDataURL(texto, { margin: 1, width: 240 });
}
