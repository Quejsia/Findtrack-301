// Lightweight in-app error report for troubleshooting on phones.
//
// - Always: remembers the last few errors in memory only (nothing is sent anywhere).
// - Only when the page is opened with ?debug=1: shows a small "Debug" button that
//   opens a panel with a copyable report. Open ?debug=0 to turn it off again.
// - Anything that looks like a token, key, password or email address is redacted.

type Entry = { time: string; kind: string; text: string };

const FLAG_KEY = 'ft_debug';
const MAX_ENTRIES = 40;
const MAX_TEXT = 700;
const entries: Entry[] = [];
let installed = false;
let refreshPanel: (() => void) | null = null;

export function redact(input: string): string {
  return input
    .replace(/-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g, '[key]')
    .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, '[jwt]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, '[api-key]')
    .replace(
      /(["']?(?:password|passwd|token|secret|api[_-]?key|authorization|private_key)["']?\s*[:=]\s*)(["'])[^"']*\2/gi,
      '$1$2[redacted]$2'
    )
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]');
}

export function describe(value: unknown): string {
  if (value instanceof Error) {
    const code =
      typeof (value as { code?: unknown }).code === 'string'
        ? `[${(value as { code?: string }).code}] `
        : '';
    const stack = value.stack ? value.stack.split('\n').slice(0, 6).join('\n') : '';
    return `${code}${stack || `${value.name}: ${value.message}`}`;
  }
  if (typeof value === 'string') return value;
  if (value === undefined) return 'undefined';
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function record(kind: string, text: string): void {
  let clean = redact(text);
  if (clean.length > MAX_TEXT) clean = `${clean.slice(0, MAX_TEXT)}…`;
  entries.push({ time: new Date().toISOString().slice(11, 19), kind, text: clean });
  while (entries.length > MAX_ENTRIES) entries.shift();
  if (refreshPanel) refreshPanel();
}

export function buildReport(): string {
  const lines: string[] = [
    'FindTrack debug report',
    `Time: ${new Date().toISOString()}`,
    `Page: ${window.location.origin}${window.location.pathname}`,
    `Viewport: ${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio || 1}x`,
    `Language: ${navigator.language}`,
    `Online: ${navigator.onLine}`,
    `Browser: ${navigator.userAgent}`,
    `Errors recorded: ${entries.length}`,
    '--------',
  ];
  if (entries.length === 0) lines.push('(no errors recorded yet)');
  for (const e of entries) lines.push(`[${e.time}] ${e.kind}: ${e.text}`);
  return redact(lines.join('\n'));
}

function isDebugOn(): boolean {
  try {
    return sessionStorage.getItem(FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

function styleButton(btn: HTMLButtonElement, background: string): void {
  Object.assign(btn.style, {
    background,
    color: '#ffffff',
    border: '0',
    borderRadius: '999px',
    padding: '10px 16px',
    fontSize: '14px',
    fontFamily: 'system-ui, sans-serif',
    cursor: 'pointer',
  });
}

function mountUi(): void {
  if (document.getElementById('ft-debug-root')) return;

  const root = document.createElement('div');
  root.id = 'ft-debug-root';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.textContent = 'Debug';
  styleButton(toggle, '#0f172a');
  Object.assign(toggle.style, {
    position: 'fixed',
    left: '12px',
    bottom: '92px',
    zIndex: '2147483000',
    fontSize: '12px',
    padding: '8px 14px',
    opacity: '0.9',
  });

  const panel = document.createElement('div');
  Object.assign(panel.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2147483001',
    background: 'rgba(15, 23, 42, 0.96)',
    display: 'none',
    flexDirection: 'column',
    padding: '12px',
    gap: '10px',
  });

  const title = document.createElement('div');
  title.textContent = 'Debug report: tap Copy, then paste it into the chat.';
  Object.assign(title.style, { color: '#ffffff', fontSize: '14px', fontFamily: 'system-ui, sans-serif' });

  const box = document.createElement('textarea');
  box.readOnly = true;
  Object.assign(box.style, {
    flex: '1',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'ui-monospace, monospace',
    fontSize: '12px',
    padding: '10px',
    borderRadius: '8px',
    background: '#020617',
    color: '#e2e8f0',
    border: '1px solid #334155',
  });

  const row = document.createElement('div');
  Object.assign(row.style, { display: 'flex', gap: '8px', flexWrap: 'wrap' });

  const status = document.createElement('span');
  Object.assign(status.style, { color: '#94a3b8', fontSize: '12px', alignSelf: 'center', fontFamily: 'system-ui, sans-serif' });

  const refresh = () => {
    box.value = buildReport();
  };

  const copy = document.createElement('button');
  copy.type = 'button';
  copy.textContent = 'Copy';
  styleButton(copy, '#16a34a');
  copy.onclick = async () => {
    refresh();
    try {
      await navigator.clipboard.writeText(box.value);
      status.textContent = 'Copied.';
    } catch {
      box.focus();
      box.select();
      try {
        status.textContent = document.execCommand('copy') ? 'Copied.' : 'Select the text and copy it manually.';
      } catch {
        status.textContent = 'Select the text and copy it manually.';
      }
    }
  };

  const clear = document.createElement('button');
  clear.type = 'button';
  clear.textContent = 'Clear';
  styleButton(clear, '#475569');
  clear.onclick = () => {
    entries.length = 0;
    refresh();
    status.textContent = 'Cleared.';
  };

  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Close';
  styleButton(close, '#475569');
  close.onclick = () => {
    panel.style.display = 'none';
    toggle.style.display = 'block';
  };

  toggle.onclick = () => {
    refresh();
    status.textContent = '';
    panel.style.display = 'flex';
    toggle.style.display = 'none';
  };

  row.append(copy, clear, close, status);
  panel.append(title, box, row);
  root.append(toggle, panel);
  document.body.appendChild(root);

  refreshPanel = () => {
    if (panel.style.display === 'flex') refresh();
  };
}

export function installDebugReport(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  try {
    const flag = new URLSearchParams(window.location.search).get('debug');
    if (flag === '1') sessionStorage.setItem(FLAG_KEY, '1');
    if (flag === '0') sessionStorage.removeItem(FLAG_KEY);
  } catch {
    /* storage may be unavailable; the report simply stays hidden */
  }

  window.addEventListener(
    'error',
    (ev: Event) => {
      const target = ev.target;
      if (target && target !== window && target instanceof HTMLElement) {
        const src = (target as HTMLImageElement).src || (target as HTMLLinkElement).href || '';
        record('resource', `${target.tagName.toLowerCase()} failed to load ${src}`);
        return;
      }
      const e = ev as ErrorEvent;
      const where = e.filename ? ` (${e.filename.split('/').pop()}:${e.lineno})` : '';
      record('error', `${describe(e.error ?? e.message)}${where}`);
    },
    true
  );

  window.addEventListener('unhandledrejection', (ev: PromiseRejectionEvent) => {
    record('promise', describe(ev.reason));
  });

  const originalError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    try {
      record('console.error', args.map(describe).join(' '));
    } catch {
      /* never let reporting break the app */
    }
    originalError(...args);
  };

  if (isDebugOn()) {
    if (document.body) mountUi();
    else window.addEventListener('DOMContentLoaded', mountUi, { once: true });
  }
}
