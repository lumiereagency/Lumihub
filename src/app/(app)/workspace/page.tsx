import { redirect } from "next/navigation";

// Endereço amigável: /workspace abre o Workspace (rota original /tarefas).
export default function WorkspaceRedirect() {
  redirect("/tarefas");
}
