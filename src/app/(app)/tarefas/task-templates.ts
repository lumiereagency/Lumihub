// Modelos de cartão do Workspace (preenchem descrição e checklist).
export const CARD_TEMPLATES: { key: string; label: string; description: string; checklist: string[] }[] = [
  {
    key: "briefing",
    label: "Briefing",
    description:
      "🎯 Objetivo\n\n👥 Público\n\n💡 Ideia central / mensagem\n\n📎 Referências (cole os links ou imagens abaixo)\n\n📦 Entregáveis e formatos\n\n🗓️ Prazo e aprovação",
    checklist: ["Briefing aprovado pelo cliente", "Referências separadas", "Roteiro/pauta pronto", "Produção", "Revisão interna", "Aprovação do cliente", "Publicado/entregue"],
  },
  {
    key: "roteiro",
    label: "Roteiro",
    description: "🎬 Gancho (primeiros 3 segundos)\n\n🗣️ Desenvolvimento\n\n📣 Chamada para ação\n\n🎵 Trilha / referências de edição\n\n📝 Legenda e hashtags",
    checklist: ["Roteiro escrito", "Aprovação do roteiro", "Captação", "Edição", "Legenda pronta", "Aprovado para postar"],
  },
  {
    key: "followup",
    label: "Follow-up",
    description: "👤 Contato\n\n📌 O que foi combinado\n\n➡️ Próximo passo\n\n📅 Data do próximo contato",
    checklist: ["Contato feito", "Retorno recebido", "Próximo passo agendado"],
  },
];
