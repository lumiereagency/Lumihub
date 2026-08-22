import { redirect } from "next/navigation";
import { hasAnyOrganization } from "@/lib/auth/bootstrap";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!(await hasAnyOrganization())) {
    redirect("/setup");
  }
  if (await getCurrentUser()) {
    redirect("/dashboard");
  }

  return <LoginForm />;
}
