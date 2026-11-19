import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';

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

  const connected = printers.filter((printer) => printer.agentId && printer.healthStatus === 'ONLINE');
  const downloadUrl = `${window.location.origin}/downloads/inklly-print-app.zip`;
  const os = /Windows/i.test(navigator.userAgent) ? 'windows' : /Mac/i.test(navigator.userAgent) ? 'mac' : 'linux';

  return (
    <section aria-labelledby="printer-setup-title" className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-xs space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="printer-setup-title" className="text-base font-extrabold text-[var(--text-primary)]">Connect your printers</h3>
          <p className="mt-1 text-xs text-[var(--text-secondary)] max-w-2xl">
            Install the free Inklly Print App on the computer your printers are plugged into. Then the Counter sends each file
            straight to the printer you choose — no print dialog. You can always use <strong>Print on this computer</strong> on the Counter without it.
          </p>
        </div>
        <span className={`status-pill ${connected.length ? 'pill-success' : 'pill-neutral'}`}>
          {connected.length ? `✓ ${connected.length} printer${connected.length > 1 ? 's' : ''} connected` : 'Not connected yet'}
        </span>
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

      <ol className="grid gap-3 lg:grid-cols-3">
        <li className="rounded-xl border border-[var(--border-default)] p-4">
          <p className="text-xs font-extrabold text-[var(--text-primary)]"><span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand)] text-[10px] text-white">1</span>Download the print app</p>
          <p className="mt-1 text-[11px] text-[var(--text-secondary)]">Do this on the computer connected to your printers. Windows, Mac or Linux · 7 MB.</p>
          <a href={downloadUrl} download className="mt-3 inline-flex min-h-[40px] items-center rounded-lg bg-[var(--brand)] px-4 text-xs font-bold text-white hover:bg-[var(--brand-hover)]">⬇ Download Inklly Print App</a>
        </li>
        <li className="rounded-xl border border-[var(--border-default)] p-4">
          <p className="text-xs font-extrabold text-[var(--text-primary)]"><span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand)] text-[10px] text-white">2</span>Unzip and start it</p>
          {os === 'windows' && <p className="mt-1 text-[11px] text-[var(--text-secondary)]">Right-click the zip → <strong>Extract All</strong>. Open the folder and double-click <strong>Start Inklly (Windows)</strong>. The first time it installs Node.js (free) — then double-click it again.</p>}
          {os === 'mac' && <p className="mt-1 text-[11px] text-[var(--text-secondary)]">Open the zip. Right-click <strong>Start Inklly (Mac).command</strong> → <strong>Open</strong>. If asked, install Node.js LTS from nodejs.org and open it again.</p>}
          {os === 'linux' && <p className="mt-1 text-[11px] text-[var(--text-secondary)]">Unzip, then run <code>./start-inklly-linux.sh</code> in a terminal (needs Node.js 22+).</p>}
          <p className="mt-2 text-[10px] text-[var(--text-muted)]">Install your printers on that computer first, as you normally would.</p>
        </li>
        <li className="rounded-xl border border-[var(--border-default)] p-4">
          <p className="text-xs font-extrabold text-[var(--text-primary)]"><span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand)] text-[10px] text-white">3</span>Enter the pairing code</p>
          <p className="mt-1 text-[11px] text-[var(--text-secondary)]">The app asks for a code. Create one here and type or paste it in.</p>
          {pairing ? (
            <div className="mt-3 rounded-xl bg-[#0D1422] p-3 text-white">
              <p className="font-mono text-lg font-black tracking-wider break-all">{pairing.pairingCode}</p>
              <p className="text-[10px] text-[#A6B2C5]">Works once · valid until {new Date(pairing.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => copy(pairing.pairingCode, 'Pairing code')} className="rounded-lg bg-white/15 px-3 py-1.5 text-[11px] font-bold hover:bg-white/25 cursor-pointer">Copy</button>
                <button type="button" onClick={createPairingCode} disabled={pairingBusy} className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-[#A6B2C5] hover:text-white cursor-pointer">New code</button>
              </div>
              {connected.length > 0
                ? <p className="mt-2 text-[11px] font-bold text-emerald-300">✓ Connected — your printers are listed below.</p>
                : <p className="mt-2 text-[11px] text-[#A6B2C5]">Waiting for your computer to connect…</p>}
            </div>
          ) : (
            <button type="button" onClick={createPairingCode} disabled={pairingBusy} className="mt-3 min-h-[40px] rounded-lg bg-[var(--brand)] px-4 text-xs font-bold text-white hover:bg-[var(--brand-hover)] disabled:opacity-60 cursor-pointer">
              {pairingBusy ? 'Creating…' : 'Create pairing code'}
            </button>
          )}
        </li>
      </ol>

      {/* Step 2 */}
      <div className="space-y-3">
        <p className="text-xs font-extrabold text-[var(--text-primary)]">
          Your printers
        </p>
        <p className="text-[11px] text-[var(--text-secondary)]">Colour, both-sides and paper sizes are read from each printer’s driver. Correct them here if needed; the Counter uses them to suggest the right printer.</p>

        {loading ? (
          <p className="py-6 text-center text-xs text-[var(--text-secondary)]" role="status">Loading printers…</p>
        ) : printers.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border-strong)] py-8 text-center text-xs text-[var(--text-secondary)]">
            No printers yet. They appear here a few seconds after the print app connects.
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
