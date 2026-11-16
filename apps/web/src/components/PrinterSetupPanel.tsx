import React, { useCallback, useEffect, useState } from 'react';
import { api, API_BASE } from '../api/client';

interface ShopPrinter {
  id: string;
  name: string;
  systemDriverName: string;
  agentId?: string;
  isDefault: boolean;
  supportsColor: boolean;
  supportsDuplex: boolean;
  healthStatus: 'ONLINE' | 'OFFLINE' | 'STALE' | 'UNKNOWN';
  trays: Array<{ supportedSizes: string[] }>;
}

interface Draft {
  supportsColor: boolean;
  supportsDuplex: boolean;
  paperSizes: string[];
}

const PAPER_OPTIONS = ['A4', 'A3'] as const;

const draftFromPrinter = (printer: ShopPrinter): Draft => {
  const sizes = [...new Set(printer.trays.flatMap((tray) => tray.supportedSizes))].filter((size) =>
    (PAPER_OPTIONS as readonly string[]).includes(size)
  );
  return { supportsColor: printer.supportsColor, supportsDuplex: printer.supportsDuplex, paperSizes: sizes.length ? sizes : ['A4'] };
};

const HEALTH: Record<ShopPrinter['healthStatus'], { label: string; tone: string }> = {
  ONLINE: { label: 'Online', tone: 'pill-success' },
  OFFLINE: { label: 'Offline', tone: 'pill-danger' },
  STALE: { label: 'No recent signal', tone: 'pill-warning' },
  UNKNOWN: { label: 'Not connected', tone: 'pill-neutral' },
};

const Toggle: React.FC<{ checked: boolean; onChange: (next: boolean) => void; label: string }> = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`min-h-[36px] px-3 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
      checked
        ? 'border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]'
        : 'border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)]'
    }`}
  >
    {checked ? '✓ ' : ''}
    {label}
  </button>
);

/**
 * Everything a shop needs to get from "no printer" to "press Print":
 * pair the counter computer, then tell Inklly what each discovered printer can do.
 */
