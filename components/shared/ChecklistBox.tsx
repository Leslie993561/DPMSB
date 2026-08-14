export function ChecklistBox({ itens, titulo = "Checklist" }: { itens: string[]; titulo?: string }) {
  if (itens.length === 0) return null;

  return (
    <div className="rounded-lg border border-brand-surface px-4 py-3 text-sm dark:border-brand-neutral/30">
      <p className="mb-2 font-medium text-foreground">{titulo}</p>
      <ul className="space-y-1.5">
        {itens.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-foreground-muted">
            <input type="checkbox" className="mt-1 accent-brand-primary" readOnly />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
