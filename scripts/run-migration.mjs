// Ejecuta un archivo SQL contra el proyecto Supabase vía Management API.
// Uso: node scripts/run-migration.mjs supabase/migrations/000X_nombre.sql
import { readFileSync } from "node:fs";

const PROJECT_REF = "arwsezvpmczxrxxwnsbb";
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!TOKEN) {
  console.error("Falta SUPABASE_ACCESS_TOKEN en el entorno.");
  process.exit(1);
}

const path = process.argv[2];
if (!path) {
  console.error("Uso: node scripts/run-migration.mjs <archivo.sql>");
  process.exit(1);
}

const sql = readFileSync(path, "utf-8");

const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: sql }),
});

const body = await res.json();
if (!res.ok) {
  console.error("ERROR", res.status, JSON.stringify(body, null, 2));
  process.exit(1);
}
console.log("OK", JSON.stringify(body, null, 2).slice(0, 2000));
