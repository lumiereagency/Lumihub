import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";

async function main() {
  const org = await db.organization.findFirstOrThrow();
  const role = await db.role.findUniqueOrThrow({
    where: { organizationId_key: { organizationId: org.id, key: "COMERCIAL" } },
  });
  const passwordHash = await hashPassword("SenhaForte123");
  const user = await db.user.upsert({
    where: { organizationId_email: { organizationId: org.id, email: "carla@lumiere.test" } },
    create: {
      organizationId: org.id,
      roleId: role.id,
      name: "Carla Comercial",
      email: "carla@lumiere.test",
      passwordHash,
      emailVerifiedAt: new Date(),
    },
    update: { roleId: role.id, passwordHash },
  });
  console.log("created:", user.email);
}

main().then(() => process.exit(0));
