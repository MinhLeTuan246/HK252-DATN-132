type ModuleStatus = 'Disabled' | 'Enabled';

interface ModuleProps {
  bringupStatus: ModuleStatus;
  cartographerStatus: ModuleStatus;
  navigationStatus: ModuleStatus;
  controlStatus: ModuleStatus;
  guidingStatus: ModuleStatus;
  batteryPercentage?: number;
  linearVelocity?: number;
  angularVelocity?: number;
}

function ModuleRow({ label, status }: { label: string; status: ModuleStatus }) {
  const on = status === 'Enabled';
  return (
    <div className="tb-row" style={{ marginBottom: '0.625rem' }}>
      <span className="tb-label">{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <div className={`tb-dot ${on ? 'tb-dot-cyan' : 'tb-dot-dim'}`} />
        <span style={{
          fontFamily: 'ui-monospace, monospace', fontSize: '0.65rem', fontWeight: 700,
          letterSpacing: '0.1em', color: on ? 'var(--tb-cyan)' : 'var(--tb-faint)',
        }}>
          {on ? 'ON' : 'OFF'}
        </span>
      </div>
    </div>
  );
}

export function Module({
  bringupStatus,
  cartographerStatus,
  navigationStatus,
  controlStatus,
  guidingStatus,
  batteryPercentage,
  linearVelocity,
  angularVelocity,
}: ModuleProps) {
  const getBatteryColor = (p: number) => {
    if (p >= 60) return 'var(--tb-cyan)';
    if (p >= 30) return 'var(--tb-yellow)';
    return 'var(--tb-red)';
  };

  const getBatteryTextColor = (p: number) => {
    if (p >= 60) return 'var(--tb-cyan)';
    if (p >= 30) return 'var(--tb-yellow)';
    return 'var(--tb-red)';
  };

  return (
    <div className="tb-card">
      <div className="tb-card-title">
        <div className="tb-card-title-bar" />
        <span className="tb-card-title-text">Modules</span>
      </div>

      <ModuleRow label="Bringup"      status={bringupStatus} />
      <ModuleRow label="Cartographer" status={cartographerStatus} />
      <ModuleRow label="Navigation"   status={navigationStatus} />
      <ModuleRow label="Control"      status={controlStatus} />
      <ModuleRow label="Guiding"      status={guidingStatus} />

      {/* Battery */}
      <hr className="tb-divider" />
      <div className="tb-row" style={{ marginBottom: '0.5rem' }}>
        <span className="tb-label">Battery</span>
        <span style={{
          fontFamily: 'ui-monospace, monospace', fontSize: '0.7rem', fontWeight: 700,
          color: batteryPercentage !== undefined ? getBatteryTextColor(batteryPercentage) : 'var(--tb-faint)',
        }}>
          {batteryPercentage !== undefined ? `${batteryPercentage}%` : 'N/A'}
        </span>
      </div>

      <div className="tb-battery-track">
        {batteryPercentage !== undefined && (
          <div className="tb-battery-fill" style={{
            width: `${Math.max(3, batteryPercentage)}%`,
            backgroundColor: getBatteryColor(batteryPercentage),
          }} />
        )}
      </div>

      {/* Velocities */}
      <div style={{ marginTop: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        {[
          { label: 'Linear vel',  val: linearVelocity },
          { label: 'Angular vel', val: angularVelocity },
        ].map(({ label, val }) => (
          <div key={label} className="tb-row">
            <span className="tb-label">{label}</span>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.7rem', color: 'var(--tb-text)' }}>
              {(val ?? 0).toFixed(1)}{' '}
              <span style={{ color: 'var(--tb-faint)' }}>cm/s</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}