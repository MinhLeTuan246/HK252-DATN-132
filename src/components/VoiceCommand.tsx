import { useEffect, useRef, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────
type VoiceEntry = { text: string; ts: string };

// These are the commands that the voice input can trigger. The "guiding_location" and "guiding_route" commands include target information for navigation.
export type VoiceRobotCommand =
  | 'start_bringup'
  | 'stop_bringup'
  | 'start_cartographer'
  | 'stop_cartographer'
  | 'start_navigation'
  | 'stop_navigation'
  | 'start_control'
  | 'stop_control'
  | 'start_guiding'
  | 'stop_guiding'
  | 'motion_forward'
  | 'motion_backward'
  | 'motion_left'
  | 'motion_right'
  | 'motion_stop'
  | 'guiding_pos1'
  | 'guiding_pos2'
  | 'guiding_location'
  | 'guiding_route'
  | 'guiding_pause'
  | 'guiding_return_dock'
  | 'unknown';

type InterpretedCommand = {
  command: VoiceRobotCommand;
  label: string;
  target?: string;
  targets?: string[];
  optimize?: boolean;
};

interface VoiceCommandPanelProps {
  disabled?: boolean;
  onCommand?: (
    command: VoiceRobotCommand,
    rawText: string,
    target?: string,
    targets?: string[],
    optimize?: boolean
  ) => void;
}

// ── Helpers ───────────────────────────────────────────────────────
const nowStr = () =>
  new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

function cleanLocationTarget(rawTarget: string): string {
  return rawTarget
    .toLowerCase()
    .trim()
    .replace(/[.,!?]/g, '')
    .replace(/\b(the|a|an)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s+/g, '_');
}

function extractGuidingTarget(s: string): string | null {
  const patterns = [
    /\b(?:please\s+)?(?:move|go|navigate|guide|take|send|bring)\s+(?:the\s+robot\s+)?to\s+(.+)$/,
    /\b(?:please\s+)?(?:move|go|navigate|guide|take|send|bring)\s+(?:the\s+robot\s+)?(?:towards|into|inside)\s+(.+)$/,
  ];

  for (const pattern of patterns) {
    const match = s.match(pattern);
    if (!match?.[1]) continue;

    const target = cleanLocationTarget(match[1]);

    if (!target) return null;

    // Do not interfere with RETURNING logic.
    // Dock return still uses "return to the dock".
    if (target === 'dock') return null;

    return target;
  }

  return null;
}

function extractGuidingRoute(s: string): { targets: string[]; optimize: boolean } | null {
  const optimize =
    /\b(optimize|optimized|optimal|shortest|fastest|minimal|minimise|minimize|minimum|best route|least time)\b/.test(s);

  const routePattern =
    /\b(?:please\s+)?(?:move|go|navigate|guide|take|send|bring)\s+(?:the\s+robot\s+)?to\s+(.+)$/;

  const match = s.match(routePattern);
  if (!match?.[1]) return null;

  let body = match[1]
    .toLowerCase()
    .replace(/[.,!?]/g, ' ')
    .replace(/\b(in|with|using)\s+(minimal|minimum|shortest|fastest|optimized|optimal|best)\s+(time|route|path|way)?\b/g, ' ')
    .replace(/\bminimal\s+time\b/g, ' ')
    .replace(/\bminimum\s+time\b/g, ' ')
    .replace(/\bshortest\s+(route|path|way)\b/g, ' ')
    .replace(/\boptimized\s+(route|path|way)\b/g, ' ')
    .replace(/\bbest\s+(route|path|way)\b/g, ' ')
    .trim();

  const parts = body
    .split(/\s+(?:then|and|after that|next)\s+|,/g)
    .map(cleanLocationTarget)
    .filter(Boolean)
    .filter(t => t !== 'dock');

  const uniqueTargets: string[] = [];
  for (const p of parts) {
    if (!uniqueTargets.includes(p)) uniqueTargets.push(p);
  }

  if (uniqueTargets.length < 2) return null;

  return {
    targets: uniqueTargets,
    optimize,
  };
}

function interpret(raw: string): InterpretedCommand {
  const s = raw.toLowerCase().trim();

  // Bringup ON
  if (
    /(turn on|start|enable|run|activate).*(bring ?up|robot)/.test(s) ||
    /(bring ?up|robot).*(turn on|start|enable|run|activate)/.test(s)
  ) {
    return { command: 'start_bringup', label: 'Start Bringup' };
  }

  // Bringup OFF
  if (
    /(turn off|stop|disable|kill|shutdown).*(bring ?up|robot)/.test(s) ||
    /(bring ?up|robot).*(turn off|stop|disable|kill|shutdown)/.test(s)
  ) {
    return { command: 'stop_bringup', label: 'Stop Bringup' };
  }

  // Cartographer ON
  if (
    /(turn on|start|enable|run|activate).*(cartographer|slam|mapping)/.test(s) ||
    /(cartographer|slam|mapping).*(turn on|start|enable|run|activate)/.test(s)
  ) {
    return { command: 'start_cartographer', label: 'Start Cartographer' };
  }

  // Cartographer OFF
  if (
    /(turn off|stop|disable|kill|shutdown).*(cartographer|slam|mapping)/.test(s) ||
    /(cartographer|slam|mapping).*(turn off|stop|disable|kill|shutdown)/.test(s)
  ) {
    return { command: 'stop_cartographer', label: 'Stop Cartographer' };
  }

  // Navigation ON
  if (
    /(turn on|start|enable|run|activate).*(navigation|nav2|navigate)/.test(s) ||
    /(navigation|nav2|navigate).*(turn on|start|enable|run|activate)/.test(s)
  ) {
    return { command: 'start_navigation', label: 'Start Navigation' };
  }

  // Navigation OFF
  if (
    /(turn off|stop|disable|kill|shutdown).*(navigation|nav2|navigate)/.test(s) ||
    /(navigation|nav2|navigate).*(turn off|stop|disable|kill|shutdown)/.test(s)
  ) {
    return { command: 'stop_navigation', label: 'Stop Navigation' };
  }

  // Control ON
  if (
    /(turn on|start|enable|run|activate).*(control|controller)/.test(s) ||
    /(control|controller).*(turn on|start|enable|run|activate)/.test(s)
  ) {
    return { command: 'start_control', label: 'Start Control' };
  }

  // Control OFF
  if (
    /(turn off|stop|disable|kill|shutdown).*(control|controller)/.test(s) ||
    /(control|controller).*(turn off|stop|disable|kill|shutdown)/.test(s)
  ) {
    return { command: 'stop_control', label: 'Stop Control' };
  }

  // Guiding ON
  if (
    /(turn on|start|enable|run|activate).*(guiding|guide)/.test(s) ||
    /(guiding|guide).*(turn on|start|enable|run|activate)/.test(s)
  ) {
    return { command: 'start_guiding', label: 'Start Guiding' };
  }

  // Guiding OFF
  if (
    /(turn off|stop|disable|kill|shutdown).*(guiding|guide)/.test(s) ||
    /(guiding|guide).*(turn off|stop|disable|kill|shutdown)/.test(s)
  ) {
    return { command: 'stop_guiding', label: 'Stop Guiding' };
  }

  // Motion commands
  if (/\bforward\b|\bahead\b/.test(s)) {
    return { command: 'motion_forward', label: 'Motion: forward' };
  }
  if (/\bbackward\b|\breverse\b|\bback\b/.test(s)) {
    return { command: 'motion_backward', label: 'Motion: backward' };
  }
  if (/\bleft\b/.test(s)) {
    return { command: 'motion_left', label: 'Motion: left' };
  }
  if (/\bright\b/.test(s)) {
    return { command: 'motion_right', label: 'Motion: right' };
  }
  if (/\bstop\b|\bhalt\b|\bfreeze\b/.test(s)) {
    return { command: 'motion_stop', label: 'Motion: stop' };
  }

  // Guiding commands
  if (
    /go to position one/.test(s) ||
    /go to the first position/.test(s) ||
    /go to pos one/.test(s) ||
    /go to pos 1/.test(s)
  ) {
    return { command: 'guiding_pos1', label: 'Guiding: go to position one' };
  }

  if (
    /go to position two/.test(s) ||
    /go to the second position/.test(s) ||
    /go to pos two/.test(s) ||
    /go to pos 2/.test(s)
  ) {
    return { command: 'guiding_pos2', label: 'Guiding: go to position two' };
  }

  if (/pause guiding/.test(s) || /suspense/.test(s) || s === 'pause') {
    return { command: 'guiding_pause', label: 'Guiding: pause' };
  }

  if (
    /return to the dock/.test(s) ||
    /return to dock/.test(s) ||
    /go to dock/.test(s)
  ) {
    return { command: 'guiding_return_dock', label: 'Guiding: return to dock' };
  }

  const guidingRoute = extractGuidingRoute(s);
  if (guidingRoute) {
    return {
      command: 'guiding_route',
      label: `Guiding: ${guidingRoute.optimize ? 'optimized route' : 'route'} ${guidingRoute.targets.join(' -> ')}`,
      targets: guidingRoute.targets,
      optimize: guidingRoute.optimize,
    };
  }

  const guidingTarget = extractGuidingTarget(s);
  if (guidingTarget) {
    return {
      command: 'guiding_location',
      label: `Guiding: go to ${guidingTarget}`,
      target: guidingTarget,
    };
  }  
  
  return { command: 'unknown', label: 'Unknown command' };    
}

// ── MiniLog sub-component ─────────────────────────────────────────
function MiniLog({
  entries,
  endRef,
  emptyLabel,
}: {
  entries: VoiceEntry[];
  endRef: React.RefObject<HTMLDivElement | null>;
  emptyLabel: string;
}) {
  return (
    <div style={{
      flex: 1,
      minHeight: 0,
      backgroundColor: '#060a0e',
      border: '1px solid var(--tb-border)',
      borderRadius: '0.375rem',
      overflowY: 'auto',
      padding: '0.5rem 0.625rem',
    }}>
      {entries.length === 0 ? (
        <span style={{
          fontFamily: 'ui-monospace, monospace',
          fontSize: '0.6rem',
          color: 'var(--tb-faint)',
        }}>
          {emptyLabel}
        </span>
      ) : (
        entries.map((e, i) => (
          <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.55rem',
              color: 'var(--tb-faint)',
              flexShrink: 0,
              marginTop: '1px',
            }}>
              {e.ts}
            </span>
            <span style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.65rem',
              color: 'var(--tb-text)',
              lineHeight: 1.4,
            }}>
              {e.text}
            </span>
          </div>
        ))
      )}
      <div ref={endRef} />
    </div>
  );
}

