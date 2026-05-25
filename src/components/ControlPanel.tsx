interface ControlPanelProps {
  status: 'Inactive' | 'Active';
  mode: 'manual driving' | 'navigation';
  slamEnabled: 'yes' | 'no';
  onModeChange: (mode: 'manual driving' | 'navigation') => void;
  onSlamChange: (enabled: 'yes' | 'no') => void;
  onExportMap: () => void;
  exportDisabled?: boolean;
  onKillProcess: () => void;
  onSet: () => void;
  setDisabled?: boolean;
  setLabel?: string;
  slamDisabled?: boolean;
}

export function ControlPanel({
  status, mode, slamEnabled,
  onModeChange, onSlamChange,
  onExportMap, exportDisabled = false,
  onKillProcess, onSet, setDisabled = false, slamDisabled = false,
}: ControlPanelProps) {
  const isActive = status === 'Active';

  return (
    <div className="tb-card">
      <div className="tb-card-title">
        <div className="tb-card-title-bar" />
        <span className="tb-card-title-text">Control Panel</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        {/* Status */}
        <div className="tb-row">
          <span className="tb-label">Status</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div className={`tb-dot ${isActive ? 'tb-dot-cyan' : 'tb-dot-red'}`} />
            <span className={`tb-badge ${isActive ? 'tb-badge-cyan' : 'tb-badge-red'}`}>
              {isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {/* Mode */}
        <div className="tb-row">
          <span className="tb-label">Mode</span>
          <select className="tb-select" value={mode}
            onChange={(e) => onModeChange(e.target.value as any)}>
            <option value="manual driving">Manual Drive</option>
            <option value="navigation">Navigation</option>
          </select>
        </div>

        {/* SLAM */}
        <div className="tb-row">
          <span className="tb-label">SLAM</span>
          <select className="tb-select" value={slamEnabled} disabled={slamDisabled}
            onChange={(e) => onSlamChange(e.target.value as any)}>
            <option value="no">Disabled</option>
            <option value="yes">Enabled</option>
          </select>
        </div>

        {/* Export */}
        <button className="tb-btn tb-btn-ghost" style={{ width: '100%' }}
          onClick={onExportMap} disabled={exportDisabled}>
          Export Map
        </button>

        {/* Set + Kill */}
        <hr className="tb-divider" />
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="tb-btn tb-btn-primary" style={{ flex: 1 }}
            onClick={onSet} disabled={setDisabled}>
            Set
          </button>
          <button className="tb-btn tb-btn-danger" style={{ flex: 1 }}
            onClick={onKillProcess}>
            Kill
          </button>
        </div>
      </div>
    </div>
  );
}