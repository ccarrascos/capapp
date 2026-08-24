"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSesion } from "@/lib/auth";

export type CrearOrganizacionInput = {
  rut: string;
  razonSocial: string;
  nombreFantasia: string | null;
  sectorEconomico: string | null;
  direccion: string | null;
  comuna: string | null;
  region: string | null;
  emailContacto: string | null;
};

export async function crearOrganizacion(input: CrearOrganizacionInput) {
  const sesion = await getSesion();
  if (!sesion?.esSuperAdmin) {
    return { ok: false as const, mensaje: "Sólo un super administrador puede crear organizaciones." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("organizaciones")
    .insert({
      rut: input.rut,
      razon_social: input.razonSocial,
      nombre_fantasia: input.nombreFantasia,
      sector_economico: input.sectorEconomico,
      direccion: input.direccion,
      comuna: input.comuna,
      region: input.region,
      email_contacto: input.emailContacto,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false as const, mensaje: error?.message ?? "No se pudo crear la organización." };

  revalidatePath("/organizaciones");
  return { ok: true as const, organizacionId: data.id };
}

const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
const TAMANO_MAXIMO = 2 * 1024 * 1024;

export async function subirLogoOrganizacion(organizacionId: string, formData: FormData) {
  const sesion = await getSesion();
  const autorizado =
    !!sesion &&
    (sesion.esSuperAdmin ||
      sesion.roles.some((r) => r.rol === "admin_organizacion" && r.organizacionId === organizacionId));
  if (!autorizado) {
    return { ok: false as const, mensaje: "No tienes permiso para editar el logo de esta organización." };
  }

  const supabase = await createClient();

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { ok: false as const, mensaje: "Selecciona una imagen." };
  }

  if (!TIPOS_PERMITIDOS.includes(archivo.type)) {
    return { ok: false as const, mensaje: "Formato no permitido. Usa JPG, PNG, WEBP o SVG." };
  }

  if (archivo.size > TAMANO_MAXIMO) {
    return { ok: false as const, mensaje: "La imagen no puede superar los 2 MB." };
  }

  const extension =
    archivo.type === "image/png"
      ? "png"
      : archivo.type === "image/webp"
        ? "webp"
        : archivo.type === "image/svg+xml"
          ? "svg"
          : "jpg";
  const ruta = `${organizacionId}/logo.${extension}`;

  const { error: errorSubida } = await supabase.storage.from("logos").upload(ruta, archivo, {
    upsert: true,
    contentType: archivo.type,
  });

  if (errorSubida) return { ok: false as const, mensaje: errorSubida.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from("logos").getPublicUrl(ruta);

  const logoUrl = `${publicUrl}?v=${Date.now()}`;

  const { error: errorOrg } = await supabase.from("organizaciones").update({ logo_url: logoUrl }).eq("id", organizacionId);

  if (errorOrg) return { ok: false as const, mensaje: errorOrg.message };

  revalidatePath("/", "layout");
  return { ok: true as const, logoUrl };
}
