"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, Flame, Snowflake, ThermometerSun } from "lucide-react";
import { checkLeadDuplicateAction } from "@/lib/actions/crm-actions";
import type { ActionState } from "@/lib/actions/auth-actions";
import { LEAD_STAGES, LEAD_STAGE_LABELS } from "@/lib/validation/crm";
import { cn } from "@/lib/cn";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

export interface LeadFormValues {
  company: string;
  contactName: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  website: string | null;
  city: string | null;
  segment: string | null;
  source: string | null;
  temperature: string | null;
  ownerUserId: string | null;
  potentialValue: number | null;
  probability: number;
  stage: string;
  nextContactAt: string | null;
  notes: string | null;
  serviceIds?: string[];
}

export interface ServiceOption {
  id: string;
  name: string;
  category: string | null;
}

const initialState: ActionState = {};

const SOURCE_SUGGESTIONS = [
  "Indicação",
  "Instagram",
  "WhatsApp",
  "Site",
  "Evento",
  "Prospecção ativa",
  "Prospecção IA (YouTube)",
];

const TEMPERATURE_OPTIONS = [
  { value: "", label: "Sem classificar", icon: null },
  { value: "FRIO", label: "Frio", icon: Snowflake },
  { value: "MORNO", label: "Morno", icon: ThermometerSun },
  { value: "QUENTE", label: "Quente", icon: Flame },
];

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

