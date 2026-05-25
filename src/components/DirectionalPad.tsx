import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Square } from 'lucide-react';

interface DirectionalPadProps {
  onDirectionClick: (direction: 'up' | 'down' | 'left' | 'right' | 'stop') => void;
  disabled?: boolean;
}

export function DirectionalPad({ onDirectionClick, disabled = false }: DirectionalPadProps) {
  const Btn = ({ dir, children }: { dir: 'up'|'down'|'left'|'right'|'stop'; children: React.ReactNode }) => (
    <button className="tb-dpad-btn" disabled={disabled} onClick={() => onDirectionClick(dir)}>
      {children}
    </button>
  );

  return (
    <div className="tb-card">
      <div className="tb-card-title">
        <div className="tb-card-title-bar" />
        <span className="tb-card-title-text">Drive Control</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.375rem' }}>
        {/* Up */}
        <Btn dir="up"><ArrowUp style={{ width: '1.1rem', height: '1.1rem' }} strokeWidth={2.5} /></Btn>

        {/* Middle */}
        <div style={{ display: 'flex', gap: '0.375rem' }}>
          <Btn dir="left"> <ArrowLeft  style={{ width: '1.1rem', height: '1.1rem' }} strokeWidth={2.5} /></Btn>
          <Btn dir="stop"> <Square     style={{ width: '0.9rem', height: '0.9rem' }} strokeWidth={2.5} /></Btn>
          <Btn dir="right"><ArrowRight style={{ width: '1.1rem', height: '1.1rem' }} strokeWidth={2.5} /></Btn>
        </div>

        {/* Down */}
        <Btn dir="down"><ArrowDown style={{ width: '1.1rem', height: '1.1rem' }} strokeWidth={2.5} /></Btn>
      </div>

      {!disabled && (
        <p style={{
          textAlign: 'center', marginTop: '0.875rem',
          fontFamily: 'ui-monospace, monospace', fontSize: '0.6rem',
          letterSpacing: '0.1em', color: 'var(--tb-faint)',
        }}>
          WASD / ARROW KEYS
        </p>
      )}
    </div>
  );
}