import "server-only";
import { db } from "@/lib/db";

const DEFAULT_FUNCTIONS = ["Data Show", "Auxiliar de Data Show", "Fotógrafo", "Story Maker", "Videomaker"];

export const MEDIA_ONLY_ROLE_NAME = "Mídia ADESF (portal apenas)";

// Role "casca vazia" (zero permissões no LUMIBASE) usada apenas para
// satisfazer a FK obrigatória User.roleId quando um voluntário de mídia é
// convidado sem nenhum vínculo prévio com o LUMIBASE. isSystem:true reusa a
// trava já existente em user-actions.ts (não pode ter permissões editadas
// nem ser excluída pela tela de Usuários) — nunca deve receber permissões.
export async function ensureMediaOnlyRole(organizationId: string) {
  const existing = await db.role.findFirst({ where: { organizationId, key: "CUSTOM", name: MEDIA_ONLY_ROLE_NAME } });
  if (existing) return existing;
  return db.role.create({ data: { organizationId, key: "CUSTOM", name: MEDIA_ONLY_ROLE_NAME, isSystem: true } });
}

// Garante que uma organização tem a identidade visual e as funções iniciais
// do Mídia ADESF (Fase 01, §item de funções configuráveis). Idempotente:
// chamado sob demanda a partir das páginas administrativas do módulo, nunca
// do fluxo de criação de organização (não altera o bootstrap existente do
// LUMIBASE em @/lib/auth/bootstrap.ts).
export async function ensureMediaAdesfDefaults(organizationId: string): Promise<void> {
  await db.mediaBrandSettings.upsert({
    where: { organizationId },
    create: { organizationId },
    update: {},
  });

  let functions = await db.mediaFunction.findMany({ where: { organizationId } });
  if (functions.length === 0) {
    await db.mediaFunction.createMany({
      data: DEFAULT_FUNCTIONS.map((name, index) => ({ organizationId, name, displayOrder: index })),
    });
    functions = await db.mediaFunction.findMany({ where: { organizationId } });
  }

  await db.mediaOperationsSettings.upsert({
    where: { organizationId },
    create: { organizationId },
    update: {},
  });

  // "Template de Culto" (§88): configuração padrão de funções aplicada a
  // todo evento novo — seedada uma vez com 1 vaga de cada função inicial.
  const hasDefaultRequirements = await db.mediaEventDefaultRequirement.count({ where: { organizationId } });
  if (hasDefaultRequirements === 0 && functions.length > 0) {
    await db.mediaEventDefaultRequirement.createMany({
      data: functions.map((f) => ({ organizationId, functionId: f.id, requiredQuantity: 1, mandatory: true })),
    });
  }
}
