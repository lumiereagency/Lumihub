import { removePushSubscriptionAction, savePushSubscriptionAction } from "@/lib/actions/push-actions";

// Helpers de navegador para o push (usados pelos componentes de cliente).

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

// No iPhone o push só existe com a base instalada na tela inicial.
export function needsInstallForPush(): boolean {
  return isIos() && !isStandalone();
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

function keyToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function sameKey(sub: PushSubscription, key: Uint8Array): boolean {
  const current = sub.options.applicationServerKey;
  if (!current) return false;
  const a = new Uint8Array(current);
  return a.length === key.length && a.every((v, i) => v === key[i]);
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

// Inscreve (ou reaproveita a inscrição) e garante que o servidor conhece este aparelho.
export async function subscribeThisDevice(vapidPublicKey: string): Promise<boolean> {
  const reg = await registerServiceWorker();
  if (!reg) return false;
  const key = keyToBytes(vapidPublicKey);
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub, key)) {
    await sub.unsubscribe().catch(() => {});
    sub = null;
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  const res = await savePushSubscriptionAction(sub.toJSON(), navigator.userAgent);
  return res.ok;
}

export async function unsubscribeThisDevice(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await removePushSubscriptionAction(sub.endpoint).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

export function dismissedRecently(key: string, days: number): boolean {
  try {
    const at = Number(localStorage.getItem(key));
    return at > 0 && Date.now() - at < days * 86_400_000;
  } catch {
    return false;
  }
}

export function rememberDismiss(key: string): void {
  try {
    localStorage.setItem(key, String(Date.now()));
  } catch {}
}
