"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { formatBytes } from "@/features/media/client-image";
import { UPLOADS_BUCKET } from "@/features/media/urls";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { deleteModelVersion, publishModel, unpublishModel } from "../actions/model";
import type { ModelVersion } from "../data";
import { Spinner } from "../SubmitButton";
import { Badge, Notice, buttonClass, inputClass } from "../ui";
import { ModelPreview } from "./ModelPreview";

interface Props {
  dishId: string;
  restaurantId: string;
  activeModelId: string | null;
  models: ModelVersion[];
  posterUrl: string | null;
}

type Phase = { kind: "idle" } | { kind: "uploading"; mb: string } | { kind: "processing"; label: string } | { kind: "error"; message: string };

const MAX_UPLOAD = 50 * 1024 * 1024;

/**
 * 3D model workflow for one dish:
 *   upload .glb (direct to storage) → server optimizes → review + real size → publish.
 * Every processing run creates a new version; the published one is what diners see.
 */
export function ModelManager({ dishId, restaurantId, activeModelId, models, posterUrl }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const glbInput = useRef<HTMLInputElement>(null);
  const usdzInput = useRef<HTMLInputElement>(null);
  const [usdzFile, setUsdzFile] = useState<File | null>(null);

  const ready = models.filter((m) => m.status === "ready");
  // Version under review: the one the owner picked, else the newest that isn't live, else the live one.
  const selected =
    models.find((m) => m.id === selectedId && m.status === "ready") ?? ready.find((m) => m.id !== activeModelId && isNewest(m, models)) ?? ready.find((m) => m.id === activeModelId) ?? null;
  const busy = phase.kind === "uploading" || phase.kind === "processing" || pending;

  async function process(body: { rawPath: string; usdzRawPath?: string | null; targetSizeCm?: number | null }, label: string) {
    setPhase({ kind: "processing", label });
    const response = await fetch("/api/models/process", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dishId, ...body }),
    });
    const result = (await response.json().catch(() => ({}))) as { modelId?: string; error?: string };
    // Inside a transition: buttons stay disabled until the refreshed version
    // list (with the new version) is on screen.
    startTransition(() => {
      if (!response.ok) {
        setPhase({ kind: "error", message: result.error ?? "Le traitement a échoué." });
      } else {
        setPhase({ kind: "idle" });
        setSelectedId(result.modelId ?? null);
      }
      router.refresh();
    });
  }

  async function onPickGlb(file: File) {
    if (!/\.glb$/i.test(file.name)) return setPhase({ kind: "error", message: "Choisissez un fichier .glb (exporté depuis votre application de scan)." });
    if (file.size > MAX_UPLOAD) return setPhase({ kind: "error", message: `Fichier trop lourd (${formatBytes(file.size)}). Maximum 50 Mo : exportez le scan en qualité moyenne.` });
    const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    if (String.fromCharCode(...head) !== "glTF") return setPhase({ kind: "error", message: "Ce fichier n'est pas un .glb valide." });

    const supabase = getBrowserSupabase();
    const folder = `${restaurantId}/raw/${dishId}`;
    setPhase({ kind: "uploading", mb: formatBytes(file.size) });
    const rawPath = `${folder}/${crypto.randomUUID()}.glb`;
    const uploaded = await supabase.storage.from(UPLOADS_BUCKET).upload(rawPath, file, { contentType: "model/gltf-binary" });
    if (uploaded.error) return setPhase({ kind: "error", message: "Envoi impossible. Vérifiez la connexion et réessayez." });

    let usdzRawPath: string | null = null;
    if (usdzFile) {
      usdzRawPath = `${folder}/${crypto.randomUUID()}.usdz`;
      const up = await supabase.storage.from(UPLOADS_BUCKET).upload(usdzRawPath, usdzFile, { contentType: "model/vnd.usdz+zip" });
      if (up.error) usdzRawPath = null;
    }
    await process({ rawPath, usdzRawPath }, "Optimisation du modèle… (10 à 60 secondes)");
  }

  return (
    <div className="space-y-5">
      {activeModelId ? (
        <Notice tone="success">Ce plat est en 3D sur votre menu : vos clients peuvent le poser sur leur table.</Notice>
      ) : (
        <p className="text-sm text-muted">
          Scannez le plat avec une application comme Polycam ou Scaniverse (iPhone/Android), exportez-le au format <b>.glb</b>, puis importez-le ici. Dishly
          l&apos;optimise et prépare automatiquement la version iPhone.
        </p>
      )}

      {selected?.glbUrl ? (
        <VersionReview
          key={selected.id}
          version={selected}
          isLive={selected.id === activeModelId}
          posterUrl={posterUrl}
          busy={busy}
          onResize={(cm) => process({ rawPath: selected.raw_path!, targetSizeCm: cm }, `Mise à la taille réelle (${cm} cm)…`)}
          onPublish={() =>
            startTransition(async () => {
              const result = await publishModel(dishId, selected.id);
              if (result.error) setPhase({ kind: "error", message: result.error });
            })
          }
          onUnpublish={() => startTransition(() => unpublishModel(dishId))}
        />
      ) : null}

      {pending && phase.kind === "idle" ? (
        <div className="flex items-center gap-3 rounded-2xl bg-[#f6f3ee] px-4 py-3 text-sm text-ink">
          <Spinner className="size-5" />
          Mise à jour…
        </div>
      ) : null}
      {phase.kind === "uploading" || phase.kind === "processing" ? (
        <div className="flex items-center gap-3 rounded-2xl bg-[#f6f3ee] px-4 py-3 text-sm text-ink">
          <Spinner className="size-5" />
          {phase.kind === "uploading" ? `Envoi du fichier (${phase.mb})…` : phase.label}
        </div>
      ) : null}
      {phase.kind === "error" ? <Notice tone="error">{phase.message}</Notice> : null}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={buttonClass.primary} disabled={busy} onClick={() => glbInput.current?.click()}>
          {models.length ? "Importer un nouveau scan (.glb)" : "Importer un scan (.glb)"}
        </button>
        <details className="text-sm text-muted">
          <summary className="cursor-pointer select-none">Options avancées</summary>
          <div className="mt-2 space-y-1">
            <p>Fichier iPhone .usdz déjà prêt (facultatif). Sinon, il est généré automatiquement.</p>
            <input
              ref={usdzInput}
              type="file"
              accept=".usdz"
              className={`${inputClass} max-w-xs py-1.5`}
              onChange={(e) => setUsdzFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </details>
        <input
          ref={glbInput}
          type="file"
          accept=".glb,model/gltf-binary"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void onPickGlb(file);
          }}
        />
      </div>

      {models.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-ink">Versions</h3>
          <ul className="divide-y divide-line rounded-2xl ring-1 ring-line">
            {models.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
                <span className="text-muted tabular-nums">{new Date(m.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span>
                {m.id === activeModelId ? <Badge tone="good">En ligne</Badge> : null}
                {m.status === "ready" ? <span className="text-ink">{footprint(m)} cm</span> : null}
                {m.status === "processing" ? <Badge tone="neutral">En cours…</Badge> : null}
                {m.status === "failed" ? <Badge tone="bad">Échec</Badge> : null}
                {m.status === "ready" && m.glb_bytes ? <span className="text-muted">{formatBytes(m.glb_bytes)}</span> : null}
                {m.error ? <span className="w-full text-red-700">{m.error}</span> : null}
                <span className="ms-auto flex gap-2">
                  {m.status === "ready" && m.id !== selected?.id ? (
                    <button type="button" className="font-semibold text-ink underline-offset-4 hover:underline" onClick={() => setSelectedId(m.id)}>
                      Voir
                    </button>
                  ) : null}
                  {m.id !== activeModelId && m.status !== "processing" ? (
                    <button
                      type="button"
                      className="font-semibold text-red-700 underline-offset-4 hover:underline disabled:opacity-40"
                      disabled={busy}
                      onClick={() => {
                        if (confirm("Supprimer cette version ?")) startTransition(async () => void (await deleteModelVersion(dishId, m.id)));
                      }}
                    >
                      Supprimer
                    </button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function VersionReview({
  version,
  isLive,
  posterUrl,
  busy,
  onResize,
  onPublish,
  onUnpublish,
}: {
  version: ModelVersion;
  isLive: boolean;
  posterUrl: string | null;
  busy: boolean;
  onResize: (cm: number) => void;
  onPublish: () => void;
  onUnpublish: () => void;
}) {
  const current = footprint(version);
  const [size, setSize] = useState(current);
  const valid = Number.isFinite(size) && size >= 1 && size <= 200;
  const changed = valid && Math.abs(size - current) >= 0.5;

  return (
    <div className="grid gap-5 rounded-2xl bg-[#f6f3ee] p-4 md:grid-cols-[1.2fr_1fr]">
      <ModelPreview src={version.glbUrl!} scale={current > 0 ? size / current : 1} poster={posterUrl} />
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {isLive ? <Badge tone="good">Version en ligne</Badge> : <Badge tone="warn">Pas encore publiée</Badge>}
          {version.usdz_origin === "owner" ? <Badge>.usdz fourni</Badge> : null}
        </div>

        <div>
          <label htmlFor="size" className="text-sm font-semibold text-ink">
            Taille réelle : {fmt(size)} cm
          </label>
          <p className="text-xs text-muted">La plus grande largeur du plat vu de dessus (diamètre de l&apos;assiette, largeur du gâteau…). C&apos;est la taille exacte en réalité augmentée.</p>
          <input
            id="size"
            type="range"
            min={3}
            max={Math.max(60, Math.ceil(current * 1.5))}
            step={0.5}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="mt-2 w-full accent-[#b4532a]"
          />
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={200}
              step={0.5}
              value={size}
              onChange={(e) => setSize(e.target.value === "" ? 0 : Number(e.target.value))}
              className={`${inputClass} w-24 py-1.5`}
              aria-label="Taille en centimètres"
            />
            <span className="text-sm text-muted">cm</span>
            {changed ? (
              <button type="button" className={buttonClass.small} disabled={busy} onClick={() => onResize(Math.round(size * 2) / 2)}>
                Appliquer cette taille
              </button>
            ) : null}
            {!valid ? <span className="text-xs font-semibold text-red-700">Entre 1 et 200 cm</span> : null}
          </div>
          {version.size_cm ? (
            <p className="mt-2 text-xs text-muted">
              Actuellement {fmt(version.size_cm.x)} × {fmt(version.size_cm.z)} cm, hauteur {fmt(version.size_cm.y)} cm.
            </p>
          ) : null}
        </div>

        <dl className="grid grid-cols-2 gap-2 text-xs text-muted">
          <div>
            <dt>Web / Android</dt>
            <dd className="font-semibold text-ink">{version.glb_bytes ? formatBytes(version.glb_bytes) : "—"}</dd>
          </div>
          <div>
            <dt>iPhone (AR)</dt>
            <dd className="font-semibold text-ink">{version.usdz_bytes ? formatBytes(version.usdz_bytes) : "—"}</dd>
          </div>
          <div>
            <dt>Fichier d&apos;origine</dt>
            <dd className="font-semibold text-ink">{version.original_bytes ? formatBytes(version.original_bytes) : "—"}</dd>
          </div>
          <div>
            <dt>Triangles</dt>
            <dd className="font-semibold text-ink">{version.triangle_count?.toLocaleString("fr-FR") ?? "—"}</dd>
          </div>
        </dl>

        {version.warnings.length ? (
          <Notice tone="warn">
            <ul className="list-disc space-y-1 ps-4">
              {version.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </Notice>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {isLive ? (
            <button type="button" className={buttonClass.secondary} disabled={busy} onClick={onUnpublish}>
              Retirer la 3D du menu
            </button>
          ) : (
            <button type="button" className={buttonClass.primary} disabled={busy || changed || !valid} onClick={onPublish} title={changed ? "Appliquez d'abord la nouvelle taille" : undefined}>
              Publier sur le menu
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function footprint(m: ModelVersion): number {
  return m.size_cm ? Math.round(Math.max(m.size_cm.x, m.size_cm.z) * 2) / 2 : 0;
}

function isNewest(m: ModelVersion, all: ModelVersion[]): boolean {
  return all[0]?.id === m.id;
}

function fmt(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
}
