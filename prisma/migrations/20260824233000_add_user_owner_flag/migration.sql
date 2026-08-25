-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isOwner" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: o proprietário de cada organização já existente é o
-- administrador mais antigo dela (na prática, quem criou a conta pelo
-- /setup). Sem isso, nenhuma conta ficaria marcada como owner e as travas
-- de proteção do proprietário bloqueariam todo mundo, inclusive ele.
UPDATE "users" u
SET "isOwner" = true
FROM (
  SELECT DISTINCT ON (o."organizationId") o.id
  FROM "users" o
  JOIN "roles" r ON r.id = o."roleId"
  WHERE r.key = 'ADMIN' AND o."deletedAt" IS NULL
  ORDER BY o."organizationId", o."createdAt" ASC
) first_admin
WHERE u.id = first_admin.id;