export const PrinterSetupPanel: React.FC<{ onChanged?: () => void }> = ({ onChanged }) => {
  const [printers, setPrinters] = useState<ShopPrinter[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pairing, setPairing] = useState<{ pairingCode: string; expiresAt: string; shopId: string } | null>(null);
  const [pairingBusy, setPairingBusy] = useState(false);

  const load = useCallback(async (keepDrafts = false) => {
    try {
      const result = (await api.getPrinters()) as ShopPrinter[];
      if (!Array.isArray(result)) throw new Error('Printer list is unavailable.');
      setPrinters(result);
      setDrafts((current) =>
        Object.fromEntries(result.map((printer) => [printer.id, keepDrafts && current[printer.id] ? current[printer.id] : draftFromPrinter(printer)]))
      );
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load printers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    // Pick up printers the agent reports after pairing, without a manual refresh.
    const timer = window.setInterval(() => void load(true), 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const createPairingCode = async () => {
    setPairingBusy(true);
    setError('');
    try {
      setPairing(await api.createAgentPairingCode());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create a pairing code.');
    } finally {
      setPairingBusy(false);
    }
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`${label} copied.`);
    } catch {
      setNotice(`Could not copy automatically. Select the ${label.toLowerCase()} and copy it by hand.`);
    }
    window.setTimeout(() => setNotice(''), 3000);
  };

  const saveProfile = async (printer: ShopPrinter) => {
    const draft = drafts[printer.id];
    if (!draft || !draft.paperSizes.length) return;
    setSavingId(printer.id);
    setError('');
    try {
      await api.updatePrinter(printer.id, draft);
      await load();
      setNotice(`${printer.name} saved. Orders that fit it can now be sent to it.`);
      onChanged?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the printer.');
    } finally {
      setSavingId(null);
      window.setTimeout(() => setNotice(''), 4000);
    }
  };

  const makeDefault = async (printer: ShopPrinter) => {
    setSavingId(printer.id);
    try {
      await api.setDefaultPrinter(printer.id);
      await load(true);
      onChanged?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not set the default printer.');
    } finally {
      setSavingId(null);
    }
  };

  const updateDraft = (id: string, patch: Partial<Draft>) => setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }));

  const agentCommand = pairing
    ? `set INKLLY_SERVER_URL=${API_BASE}\nset INKLLY_SHOP_ID=${pairing.shopId}\nset INKLLY_PAIRING_CODE=${pairing.pairingCode}\nstart-agent.bat`
    : '';

  return (
    <section aria-labelledby="printer-setup-title" className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-xs space-y-6">
      <div>
        <h3 id="printer-setup-title" className="text-sm font-extrabold text-[var(--text-primary)]">Connect your counter printers</h3>
        <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
          Two steps: pair the counter computer once, then confirm what each printer can print.
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-[var(--status-danger)]/30 bg-[var(--status-danger-bg)] px-4 py-3 text-xs font-semibold text-[var(--status-danger)]">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="rounded-xl bg-[var(--status-success-bg)] px-4 py-3 text-xs font-semibold text-[var(--status-success)]">
          {notice}
        </div>
      )}

      {/* Step 1 */}
      <div className="rounded-xl border border-[var(--border-default)] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold text-[var(--text-primary)]">
              <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand)] text-[10px] text-white">1</span>
              Pair the counter computer
            </p>
            <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
              Run the Inklly print agent on the Windows PC your printers are connected to, and give it this one-time code.
            </p>
          </div>
          <button
            type="button"
            onClick={createPairingCode}
            disabled={pairingBusy}
            className="min-h-[36px] rounded-lg bg-[var(--brand)] px-4 text-xs font-bold text-white hover:bg-[var(--brand-hover)] disabled:opacity-60 cursor-pointer"
          >
            {pairingBusy ? 'Creating…' : pairing ? 'New pairing code' : 'Get pairing code'}
          </button>
        </div>

        {pairing && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl bg-[#0D1422] p-4 text-white">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[#8293FF]">Pairing code</p>
              <p className="my-1 break-all font-mono text-2xl font-black tracking-wider">{pairing.pairingCode}</p>
              <p className="text-[11px] text-[#A6B2C5]">
                Shop ID <span className="font-mono text-white">{pairing.shopId}</span> · valid until{' '}
                {new Date(pairing.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · works once
              </p>
              <button type="button" onClick={() => copy(pairing.pairingCode, 'Pairing code')} className="mt-3 rounded-lg bg-white/10 px-3 py-1.5 text-[11px] font-bold hover:bg-white/20 cursor-pointer">
                Copy code
              </button>
            </div>
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface-subtle)] p-4">
              <p className="text-[11px] font-bold text-[var(--text-primary)]">On the counter PC, in the agent folder:</p>
              <pre className="my-2 overflow-x-auto rounded-lg bg-[var(--bg-surface-muted)] p-3 text-[10px] leading-5 text-[var(--text-primary)]">{agentCommand}</pre>
              <button type="button" onClick={() => copy(agentCommand, 'Commands')} className="rounded-lg border border-[var(--border-strong)] px-3 py-1.5 text-[11px] font-bold text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] cursor-pointer">
                Copy commands
              </button>
              <p className="mt-2 text-[10px] text-[var(--text-muted)]">
                Your printers appear below within a few seconds of the agent starting.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Step 2 */}
      <div className="space-y-3">
        <p className="text-xs font-extrabold text-[var(--text-primary)]">
          <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand)] text-[10px] text-white">2</span>
          Confirm what each printer can do
        </p>

        {loading ? (
          <p className="py-6 text-center text-xs text-[var(--text-secondary)]" role="status">Loading printers…</p>
        ) : printers.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border-strong)] py-8 text-center text-xs text-[var(--text-secondary)]">
            No printers yet. They appear here once the counter computer is paired.
          </p>
        ) : (
          printers.map((printer) => {
            const draft = drafts[printer.id] ?? draftFromPrinter(printer);
            const saved = draftFromPrinter(printer);
            const hasProfile = printer.trays.length > 0;
            const dirty = !hasProfile || JSON.stringify({ ...draft, paperSizes: [...draft.paperSizes].sort() }) !== JSON.stringify({ ...saved, paperSizes: [...saved.paperSizes].sort() });
            const health = HEALTH[printer.healthStatus] ?? HEALTH.UNKNOWN;
            return (
              <div key={printer.id} className="rounded-xl border border-[var(--border-default)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[var(--text-primary)]">
                      {printer.name}
                      {printer.isDefault && <span className="ml-2 status-pill pill-brand">Default</span>}
                    </p>
                    <p className="truncate text-[10px] text-[var(--text-muted)]">{printer.systemDriverName}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`status-pill ${health.tone}`}>{health.label}</span>
                    {!hasProfile && <span className="status-pill pill-warning">Needs setup</span>}
                  </div>
                </div>

                {!printer.agentId && (
                  <p className="mt-2 text-[11px] text-[var(--status-warning)]">
                    This printer was added by hand and is not linked to a paired computer, so orders cannot be sent to it.
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Toggle label="Colour" checked={draft.supportsColor} onChange={(next) => updateDraft(printer.id, { supportsColor: next })} />
                  <Toggle label="Prints both sides" checked={draft.supportsDuplex} onChange={(next) => updateDraft(printer.id, { supportsDuplex: next })} />
                  <span className="mx-1 h-5 w-px bg-[var(--border-default)]" />
                  {PAPER_OPTIONS.map((size) => (
                    <Toggle
                      key={size}
                      label={size}
                      checked={draft.paperSizes.includes(size)}
                      onChange={(next) =>
                        updateDraft(printer.id, { paperSizes: next ? [...draft.paperSizes, size] : draft.paperSizes.filter((existing) => existing !== size) })
                      }
                    />
                  ))}
                  <div className="ml-auto flex gap-2">
                    {!printer.isDefault && hasProfile && (
                      <button type="button" disabled={savingId === printer.id} onClick={() => makeDefault(printer)} className="min-h-[36px] rounded-lg border border-[var(--border-strong)] px-3 text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] disabled:opacity-60 cursor-pointer">
                        Make default
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={!dirty || savingId === printer.id || draft.paperSizes.length === 0}
                      onClick={() => saveProfile(printer)}
                      className="min-h-[36px] rounded-lg bg-[var(--brand)] px-4 text-xs font-bold text-white hover:bg-[var(--brand-hover)] disabled:opacity-40 cursor-pointer"
                    >
                      {savingId === printer.id ? 'Saving…' : hasProfile ? (dirty ? 'Save changes' : 'Saved') : 'Save and enable'}
                    </button>
                  </div>
                </div>
                {draft.paperSizes.length === 0 && <p className="mt-2 text-[11px] text-[var(--status-danger)]">Choose at least one paper size.</p>}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};
