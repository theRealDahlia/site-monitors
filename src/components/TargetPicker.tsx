"use client";

export interface Target {
  id: string;
  kind: "email" | "slack" | "discord";
  label: string;
  active: boolean;
}

const KIND_LABEL: Record<Target["kind"], string> = { email: "Email", slack: "Slack", discord: "Discord" };

/** Checkboxes for choosing alert destinations, grouped by kind. Destinations that are off say so. */
export default function TargetPicker({
  targets,
  chosen,
  onChange,
  disabled,
  idPrefix,
}: {
  targets: Target[];
  chosen: Set<string>;
  onChange: (next: Set<string>) => void;
  disabled?: boolean;
  idPrefix: string;
}) {
  return (
    <ul className="space-y-1.5">
      {targets.map((t) => {
        const id = `${idPrefix}-${t.id.replace(":", "-")}`;
        return (
          <li key={t.id} className="flex items-center gap-2 text-sm">
            <input
              id={id}
              type="checkbox"
              checked={chosen.has(t.id)}
              disabled={disabled}
              onChange={(e) => {
                const next = new Set(chosen);
                if (e.target.checked) next.add(t.id);
                else next.delete(t.id);
                onChange(next);
              }}
              className="accent-[var(--accent)]"
            />
            <label htmlFor={id} className="min-w-0 truncate">
              <span className="text-muted">{KIND_LABEL[t.kind]}:</span> {t.label}
              {!t.active && <span className="ml-1.5 text-xs text-warn">(off or not confirmed, so it gets nothing)</span>}
            </label>
          </li>
        );
      })}
    </ul>
  );
}
