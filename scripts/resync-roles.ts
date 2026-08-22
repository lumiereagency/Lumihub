import { db } from "@/lib/db";
import { ensureDefaultRoles } from "@/lib/auth/bootstrap";

async function main() {
  const org = await db.organization.findFirstOrThrow();
  await ensureDefaultRoles(org.id);
  console.log("roles resynced for org:", org.id);
}

main().then(() => process.exit(0));
