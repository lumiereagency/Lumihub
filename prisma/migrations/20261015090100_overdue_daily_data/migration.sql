-- Régua: sai "1 dia depois" e "5 dias depois"; entra um modelo diário "venceu" (sem contar dias).
-- Cria o novo modelo nas empresas que usavam algum dos antigos.
INSERT INTO "message_templates" ("id", "organizationId", "name", "trigger", "channel", "body", "active", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, o."organizationId", 'Venceu (todos os dias até pagar)', 'D_MAIS_DIARIO', 'WHATSAPP',
  'Oi, {{nome}}, tudo bem? Identificamos que a fatura de {{descricao}}, no valor de {{valor}}, venceu.\n\nPara regularizar é só abrir: {{link}}\nO código Pix copia e cola vai na próxima mensagem.\n\nSe já pagou, pode enviar o comprovante pelo mesmo link. Se precisar combinar outra data, é só responder esta mensagem e a gente resolve. {{empresa}}', true, now(), now()
FROM (SELECT DISTINCT "organizationId" FROM "message_templates" WHERE "trigger" IN ('D_MAIS_1', 'D_MAIS_5')) o
WHERE NOT EXISTS (SELECT 1 FROM "message_templates" t WHERE t."organizationId" = o."organizationId" AND t."trigger" = 'D_MAIS_DIARIO');

-- Lembretes ainda agendados dos modelos antigos são cancelados e os modelos apagados.
UPDATE "payment_reminders" SET "status" = 'CANCELADO'
WHERE "status" = 'AGENDADO' AND "messageTemplateId" IN (SELECT "id" FROM "message_templates" WHERE "trigger" IN ('D_MAIS_1', 'D_MAIS_5'));
DELETE FROM "message_templates" WHERE "trigger" IN ('D_MAIS_1', 'D_MAIS_5');
