/**
 * CSV separado por ";" (punto y coma) — así lo abre Excel en configuración
 * regional latinoamericana sin pedir "convertir texto en columnas". Mismo
 * formato que ya usa la exportación de la matriz de vigencia.
 */

function csvEscapar(valor: string): string {
  return `"${valor.replace(/"/g, '""')}"`;
}

export function generarCsv(filas: string[][], delimitador = ";"): string {
  const lineas = filas.map((fila) => fila.map((v) => csvEscapar(String(v ?? ""))).join(delimitador));
  const BOM = String.fromCharCode(0xfeff);
  return BOM + lineas.join("\r\n");
}

export function descargarCsv(nombreArchivo: string, filas: string[][]) {
  const csv = generarCsv(filas);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  URL.revokeObjectURL(url);
}

/** Parser tolerante a campos entre comillas con ";", saltos de línea o comillas escapadas (""). */
export function parsearCsv(texto: string, delimitador = ";"): string[][] {
  const contenido = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto;
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let dentroComillas = false;
  let i = 0;

  while (i < contenido.length) {
    const c = contenido[i];

    if (dentroComillas) {
      if (c === '"') {
        if (contenido[i + 1] === '"') {
          campo += '"';
          i += 2;
          continue;
        }
        dentroComillas = false;
        i++;
        continue;
      }
      campo += c;
      i++;
      continue;
    }

    if (c === '"') {
      dentroComillas = true;
      i++;
      continue;
    }
    if (c === delimitador) {
      fila.push(campo);
      campo = "";
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    if (c === "\n") {
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
      i++;
      continue;
    }
    campo += c;
    i++;
  }

  if (campo.length > 0 || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }

  return filas.filter((f) => f.some((v) => v.trim() !== ""));
}
