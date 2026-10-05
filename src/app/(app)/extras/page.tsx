import { redirect } from "next/navigation";
import { requireUser, hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";

// Abre na aba de Captações para quem cuida delas; senão, em Edição de vídeo.
export default async function ExtrasHome() {
  const user = await requireUser();
  redirect(hasPermission(user, permKey("CAPTURES", "VIEW")) ? "/captacoes" : "/extras/edicao-de-video");
}
