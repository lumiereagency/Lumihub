import type { MediaItem } from "@/lib/content/media";
import type { SocialAccount } from "@/generated/prisma/client";

export interface PublishInput {
  targetId: string;
  postId: string;
  batchToken: string;
  account: SocialAccount;
  accessToken: string;
  title: string;
  caption: string;
  format: string;
  media: MediaItem[];
  // TikTok: app com auditoria aprovada publica como público.
  tiktokAudited: boolean;
  // Reddit: comunidade (ex.: "r/minhamarca" ou "u/usuario") e identificação exigida pelo Reddit.
  subreddit: string | null;
  redditAgent: string | null;
}

export interface PublishResult {
  externalId: string;
  externalUrl: string | null;
}

export class PublishError extends Error {
  // Erro que repetir não resolve (conta desconectada, arquivo recusado...).
  permanent: boolean;
  constructor(message: string, permanent = false) {
    super(message);
    this.permanent = permanent;
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
