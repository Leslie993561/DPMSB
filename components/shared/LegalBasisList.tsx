export function LegalBasisList({ itens, fonte }: { itens: string[]; fonte?: string }) {
  if (itens.length === 0) return null;

  return (
    <div className="rounded-lg border border-brand-surface px-4 py-3 text-sm dark:border-brand-neutral/30">
      <p className="mb-2 font-medium text-foreground">Base legal</p>
      <ul className="list-inside list-disc space-y-1 text-foreground-muted">
        {itens.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
      {fonte && <p className="mt-2 text-xs text-brand-neutral">Tabela legal: {fonte}</p>}
    </div>
  );
}
