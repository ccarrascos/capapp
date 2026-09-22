import "server-only";
import Groq from "groq-sdk";

export const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/** Modelo con soporte de tool calling en el free tier de Groq. */
export const MODELO_IA = "openai/gpt-oss-120b";
