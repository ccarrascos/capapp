"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
  const supabase = await createClient();

  const { error } = await supabase.from("organizaciones").insert({
    rut: input.rut,
    razon_social: input.razonSocial,
    nombre_fantasia: input.nombreFantasia,
    sector_economico: input.sectorEconomico,
    direccion: input.direccion,
    comuna: input.comuna,
    region: input.region,
    email_contacto: input.emailContacto,
  });

  if (error) return { ok: false as const, mensaje: error.message };

  revalidatePath("/organizaciones");
  return { ok: true as const };
}