// No cadastro novo só o essencial aparece (empresa, contato, WhatsApp,
// origem, temperatura, responsável e próximo contato) — o resto fica em
// "Mais detalhes", para o comercial registrar um lead em segundos.
export function LeadForm({
  action,
  defaultValues,
  users,
  services = [],
  leadId,
  currentUserId,
  onSuccess,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues?: LeadFormValues;
  users: { id: string; name: string }[];
  services?: ServiceOption[];
  leadId?: string;
  currentUserId?: string;
  onSuccess?: () => void;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const successRef = useRef(state.success);
  const isEdit = !!defaultValues;
  const [identity, setIdentity] = useState({ company: defaultValues?.company ?? "", instagram: defaultValues?.instagram ?? "" });
  const [duplicate, setDuplicate] = useState<string | null>(null);
  const servicesByCategory = services.reduce<Record<string, ServiceOption[]>>((acc, s) => {
    const key = s.category || "Outros";
    (acc[key] ??= []).push(s);
    return acc;
  }, {});

  // Avisa antes de salvar se outra pessoa já cadastrou esse negócio.
  useEffect(() => {
    const unchanged = isEdit && identity.company === (defaultValues?.company ?? "") && identity.instagram === (defaultValues?.instagram ?? "");
    if (unchanged || (identity.company.trim().length < 3 && identity.instagram.trim().length < 3)) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      checkLeadDuplicateAction(identity.company, identity.instagram, leadId).then((message) => {
        if (!cancelled) setDuplicate(message);
      });
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity.company, identity.instagram]);

  useEffect(() => {
    if (state.success && state.success !== successRef.current) {
      onSuccess?.();
    }
    successRef.current = state.success;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage error={state.error} success={state.success} />

      <Input
        label="Empresa ou nome do lead"
        name="company"
        required
        autoFocus={!isEdit}
        defaultValue={defaultValues?.company}
        placeholder="Ex: Studio Aurora"
        onChange={(e) => {
          setDuplicate(null);
          setIdentity((v) => ({ ...v, company: e.target.value }));
        }}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input label="Pessoa de contato" name="contactName" defaultValue={defaultValues?.contactName ?? ""} placeholder="Nome de quem responde" />
        <Input label="WhatsApp" name="whatsapp" type="tel" inputMode="tel" defaultValue={defaultValues?.whatsapp ?? ""} placeholder="(11) 90000-0000" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label="Instagram"
          name="instagram"
          defaultValue={defaultValues?.instagram ?? ""}
          placeholder="@perfil ou link"
          onChange={(e) => {
            setDuplicate(null);
            setIdentity((v) => ({ ...v, instagram: e.target.value }));
          }}
        />
        <div>
          <Input label="Origem" name="source" list="lead-source-suggestions" defaultValue={defaultValues?.source ?? ""} placeholder="De onde veio?" />
          <datalist id="lead-source-suggestions">
            {SOURCE_SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
      </div>

      {duplicate && (
        <div role="alert" className="flex items-start gap-2.5 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-text-primary">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warning" />
          <span>{duplicate} Combine com a responsável antes de cadastrar de novo.</span>
        </div>
      )}

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium text-text-secondary">Temperatura</legend>
        <div className="flex flex-wrap gap-2">
          {TEMPERATURE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <label key={opt.value || "none"} className="cursor-pointer">
                <input
                  type="radio"
                  name="temperature"
                  value={opt.value}
                  defaultChecked={(defaultValues?.temperature ?? "") === opt.value}
                  className="peer sr-only"
                />
                <span
                  className={cn(
                    "inline-flex h-10 items-center gap-1.5 rounded-full border border-border px-4 text-sm text-text-secondary transition-colors",
                    "peer-focus-visible:ring-4 peer-focus-visible:ring-accent/15",
                    opt.value === "" && "peer-checked:bg-ink peer-checked:text-ink-on peer-checked:border-transparent",
                    opt.value === "FRIO" && "peer-checked:bg-info/15 peer-checked:text-info peer-checked:border-info/40",
                    opt.value === "MORNO" && "peer-checked:bg-warning/15 peer-checked:text-warning peer-checked:border-warning/40",
                    opt.value === "QUENTE" && "peer-checked:bg-error/15 peer-checked:text-error peer-checked:border-error/40",
                  )}
                >
                  {Icon && <Icon size={14} />}
                  {opt.label}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium text-text-secondary">Serviços de interesse</legend>
        <input type="hidden" name="servicesField" value="1" />
        {services.length === 0 ? (
          <p className="rounded-2xl bg-card-elevated px-4 py-3 text-sm text-text-tertiary">
            Nenhum serviço cadastrado ainda — o administrador cadastra na aba <strong className="text-text-secondary">Serviços</strong> do CRM.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {Object.entries(servicesByCategory).map(([category, items]) => (
              <div key={category} className="flex flex-col gap-1.5">
                {Object.keys(servicesByCategory).length > 1 && <p className="text-xs font-medium text-text-tertiary">{category}</p>}
                <div className="flex flex-wrap gap-2">
                  {items.map((service) => (
                    <label key={service.id} className="cursor-pointer">
                      <input
                        type="checkbox"
                        name="serviceIds"
                        value={service.id}
                        defaultChecked={defaultValues?.serviceIds?.includes(service.id)}
                        className="peer sr-only"
                      />
                      <span className="inline-flex h-9 items-center rounded-full border border-border px-3.5 text-sm text-text-secondary transition-colors peer-checked:border-transparent peer-checked:bg-ink peer-checked:text-ink-on peer-focus-visible:ring-4 peer-focus-visible:ring-accent/15">
                        {service.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </fieldset>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          label="Responsável"
          name="ownerUserId"
          defaultValue={isEdit ? (defaultValues?.ownerUserId ?? "") : (currentUserId ?? "")}
        >
          <option value="">Sem responsável</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
              {u.id === currentUserId ? " (você)" : ""}
            </option>
          ))}
        </Select>
        <Input
          label="Próximo contato"
          name="nextContactAt"
          type="date"
          defaultValue={toDateInputValue(defaultValues?.nextContactAt ?? null)}
        />
      </div>

      <details open={isEdit} className="group rounded-2xl border border-border">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-text-primary [&::-webkit-details-marker]:hidden">
          Mais detalhes
          <ChevronDown size={16} className="text-text-tertiary transition-transform group-open:rotate-180" />
        </summary>
        <div className="flex flex-col gap-4 border-t border-border p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select label="Estágio" name="stage" defaultValue={defaultValues?.stage ?? "LEAD"}>
              {LEAD_STAGES.map((s) => (
                <option key={s} value={s}>
                  {LEAD_STAGE_LABELS[s]}
                </option>
              ))}
            </Select>
            <Input label="Telefone" name="phone" type="tel" defaultValue={defaultValues?.phone ?? ""} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Valor potencial (R$)"
              name="potentialValue"
              type="number"
              min={0}
              step="0.01"
              defaultValue={defaultValues?.potentialValue ?? ""}
            />
            <Input
              label="Chance de fechar (%)"
              name="probability"
              type="number"
              min={0}
              max={100}
              defaultValue={defaultValues?.probability ?? 0}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Cidade" name="city" defaultValue={defaultValues?.city ?? ""} />
            <Input label="Segmento" name="segment" defaultValue={defaultValues?.segment ?? ""} placeholder="Ex: Restaurante, Clínica..." />
          </div>
          <Input label="Site" name="website" defaultValue={defaultValues?.website ?? ""} />
          <Textarea label="Observações" name="notes" defaultValue={defaultValues?.notes ?? ""} placeholder="O que foi conversado, próximos passos..." />
        </div>
      </details>

      <Button type="submit" disabled={pending} className="mt-1 w-full">
        {pending ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}
