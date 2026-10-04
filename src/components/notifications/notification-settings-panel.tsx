"use client";

import { useEffect, useState, useTransition } from "react";
import { BellOff, BellRing, Check, Monitor, Smartphone } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { sendTestPushAction, updateNotificationSettingsAction } from "@/lib/actions/push-actions";
import { NOTIFICATION_CATEGORIES, type NotificationCategory, type NotificationSettings } from "@/lib/notifications/settings";
import { currentSubscription, needsInstallForPush, pushSupported, subscribeThisDevice, unsubscribeThisDevice } from "@/lib/push-client";

type DeviceState = "loading" | "unsupported" | "install" | "denied" | "off" | "on";

interface Device {
  id: string;
  label: string;
  mobile: boolean;
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
        checked ? "bg-[image:var(--lh-accent-gradient)]" : "bg-border",
      )}
    >
      <span className={cn("inline-block h-5 w-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[22px]" : "translate-x-0.5")} />
    </button>
  );
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);

export function NotificationSettingsPanel({ vapidPublicKey, initial, devices }: { vapidPublicKey: string; initial: NotificationSettings; devices: Device[] }) {
  const [state, setState] = useState<DeviceState>("loading");
  const [settings, setSettings] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    (async () => {
      if (!pushSupported()) return setState(needsInstallForPush() ? "install" : "unsupported");
      if (needsInstallForPush()) return setState("install");
      if (Notification.permission === "denied") return setState("denied");
      const sub = Notification.permission === "granted" ? await currentSubscription() : null;
      setState(sub ? "on" : "off");
    })();
  }, []);

  function save(next: NotificationSettings) {
    setSettings(next);
    setSaved(false);
    startTransition(async () => {
      const res = await updateNotificationSettingsAction(next);
      if (res.ok) {
        setSaved(true);
        window.setTimeout(() => setSaved(false), 1800);
      }
    });
  }

  function toggleCategory(key: NotificationCategory, on: boolean) {
    save({ ...settings, disabled: on ? settings.disabled.filter((k) => k !== key) : [...settings.disabled, key] });
  }

  async function enable() {
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const ok = await subscribeThisDevice(vapidPublicKey);
      setState(ok ? "on" : "off");
      if (ok) {
        const res = await sendTestPushAction();
        setMessage(res.ok ? "Pronto. Enviamos uma notificação de teste para este aparelho." : (res.error ?? null));
      }
    } catch {
      setMessage("Não foi possível ativar agora. Tente de novo em instantes.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    await unsubscribeThisDevice();
    setState("off");
    setMessage(null);
    setBusy(false);
  }

  async function test() {
    setBusy(true);
    const res = await sendTestPushAction();
    setMessage(res.ok ? `Enviada para ${res.sent} ${res.sent === 1 ? "aparelho" : "aparelhos"}.` : (res.error ?? null));
    setBusy(false);
  }

  const status: Record<DeviceState, { title: string; text: string }> = {
    loading: { title: "Verificando este aparelho…", text: "" },
    unsupported: { title: "Este navegador não recebe notificações", text: "Use o Chrome, o Edge ou a LUMIBASE instalada como app." },
    install: { title: "Instale a LUMIBASE para receber no iPhone", text: "No Safari, toque em Compartilhar e em “Adicionar à Tela de Início”. Depois abra o app e ative aqui." },
    denied: { title: "Notificações bloqueadas neste navegador", text: "Toque no cadeado ao lado do endereço, permita notificações e volte aqui para ativar." },
    off: { title: "Desativadas neste aparelho", text: "Ative para receber os avisos mesmo com a base fechada." },
    on: { title: "Ativadas neste aparelho", text: "Você recebe os avisos aqui mesmo com a base fechada." },
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
              state === "on" ? "bg-[image:var(--lh-accent-gradient)] text-accent-on" : "bg-card-elevated text-text-tertiary",
            )}
          >
            {state === "on" ? <BellRing size={17} /> : <BellOff size={17} />}
          </span>
          <div>
            <p className="text-sm font-semibold text-text-primary">{status[state].title}</p>
            {status[state].text && <p className="mt-0.5 text-[13px] text-text-tertiary">{status[state].text}</p>}
            {message && <p className="mt-1.5 text-[13px] text-accent-light">{message}</p>}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {state === "off" && (
            <Button size="sm" variant="accent" onClick={enable} disabled={busy}>
              {busy ? "Ativando…" : "Ativar neste aparelho"}
            </Button>
          )}
          {state === "on" && (
            <>
              <Button size="sm" variant="secondary" onClick={test} disabled={busy}>
                Enviar teste
              </Button>
              <Button size="sm" variant="ghost" onClick={disable} disabled={busy}>
                Desativar
              </Button>
            </>
          )}
        </div>
      </div>

      {devices.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary">Aparelhos que recebem</p>
          <div className="flex flex-wrap gap-2">
            {devices.map((d) => {
              const Icon = d.mobile ? Smartphone : Monitor;
              return (
                <span key={d.id} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-text-secondary">
                  <Icon size={13} /> {d.label}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-[0.06em] text-text-tertiary">O que te avisar</p>
          <span className={cn("flex items-center gap-1 text-xs text-success transition-opacity", saved ? "opacity-100" : "opacity-0")}>
            <Check size={12} /> Salvo
          </span>
        </div>
        <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
          {NOTIFICATION_CATEGORIES.map((c) => (
            <div key={c.key} className="flex items-start justify-between gap-4 border-b border-border py-3">
              <div className="min-w-0">
                <p className="text-sm text-text-primary">{c.label}</p>
                <p className="text-xs text-text-tertiary">{c.description}</p>
              </div>
              <Switch checked={!settings.disabled.includes(c.key)} onChange={(v) => toggleCategory(c.key, v)} label={c.label} />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-text-primary">Horário de silêncio</p>
          <p className="text-xs text-text-tertiary">Nada toca nesse intervalo; os avisos ficam no sino e entram no resumo da manhã.</p>
        </div>
        <div className="flex items-center gap-3">
          {settings.quiet && (
            <div className="flex items-center gap-1.5 text-sm text-text-secondary">
              <select
                aria-label="Início do silêncio"
                value={settings.quietStart}
                onChange={(e) => save({ ...settings, quietStart: Number(e.target.value) })}
                className="h-9 rounded-xl border border-border bg-card-elevated px-2 text-sm text-text-primary"
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {h}h
                  </option>
                ))}
              </select>
              às
              <select
                aria-label="Fim do silêncio"
                value={settings.quietEnd}
                onChange={(e) => save({ ...settings, quietEnd: Number(e.target.value) })}
                className="h-9 rounded-xl border border-border bg-card-elevated px-2 text-sm text-text-primary"
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {h}h
                  </option>
                ))}
              </select>
            </div>
          )}
          <Switch checked={settings.quiet} onChange={(v) => save({ ...settings, quiet: v })} label="Horário de silêncio" />
        </div>
      </div>
    </div>
  );
}
