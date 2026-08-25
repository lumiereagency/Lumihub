"use client";

import { useActionState, useRef } from "react";
import { updateMediaBrandSettingsAction, uploadMediaBrandImageAction } from "@/lib/actions/media-actions";
import type { ActionState } from "@/lib/actions/auth-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

const initialState: ActionState = {};

export function BrandSettingsForm({
  environmentName,
  primaryColor,
  secondaryColor,
  gradientStart,
  gradientEnd,
}: {
  environmentName: string;
  primaryColor: string;
  secondaryColor: string;
  gradientStart: string;
  gradientEnd: string;
}) {
  const [state, formAction, pending] = useActionState(updateMediaBrandSettingsAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <FormMessage error={state.error} success={state.success} />
      <Input label="Nome do ambiente" name="environmentName" defaultValue={environmentName} required />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <ColorField label="Cor primária" name="primaryColor" defaultValue={primaryColor} />
        <ColorField label="Cor secundária" name="secondaryColor" defaultValue={secondaryColor} />
        <ColorField label="Gradiente (início)" name="gradientStart" defaultValue={gradientStart} />
        <ColorField label="Gradiente (fim)" name="gradientEnd" defaultValue={gradientEnd} />
      </div>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Salvando..." : "Salvar identidade"}
      </Button>
    </form>
  );
}

function ColorField({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-text-secondary">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" name={`${name}_picker`} defaultValue={defaultValue} className="h-10 w-10 rounded-[8px] border border-border bg-card" onChange={(e) => {
          const sibling = e.currentTarget.nextElementSibling as HTMLInputElement | null;
          if (sibling) sibling.value = e.currentTarget.value;
        }} />
        <input type="text" name={name} defaultValue={defaultValue} className="h-10 w-full rounded-[10px] border border-border bg-card px-3 text-sm text-text-primary" />
      </div>
    </div>
  );
}

const BRAND_IMAGE_FIELDS: { field: "logoUrl" | "logoLightUrl" | "logoDarkUrl" | "faviconUrl"; label: string }[] = [
  { field: "logoUrl", label: "Logo principal" },
  { field: "logoLightUrl", label: "Logo (modo claro)" },
  { field: "logoDarkUrl", label: "Logo (modo escuro)" },
  { field: "faviconUrl", label: "Favicon" },
];

export function BrandImagesPanel({ current }: { current: Record<string, string | null> }) {
  return (
    <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2">
      {BRAND_IMAGE_FIELDS.map(({ field, label }) => (
        <BrandImageUploader key={field} field={field} label={label} currentUrl={current[field] ?? null} />
      ))}
    </div>
  );
}

function BrandImageUploader({
  field,
  label,
  currentUrl,
}: {
  field: "logoUrl" | "logoLightUrl" | "logoDarkUrl" | "faviconUrl";
  label: string;
  currentUrl: string | null;
}) {
  const action = uploadMediaBrandImageAction.bind(null, field);
  const [state, formAction, pending] = useActionState(action, initialState);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form action={formAction} className="flex items-center gap-3">
      {currentUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={currentUrl} alt={label} className="h-12 w-12 rounded-[10px] border border-border object-contain" />
      ) : (
        <div className="h-12 w-12 rounded-[10px] border border-dashed border-border" />
      )}
      <div className="flex flex-col gap-1">
        <span className="text-sm text-text-secondary">{label}</span>
        <input
          ref={inputRef}
          type="file"
          name="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => e.target.form?.requestSubmit()}
        />
        <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={() => inputRef.current?.click()}>
          {pending ? "Enviando..." : "Enviar imagem"}
        </Button>
        {(state.error || state.success) && <FormMessage error={state.error} success={state.success} />}
      </div>
    </form>
  );
}
