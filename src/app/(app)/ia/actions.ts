"use server";

import type Groq from "groq-sdk";
import { getSesion } from "@/lib/auth";
import { groq, MODELO_IA } from "@/lib/groq";
import { registrarAuditoria } from "@/lib/auditoria";
import { createClient } from "@/lib/supabase/server";
import { DEFINICIONES_HERRAMIENTAS, ejecutarHerramienta } from "./herramientas";

const ROLES_PERMITIDOS = [
  "super_admin",
  "admin_organizacion",
  "prevencionista",
  "supervisor_centro",
  "auditor",
] as const;

const MENSAJE_SISTEMA = `Eres el asistente de Capapp, una plataforma de gestión de capacitación en prevención de riesgos (DS 44) para empresas en Chile.

Respondes preguntas sobre trabajadores, cumplimiento de capacitación, cursos, ediciones, facilitadores, cargos, centros de trabajo, subcontratos, programas de trabajo preventivo y organizaciones, usando EXCLUSIVAMENTE las herramientas disponibles — nunca inventes cifras ni nombres.

Prueba primero con la herramienta más específica para la pregunta. Si la pregunta es sobre trabajadores y ninguna herramienta específica calza, usa "consultar_trabajadores" y calcula tú mismo la respuesta sobre esos datos crudos. Si la pregunta es sobre otra cosa (cursos, facilitadores, cargos, centros, subcontratos, programas de trabajo preventivo, organizaciones), usa "consultar_tabla". Solo dile al usuario que no puedes responder si ya intentaste la herramienta catch-all correspondiente y tampoco tenía el dato.

Responde siempre en español, de forma breve y concreta, en texto plano sin markdown (sin **, sin #, sin listas con "-"; si necesitas enumerar, usa oraciones o números seguidos de un punto). Cuando listes trabajadores, usa su nombre y RUN. Hoy es ${new Date().toLocaleDateString("es-CL")}.`;

export type MensajeChat = { role: "user" | "assistant"; content: string };

const MAX_MENSAJES = 20;
const MAX_VUELTAS_HERRAMIENTAS = 6;

export async function enviarMensaje(
  historial: MensajeChat[],
): Promise<{ ok: true; respuesta: string } | { ok: false; mensaje: string }> {
  const sesion = await getSesion();
  if (!sesion) return { ok: false, mensaje: "No autenticado." };

  const autorizado =
    sesion.esSuperAdmin || sesion.roles.some((r) => ROLES_PERMITIDOS.includes(r.rol as (typeof ROLES_PERMITIDOS)[number]));
  if (!autorizado) {
    return { ok: false, mensaje: "No tienes permiso para usar el asistente." };
  }

  if (historial.length === 0 || historial[historial.length - 1].role !== "user") {
    return { ok: false, mensaje: "Falta el mensaje del usuario." };
  }
  if (historial.length > MAX_MENSAJES) {
    return { ok: false, mensaje: "Esta conversación ya es muy larga — inicia una nueva." };
  }

  const mensajes: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: MENSAJE_SISTEMA },
    ...historial,
  ];

  try {
    for (let vuelta = 0; vuelta < MAX_VUELTAS_HERRAMIENTAS; vuelta++) {
      const respuesta = await groq.chat.completions.create({
        model: MODELO_IA,
        messages: mensajes,
        tools: DEFINICIONES_HERRAMIENTAS,
        tool_choice: "auto",
        temperature: 0.2,
      });

      const mensaje = respuesta.choices[0]?.message;
      if (!mensaje) return { ok: false, mensaje: "El asistente no respondió." };

      if (!mensaje.tool_calls || mensaje.tool_calls.length === 0) {
        const supabase = await createClient();
        await registrarAuditoria(supabase, {
          usuarioId: sesion.usuarioId,
          accion: "consulta_asistente_ia",
          tabla: "ia",
          datosNuevos: { pregunta: historial[historial.length - 1].content },
        });
        return { ok: true, respuesta: mensaje.content ?? "" };
      }

      mensajes.push({ role: "assistant", content: mensaje.content, tool_calls: mensaje.tool_calls });

      for (const llamada of mensaje.tool_calls) {
        let argumentos: Record<string, unknown> = {};
        try {
          argumentos = JSON.parse(llamada.function.arguments || "{}");
        } catch {
          // Argumentos malformados — se ejecuta la herramienta con argumentos vacíos.
        }
        const resultado = await ejecutarHerramienta(sesion, llamada.function.name, argumentos);
        mensajes.push({ role: "tool", tool_call_id: llamada.id, content: JSON.stringify(resultado) });
      }
    }

    return { ok: false, mensaje: "El asistente no pudo completar la consulta. Intenta reformular la pregunta." };
  } catch (error) {
    console.error("Error consultando al asistente IA:", error);
    return { ok: false, mensaje: "Hubo un error consultando al asistente. Intenta de nuevo en unos segundos." };
  }
}
