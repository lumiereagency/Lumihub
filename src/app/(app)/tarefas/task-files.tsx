"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ExternalLink, FileText, Film, ImageIcon, Link2, Paperclip, Star, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/cn";
import { addTaskAttachmentAction, deleteTaskAttachmentAction, setTaskCoverAction, uploadTaskFilesAction, type TaskDetails } from "@/lib/actions/task-board-actions";

// Arquivos e links do cartão: arrastar e soltar, colar print (Ctrl+V),
// escolher do celular, imagem como capa e links com o serviço reconhecido.

const SERVICES: { test: RegExp; label: string; color: string }[] = [
  { test: /docs\.google\.com\/document/, label: "Google Docs", color: "bg-[#4285F4]" },
  { test: /docs\.google\.com\/spreadsheets/, label: "Google Sheets", color: "bg-[#0F9D58]" },
  { test: /docs\.google\.com\/presentation/, label: "Google Slides", color: "bg-[#F4B400]" },
  { test: /drive\.google\.com|docs\.google\.com/, label: "Google Drive", color: "bg-[#1FA463]" },
  { test: /figma\.com/, label: "Figma", color: "bg-[#A259FF]" },
  { test: /canva\.(com|link)/, label: "Canva", color: "bg-[#00C4CC]" },
  { test: /youtube\.com|youtu\.be/, label: "YouTube", color: "bg-[#FF0000]" },
  { test: /instagram\.com/, label: "Instagram", color: "bg-[#E1306C]" },
  { test: /tiktok\.com/, label: "TikTok", color: "bg-[#111]" },
  { test: /notion\.(so|site)/, label: "Notion", color: "bg-[#333]" },
  { test: /dropbox\.com/, label: "Dropbox", color: "bg-[#0061FF]" },
  { test: /wetransfer\.com|we\.tl/, label: "WeTransfer", color: "bg-[#409FFF]" },
  { test: /frame\.io/, label: "Frame.io", color: "bg-[#5B53FF]" },
  { test: /pinterest\./, label: "Pinterest", color: "bg-[#E60023]" },
];

function service(url: string) {
  return SERVICES.find((s) => s.test.test(url)) ?? null;
}

