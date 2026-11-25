import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Lo llama el cron diario de Vercel (vercel.json). El plan gratuito de
 * Supabase pausa el proyecto tras ~7 días sin actividad; una consulta al día
 * basta para que no lo considere inactivo. No devuelve datos.
 *
 * Falla cerrado: sin CRON_SECRET definido en Vercel el endpoint rechaza todo.
 * El cron lo envía como "Authorization: Bearer <CRON_SECRET>".
 */
export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) {
    return new Response("No autorizado", { status: 401 });
  }

  const { error } = await createAdminClient()
    .from("organizaciones")
    .select("id", { count: "exact", head: true });

  if (error) return Response.json({ ok: false }, { status: 503 });
  return Response.json({ ok: true });
}