// ── VoiceCommandPanel ─────────────────────────────────────────────
export function VoiceCommandPanel({ disabled = false, onCommand }: VoiceCommandPanelProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState<VoiceEntry[]>([]);
  const [interpreted, setInterpreted] = useState<VoiceEntry[]>([]);

  const recognitionRef = useRef<any>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const interpretedEndRef = useRef<HTMLDivElement | null>(null);
  // Track whether V key is currently held to prevent key-repeat re-triggers
  const vKeyHeldRef = useRef(false);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  useEffect(() => {
    interpretedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [interpreted]);

  const startListening = () => {
    if (disabled) return;

    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SR) {
      setTranscript(p => [
        ...p.slice(-19),
        { text: 'Speech recognition is not supported in this browser.', ts: nowStr() },
      ]);
      return;
    }

    try {
      recognitionRef.current?.stop();
    } catch {}
    recognitionRef.current = null;

    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-US';

    rec.onresult = (e: any) => {
      const raw = (e.results[0][0].transcript as string).trim();
      const ts = nowStr();
      const parsed = interpret(raw);

      setTranscript(p => [...p.slice(-19), { text: raw, ts }]);
      setInterpreted(p => [...p.slice(-19), { text: parsed.label, ts }]);

      if (parsed.command !== 'unknown') {
        onCommand?.(parsed.command, raw, parsed.target, parsed.targets, parsed.optimize);
      }
    };

    rec.onerror = (e: any) => {
      const err = String(e?.error ?? 'unknown');

      if (err === 'no-speech' || err === 'aborted') {
        setIsListening(false);
        return;
      }

      if (err === 'network') {
        setTranscript(p => [
          ...p.slice(-19),
          {
            text: 'Speech service network error. Release and press again.',
            ts: nowStr(),
          },
        ]);
        setIsListening(false);
        return;
      }

      setTranscript(p => [
        ...p.slice(-19),
        { text: `Error: ${err}`, ts: nowStr() },
      ]);
      setIsListening(false);
    };

    rec.onend = () => setIsListening(false);

    rec.start();
    recognitionRef.current = rec;
    setIsListening(true);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  // ── Keyboard shortcut: hold V to talk ────────────────────────────
  useEffect(() => {
    const isInput = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      if (!el) return false;
      return (
        ['input', 'textarea'].includes((el.tagName || '').toLowerCase()) ||
        el.isContentEditable
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key !== 'v' && e.key !== 'V') || isInput(e.target)) return;
      if (vKeyHeldRef.current) return; // prevent key-repeat re-fires
      vKeyHeldRef.current = true;
      e.preventDefault();
      startListening();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== 'v' && e.key !== 'V') return;
      vKeyHeldRef.current = false;
      stopListening();
    };

    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown as any);
      window.removeEventListener('keyup', onKeyUp as any);
    };
  }, [disabled]); // re-bind when disabled state changes

  return (
    <div className="tb-card" style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '0.875rem',
      height: '100%',
      minHeight: 0,
    }}>
      <div className="tb-card-title" style={{ marginBottom: 0 }}>
        <div className="tb-card-title-bar" />
        <span className="tb-card-title-text">Voice Command</span>
      </div>

      <button
        onMouseDown={startListening}
        onMouseUp={stopListening}
        onTouchStart={startListening}
        onTouchEnd={stopListening}
        disabled={disabled}
        style={{
          flexShrink: 0,
          padding: '0.65rem',
          borderRadius: '0.5rem',
          border: `1px solid ${isListening ? 'var(--tb-cyan)' : 'var(--tb-border2)'}`,
          backgroundColor: isListening ? 'var(--tb-cyan-dim)' : 'transparent',
          color: disabled
            ? 'var(--tb-faint)'
            : isListening
              ? 'var(--tb-cyan)'
              : 'var(--tb-muted)',
          fontFamily: 'ui-monospace, monospace',
          fontSize: '0.65rem',
          fontWeight: 700,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          boxShadow: isListening ? 'var(--tb-cyan-glow)' : 'none',
          opacity: disabled ? 0.55 : 1,
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
        {disabled ? 'Offline' : isListening ? 'Listening…' : 'Push to Talk'}
      </button>

      {/* Keyboard hint */}
      {!disabled && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.35rem',
          marginTop: '-0.5rem',
        }}>
          <kbd style={{
            fontFamily: 'ui-monospace, monospace',
            fontSize: '0.55rem',
            color: 'var(--tb-faint)',
            border: '1px solid var(--tb-border)',
            borderRadius: '0.25rem',
            padding: '0.1rem 0.35rem',
            backgroundColor: '#0a0f14',
          }}>V</kbd>
          <span style={{
            fontFamily: 'ui-monospace, monospace',
            fontSize: '0.55rem',
            color: 'var(--tb-faint)',
          }}>hold to talk</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: '0.375rem' }}>
        <span className="tb-label">Transcript</span>
        <MiniLog
          entries={transcript}
          endRef={transcriptEndRef}
          emptyLabel="No speech captured yet…"
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: '0.375rem' }}>
        <span className="tb-label">Interpreted Command</span>
        <MiniLog
          entries={interpreted}
          endRef={interpretedEndRef}
          emptyLabel="Awaiting interpretation…"
        />
      </div>
    </div>
  );
}