function sizeLabel(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

export function TaskFiles({
  taskId,
  details,
  canEdit,
  reload,
  notify,
}: {
  taskId: string;
  details: TaskDetails | null;
  canEdit: boolean;
  reload: () => void;
  notify: (msg: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [addingLink, setAddingLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(files: File[]) {
    if (!canEdit || files.length === 0) return;
    setUploading(files.length);
    const fd = new FormData();
    files.slice(0, 10).forEach((f, i) => fd.append("files", f.name ? f : new File([f], `print-${Date.now()}-${i}.png`, { type: f.type })));
    const res = await uploadTaskFilesAction(taskId, fd);
    setUploading(0);
    if (!res.ok) notify(res.error);
    reload();
  }

  // Colar print direto no cartão (Ctrl+V / Cmd+V), sem precisar salvar arquivo.
  useEffect(() => {
    if (!canEdit) return;
    function onPaste(e: ClipboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA") && !e.clipboardData?.files.length) return;
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length) {
        e.preventDefault();
        upload(files);
      }
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, taskId]);

  const attachments = details?.attachments ?? [];
  const images = attachments.filter((a) => a.isFile && a.mimeType?.startsWith("image/"));
  const otherFiles = attachments.filter((a) => a.isFile && !a.mimeType?.startsWith("image/"));
  const links = attachments.filter((a) => !a.isFile);

  return (
    <section
      className="flex flex-col gap-3"
      onDragOver={(e) => {
        if (!canEdit || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={(e) => {
        if (!canEdit) return;
        e.preventDefault();
        setDragging(false);
        upload(Array.from(e.dataTransfer.files));
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <Paperclip size={16} className="text-text-tertiary" /> Arquivos e links
        </h3>
        {canEdit && (
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => inputRef.current?.click()} className="flex items-center gap-1 text-sm font-medium text-accent-light hover:underline">
              <Upload size={14} /> Enviar arquivo
            </button>
            {!addingLink && (
              <button type="button" onClick={() => setAddingLink(true)} className="flex items-center gap-1 text-sm font-medium text-text-secondary hover:text-text-primary">
                <Link2 size={14} /> Link
              </button>
            )}
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          onChange={(e) => {
            upload(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>

      {canEdit && (dragging || uploading > 0 || attachments.length === 0) && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed px-4 py-6 text-center text-sm transition-colors",
            dragging ? "border-accent bg-accent/10 text-text-primary" : "border-border text-text-tertiary hover:border-text-tertiary",
          )}
        >
          <Upload size={18} />
          {uploading > 0 ? `Enviando ${uploading} arquivo(s)…` : dragging ? "Solte para anexar" : "Arraste imagens, PDFs ou vídeos aqui, cole um print (Ctrl+V) ou toque para escolher"}
          <span className="text-xs text-text-tertiary">até 20 MB por arquivo</span>
        </button>
      )}

      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {images.map((img) => (
            <figure key={img.id} className="group/img relative overflow-hidden rounded-xl border border-border bg-card-elevated">
              <a href={img.url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.name} loading="lazy" className="aspect-[4/3] w-full object-cover" />
              </a>
              {img.isCover && <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">Capa</span>}
              {canEdit && (
                <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover/img:opacity-100 focus-within:opacity-100">
                  <button
                    type="button"
                    title={img.isCover ? "Tirar da capa" : "Usar como capa"}
                    onClick={async () => {
                      const r = await setTaskCoverAction(taskId, img.isCover ? null : img.id);
                      if (!r.ok) notify(r.error);
                      reload();
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                  >
                    <Star size={13} className={img.isCover ? "fill-current" : ""} />
                  </button>
                  <button
                    type="button"
                    title="Remover"
                    onClick={async () => {
                      await deleteTaskAttachmentAction(img.id);
                      reload();
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-error"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
              <figcaption className="truncate px-2 py-1.5 text-[11px] text-text-tertiary">{img.name}</figcaption>
            </figure>
          ))}
        </div>
      )}

      {(otherFiles.length > 0 || links.length > 0) && (
        <ul className="flex flex-col gap-1.5">
          {otherFiles.map((f) => {
            const Icon = f.mimeType?.startsWith("video/") ? Film : f.mimeType === "application/pdf" ? FileText : ImageIcon;
            return (
              <li key={f.id} className="group/link flex items-center gap-3 rounded-xl bg-card-elevated px-3 py-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-card text-text-secondary">
                  <Icon size={15} />
                </span>
                <a href={f.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-text-primary hover:text-accent-light">{f.name}</span>
                  <span className="text-[11px] text-text-tertiary">{sizeLabel(f.size)}</span>
                </a>
                <a href={`${f.url}?baixar=1`} className="flex h-7 w-7 items-center justify-center rounded-full text-text-tertiary hover:text-text-primary" aria-label={`Baixar ${f.name}`}>
                  <Download size={13} />
                </a>
                {canEdit && (
                  <button
                    type="button"
                    onClick={async () => {
                      await deleteTaskAttachmentAction(f.id);
                      reload();
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-text-tertiary opacity-0 hover:text-error group-hover/link:opacity-100 focus:opacity-100"
                    aria-label={`Remover ${f.name}`}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </li>
            );
          })}
          {links.map((l) => {
            const s = service(l.url);
            return (
              <li key={l.id} className="group/link flex items-center gap-3 rounded-xl bg-card-elevated px-3 py-2">
                <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white", s ? s.color : "bg-card text-text-secondary")}>
                  {s ? s.label.split(" ").map((w) => w[0]).join("").slice(0, 2) : <ExternalLink size={14} />}
                </span>
                <a href={l.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-text-primary hover:text-accent-light">{l.name}</span>
                  <span className="text-[11px] text-text-tertiary">{s?.label ?? new URL(l.url).hostname.replace(/^www\./, "")}</span>
                </a>
                {canEdit && (
                  <button
                    type="button"
                    onClick={async () => {
                      await deleteTaskAttachmentAction(l.id);
                      reload();
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-text-tertiary opacity-0 hover:text-error group-hover/link:opacity-100 focus:opacity-100"
                    aria-label={`Remover ${l.name}`}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {addingLink && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await addTaskAttachmentAction(taskId, linkName, linkUrl);
            if (!r.ok) return notify(r.error);
            setLinkName("");
            setLinkUrl("");
            setAddingLink(false);
            reload();
          }}
          className="flex flex-col gap-2 rounded-2xl border border-border p-3"
        >
          <input autoFocus value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="Cole o link do Drive, Canva, Figma, YouTube…" className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-4 focus:ring-accent/15" aria-label="Endereço do link" />
          <input value={linkName} onChange={(e) => setLinkName(e.target.value)} placeholder="Nome (opcional) — ex: Roteiro aprovado" className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-4 focus:ring-accent/15" aria-label="Nome do link" />
          {linkUrl && service(linkUrl) && <p className="text-xs text-text-tertiary">Reconhecido: {service(linkUrl)!.label}</p>}
          <div className="flex gap-2">
            <button type="submit" className="h-9 rounded-full bg-ink px-4 text-sm font-medium text-ink-on hover:opacity-90">
              Salvar link
            </button>
            <button type="button" onClick={() => setAddingLink(false)} className="h-9 rounded-full px-4 text-sm font-medium text-text-secondary hover:bg-card-elevated">
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
