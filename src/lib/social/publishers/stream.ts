import "server-only";
import { openDriveFile } from "../drive";

// Lê o arquivo do Drive em pedaços (sem guardar no disco nem na memória toda) e
// entrega cada pedaço a quem envia para a rede. `plan` define o tamanho de cada pedaço.
export async function sendDriveInChunks(
  fileId: string,
  plan: number[],
  send: (chunk: Buffer, start: number, end: number) => Promise<void>,
): Promise<void> {
  const res = await openDriveFile(fileId);
  if (!res.body) throw new Error("O Drive não devolveu o arquivo.");
  const reader = res.body.getReader();
  let pending: Buffer[] = [];
  let pendingLen = 0;
  let sent = 0;
  let planIdx = 0;
  const flush = async (size: number) => {
    const all = Buffer.concat(pending, pendingLen);
    const chunk = all.subarray(0, size);
    const rest = all.subarray(size);
    pending = rest.length ? [rest] : [];
    pendingLen = rest.length;
    await send(chunk, sent, sent + size - 1);
    sent += size;
    planIdx++;
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (value) {
      pending.push(Buffer.from(value));
      pendingLen += value.length;
      while (planIdx < plan.length && pendingLen >= plan[planIdx]) await flush(plan[planIdx]);
    }
    if (done) break;
  }
  if (planIdx < plan.length) throw new Error("O arquivo do Drive veio menor do que o esperado.");
}

export function planChunks(total: number, chunk: number): number[] {
  const count = Math.max(1, Math.floor(total / chunk));
  const plan = Array.from({ length: count }, () => chunk);
  plan[count - 1] = total - chunk * (count - 1);
  return plan;
}

export async function driveSize(fileId: string): Promise<number> {
  const res = await openDriveFile(fileId, "bytes=0-0");
  const cr = res.headers.get("content-range")?.match(/\/(\d+)$/)?.[1];
  await res.body?.cancel();
  if (cr) return Number(cr);
  const full = await openDriveFile(fileId);
  const len = full.headers.get("content-length");
  await full.body?.cancel();
  if (!len) throw new Error("Não consegui saber o tamanho do vídeo no Drive.");
  return Number(len);
}
