import { redirect } from "next/navigation";
import { getSesion } from "@/lib/auth";

export default async function RootPage() {
  const sesion = await getSesion();
  redirect(sesion ? "/dashboard" : "/login");
}
