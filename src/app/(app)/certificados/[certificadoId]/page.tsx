import { notFound } from "next/navigation";
import { getSesion } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { generarQrDataUrl } from "@/lib/qr";
import { CertificadoView } from "./certificado-view";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const ENTIDAD_EMISORA_LABEL: Record<string, string> = {
  empleador: "Empleador",
  oal: "Organismo Administrador de la Ley",
  otec: "OTEC",
};

export default async function CertificadoPage({
  params,
}: {
  params: Promise<{ certificadoId: string }>;
}) {
  const { certificadoId } = await params;
  const sesion = await getSesion();
  if (!sesion) return null;

  const supabase = await createClient();

  const { data: certificado } = await supabase
    .from("certificados")
    .select(
      "id, numero_certificado, token, fecha_emision, fecha_vigencia_hasta, entidad_emisora_tipo, entidad_emisora_id, persona_run, cursos(nombre, horas_totales, organizacion_id, organizaciones(razon_social, rut, logo_url)), personas(nombres, apellido_paterno, apellido_materno, run, dv, usuario_id)",
    )
    .eq("id", certificadoId)
    .maybeSingle();

  if (!certificado || !certificado.cursos || !certificado.personas) notFound();

  let nombreEntidadExterna: string | null = null;
  if (certificado.entidad_emisora_id) {
    if (certificado.entidad_emisora_tipo === "oal") {
      const { data } = await supabase
        .from("organismos_administradores")
        .select("nombre")
        .eq("id", certificado.entidad_emisora_id)
        .maybeSingle();
      nombreEntidadExterna = data?.nombre ?? null;
    } else if (certificado.entidad_emisora_tipo === "otec") {
      const { data } = await supabase
        .from("entidades_acreditadas")
        .select("nombre")
        .eq("id", certificado.entidad_emisora_id)
        .maybeSingle();
      nombreEntidadExterna = data?.nombre ?? null;
    }
  }

  const organizacionId = certificado.cursos.organizacion_id;
  const puedeVer =
    sesion.esSuperAdmin ||
    certificado.personas.usuario_id === sesion.usuarioId ||
    (organizacionId &&
      sesion.roles.some(
        (r) =>
          ["admin_organizacion", "prevencionista", "auditor"].includes(r.rol) &&
          r.organizacionId === organizacionId,
      ));

  if (!puedeVer) notFound();

  const qrDataUrl = await generarQrDataUrl(`${APP_URL}/validar/${certificado.token}`);

  return (
    <CertificadoView
      qrDataUrl={qrDataUrl}
      numeroCertificado={certificado.numero_certificado}
      fechaEmision={certificado.fecha_emision}
      fechaVigenciaHasta={certificado.fecha_vigencia_hasta}
      entidadEmisora={
        nombreEntidadExterna
          ? `${nombreEntidadExterna} (${ENTIDAD_EMISORA_LABEL[certificado.entidad_emisora_tipo]})`
          : (ENTIDAD_EMISORA_LABEL[certificado.entidad_emisora_tipo] ?? certificado.entidad_emisora_tipo)
      }
      nombreCompleto={`${certificado.personas.nombres} ${certificado.personas.apellido_paterno}${certificado.personas.apellido_materno ? ` ${certificado.personas.apellido_materno}` : ""}`}
      rut={`${certificado.personas.run}-${certificado.personas.dv}`}
      cursoNombre={certificado.cursos.nombre}
      cursoHoras={certificado.cursos.horas_totales}
      organizacionNombre={certificado.cursos.organizaciones?.razon_social ?? "—"}
      organizacionLogoUrl={certificado.cursos.organizaciones?.logo_url ?? null}
    />
  );
}
