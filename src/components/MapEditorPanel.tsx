import { useEffect, useMemo, useRef, useState } from 'react';
import * as ROSLIB from 'roslib';
import { X, MapPin, List } from 'lucide-react';

type LogType = 'info' | 'warn' | 'error' | 'success';

type PoseData = {
  frame_id: string;
  x: number;
  y: number;
  z: number;
  w: number;
};

interface MapEditorPanelProps {
  ros: ROSLIB.Ros | null;
  disabled?: boolean;
  onLog?: (msg: string, type?: LogType) => void;
}

function notifySavedLocationsChanged() {
  window.dispatchEvent(new CustomEvent('saved-locations-changed'));
}

function Backdrop({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div
      style={{
        width: '22rem',
        backgroundColor: 'var(--tb-surface)',
        border: '1px solid var(--tb-border)',
        borderRadius: '0.75rem',
        boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(34,211,238,0.08)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          borderBottom: '1px solid var(--tb-border)',
          backgroundColor: 'rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              width: '3px',
              height: '0.75rem',
              borderRadius: '9999px',
              backgroundColor: 'var(--tb-cyan)',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.6rem',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'var(--tb-cyan)',
              fontWeight: 700,
            }}
          >
            {title}
          </span>
        </div>

        <button
          onClick={onClose}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '1.5rem',
            height: '1.5rem',
            borderRadius: '0.375rem',
            border: '1px solid var(--tb-border2)',
            backgroundColor: 'transparent',
            color: 'var(--tb-muted)',
            cursor: 'pointer',
          }}
        >
          <X style={{ width: '0.75rem', height: '0.75rem' }} />
        </button>
      </div>

      <div style={{ padding: '1rem' }}>{children}</div>

      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          justifyContent: 'flex-end',
          padding: '0.75rem 1rem',
          borderTop: '1px solid var(--tb-border)',
          backgroundColor: 'rgba(0,0,0,0.15)',
        }}
      >
        {footer}
      </div>
    </div>
  );
}

function PoseReadout({ pose }: { pose: PoseData | null }) {
  const rows = pose
    ? [
        ['frame', pose.frame_id],
        ['x', pose.x.toFixed(6)],
        ['y', pose.y.toFixed(6)],
        ['z', pose.z.toFixed(9)],
        ['w', pose.w.toFixed(9)],
      ]
    : [];

  return (
    <div
      style={{
        backgroundColor: '#060a0e',
        border: '1px solid var(--tb-border)',
        borderRadius: '0.5rem',
        padding: '0.75rem 1rem',
        marginBottom: '0.875rem',
      }}
    >
      <div
        style={{
          fontFamily: 'ui-monospace, monospace',
          fontSize: '0.6rem',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: 'var(--tb-muted)',
          marginBottom: '0.5rem',
        }}
      >
        Current pose
      </div>

      {!pose ? (
        <div
          style={{
            fontFamily: 'ui-monospace, monospace',
            fontSize: '0.7rem',
            color: 'var(--tb-yellow)',
            lineHeight: 1.6,
          }}
        >
          Waiting for /amcl_pose...
        </div>
      ) : (
        rows.map(([axis, val]) => (
          <div
            key={axis}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              lineHeight: 1.8,
            }}
          >
            <span
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: '0.65rem',
                color: 'var(--tb-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}
            >
              {axis}:
            </span>
            <span
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: '0.7rem',
                color: 'var(--tb-cyan)',
              }}
            >
              {val}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

function SaveLocationModal({
  ros,
  onClose,
  onLog,
}: {
  ros: ROSLIB.Ros | null;
  onClose: () => void;
  onLog?: (msg: string, type?: LogType) => void;
}) {
  const [name, setName] = useState('');
  const [pose, setPose] = useState<PoseData | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [needsOverwrite, setNeedsOverwrite] = useState(false);

  const requestIdRef = useRef<string>('');
  const amclTopicRef = useRef<ROSLIB.Topic<any> | null>(null);
  const saveReqTopicRef = useRef<ROSLIB.Topic<any> | null>(null);
  const saveResTopicRef = useRef<ROSLIB.Topic<any> | null>(null);

  const cleanName = useMemo(
    () => name.trim().toLowerCase().replace(/\s+/g, '_'),
    [name]
  );

  useEffect(() => {
    if (!ros) {
      setStatusMsg('Rosbridge is not connected.');
      return;
    }

    const amclTopic = new ROSLIB.Topic({
      ros,
      name: '/amcl_pose',
      messageType: 'geometry_msgs/PoseWithCovarianceStamped',
    });

    const saveReqTopic = new ROSLIB.Topic({
      ros,
      name: '/save_location_request',
      messageType: 'std_msgs/String',
    });

    const saveResTopic = new ROSLIB.Topic({
      ros,
      name: '/save_location_response',
      messageType: 'std_msgs/String',
    });

    amclTopic.subscribe((msg: any) => {
      const p = msg?.pose?.pose;
      if (!p) return;

      setPose({
        frame_id: msg?.header?.frame_id || 'map',
        x: Number(p?.position?.x ?? 0),
        y: Number(p?.position?.y ?? 0),
        z: Number(p?.orientation?.z ?? 0),
        w: Number(p?.orientation?.w ?? 1),
      });
    });

    saveResTopic.subscribe((msg: any) => {
      try {
        const data = JSON.parse(msg?.data || '{}');

        if (data.request_id !== requestIdRef.current) return;

        setSaving(false);

        if (data.success) {
          setNeedsOverwrite(false);
          setStatusMsg(data.message || 'Location saved.');
          onLog?.(data.message || `Saved location ${cleanName}`, 'success');

          notifySavedLocationsChanged();

          setTimeout(onClose, 500);
          return;
        }

        if (data.exists) {
          setNeedsOverwrite(true);
          setStatusMsg(data.message || 'Location already exists. Overwrite?');
          onLog?.(data.message || 'Location already exists.', 'warn');
          return;
        }

        setStatusMsg(data.message || 'Failed to save location.');
        onLog?.(data.message || 'Failed to save location.', 'error');
      } catch (e) {
        setSaving(false);
        setStatusMsg(`Bad save response: ${e}`);
      }
    });

    amclTopicRef.current = amclTopic;
    saveReqTopicRef.current = saveReqTopic;
    saveResTopicRef.current = saveResTopic;

    return () => {
      try { amclTopic.unsubscribe(); } catch {}
      try { saveResTopic.unsubscribe(); } catch {}
    };
  }, [ros, cleanName, onClose, onLog]);

  const submitSave = (overwrite: boolean) => {
    if (!ros || !saveReqTopicRef.current) {
      setStatusMsg('Rosbridge is not connected.');
      return;
    }

    if (!pose) {
      setStatusMsg('No /amcl_pose received yet. Make sure navigation is running and initial pose is set.');
      return;
    }

    if (!cleanName) {
      setStatusMsg('Location name cannot be empty.');
      return;
    }

    requestIdRef.current = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const payload = {
      request_id: requestIdRef.current,
      name: cleanName,
      overwrite,
      pose,
    };

    setSaving(true);
    setNeedsOverwrite(false);
    setStatusMsg(overwrite ? `Overwriting ${cleanName}...` : `Saving ${cleanName}...`);

    saveReqTopicRef.current.publish({
      data: JSON.stringify(payload),
    } as any);
  };

  return (
    <Backdrop onClose={onClose}>
      <Modal
        title="Save Location"
        onClose={onClose}
        footer={
          <>
            <button className="tb-btn tb-btn-ghost" onClick={onClose}>
              Cancel
            </button>

            {needsOverwrite ? (
              <button
                className="tb-btn tb-btn-danger"
                onClick={() => submitSave(true)}
                disabled={saving}
              >
                Overwrite
              </button>
            ) : (
              <button
                className="tb-btn tb-btn-primary"
                onClick={() => submitSave(false)}
                disabled={!cleanName || !pose || saving}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            )}
          </>
        }
      >
        <PoseReadout pose={pose} />

        <label
          style={{
            display: 'block',
            fontFamily: 'ui-monospace, monospace',
            fontSize: '0.6rem',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: 'var(--tb-muted)',
            marginBottom: '0.375rem',
          }}
        >
          Location name
        </label>

        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNeedsOverwrite(false);
            setStatusMsg('');
          }}
          placeholder="e.g. kitchen"
          style={{
            width: '100%',
            backgroundColor: '#060a0e',
            border: '1px solid var(--tb-border2)',
            borderRadius: '0.375rem',
            padding: '0.5rem 0.75rem',
            fontFamily: 'ui-monospace, monospace',
            fontSize: '0.75rem',
            color: 'var(--tb-text)',
            outline: 'none',
          }}
          autoFocus
        />

        <div
          style={{
            marginTop: '0.5rem',
            fontFamily: 'ui-monospace, monospace',
            fontSize: '0.6rem',
            color: 'var(--tb-faint)',
            lineHeight: 1.5,
          }}
        >
          Saved as: <span style={{ color: 'var(--tb-cyan)' }}>{cleanName || 'none'}</span>
        </div>

        {statusMsg && (
          <div
            style={{
              marginTop: '0.75rem',
              padding: '0.5rem 0.625rem',
              borderRadius: '0.375rem',
              border: '1px solid var(--tb-border)',
              backgroundColor: '#060a0e',
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.65rem',
              color: needsOverwrite ? 'var(--tb-yellow)' : 'var(--tb-muted)',
              lineHeight: 1.5,
            }}
          >
            {statusMsg}
          </div>
        )}
      </Modal>
    </Backdrop>
  );
}

type SavedLocation = {
  name: string;
  frame_id: string;
  x: number;
  y: number;
  z: number;
  w: number;
};

function ShowLocationsModal({
  ros,
  onClose,
  onLog,
}: {
  ros: ROSLIB.Ros | null;
  onClose: () => void;
  onLog?: (msg: string, type?: LogType) => void;
}) {
  const [locations, setLocations] = useState<SavedLocation[]>([]);
  const [selected, setSelected] = useState<SavedLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [needsRenameOverwrite, setNeedsRenameOverwrite] = useState(false);

  const requestIdRef = useRef('');
  const manageReqTopicRef = useRef<ROSLIB.Topic<any> | null>(null);
  const manageResTopicRef = useRef<ROSLIB.Topic<any> | null>(null);

  const cleanNewName = useMemo(
    () => newName.trim().toLowerCase().replace(/\s+/g, '_'),
    [newName]
  );

  const publishManageRequest = (payload: any) => {
    if (!ros || !manageReqTopicRef.current) {
      setStatusMsg('Rosbridge is not connected.');
      return;
    }

    requestIdRef.current = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    manageReqTopicRef.current.publish({
      data: JSON.stringify({
        ...payload,
        request_id: requestIdRef.current,
      }),
    } as any);
  };

  const requestList = () => {
    setLoading(true);
    setStatusMsg('Loading saved locations...');
    publishManageRequest({ action: 'list' });
  };

  useEffect(() => {
    if (!ros) {
      setLoading(false);
      setStatusMsg('Rosbridge is not connected.');
      return;
    }

    const manageReqTopic = new ROSLIB.Topic({
      ros,
      name: '/location_manage_request',
      messageType: 'std_msgs/String',
    });

    const manageResTopic = new ROSLIB.Topic({
      ros,
      name: '/location_manage_response',
      messageType: 'std_msgs/String',
    });

    manageResTopic.subscribe((msg: any) => {
      try {
        const data = JSON.parse(msg?.data || '{}');

        if (data.request_id !== requestIdRef.current) return;

        setLoading(false);

        if (Array.isArray(data.locations)) {
          setLocations(data.locations);
          if (selected && !data.locations.some((l: SavedLocation) => l.name === selected.name)) {
            setSelected(null);
          }
        }

        if (data.success) {
          setStatusMsg(data.message || 'Done.');
          onLog?.(data.message || 'Location operation done.', 'success');

          if (data.action === 'rename') {
            setRenaming(false);
            setNewName('');
            setNeedsRenameOverwrite(false);
            setSelected(null);
            notifySavedLocationsChanged();
          }

          if (data.action === 'delete') {
            setSelected(null);
            notifySavedLocationsChanged();
          }

          return;
        }

        if (data.exists && data.action === 'rename') {
          setNeedsRenameOverwrite(true);
          setStatusMsg(data.message || 'Location already exists. Overwrite?');
          onLog?.(data.message || 'Location already exists.', 'warn');
          return;
        }

        setStatusMsg(data.message || 'Operation failed.');
        onLog?.(data.message || 'Location operation failed.', 'error');
      } catch (e) {
        setLoading(false);
        setStatusMsg(`Bad location response: ${e}`);
      }
    });

    manageReqTopicRef.current = manageReqTopic;
    manageResTopicRef.current = manageResTopic;

    setTimeout(() => requestList(), 0);

    return () => {
      try { manageResTopic.unsubscribe(); } catch {}
    };
  }, [ros]);

  const deleteSelected = () => {
    if (!selected) return;

    const ok = window.confirm(`Delete location '${selected.name}'? This cannot be undone.`);
    if (!ok) return;

    setStatusMsg(`Deleting ${selected.name}...`);
    publishManageRequest({
      action: 'delete',
      name: selected.name,
    });
  };

  const startRename = () => {
    if (!selected) return;

    setRenaming(true);
    setNeedsRenameOverwrite(false);
    setNewName(selected.name);
    setStatusMsg('');
  };

  const submitRename = (overwrite: boolean) => {
    if (!selected) return;

    if (!cleanNewName) {
      setStatusMsg('New location name cannot be empty.');
      return;
    }

    setStatusMsg(overwrite ? `Overwriting ${cleanNewName}...` : `Renaming ${selected.name}...`);
    setNeedsRenameOverwrite(false);

    publishManageRequest({
      action: 'rename',
      old_name: selected.name,
      new_name: cleanNewName,
      overwrite,
    });
  };

  return (
    <Backdrop onClose={onClose}>
      <Modal
        title="Saved Locations"
        onClose={onClose}
        footer={
          <>
            <button className="tb-btn tb-btn-ghost" onClick={requestList} disabled={loading}>
              Refresh
            </button>

            {!renaming && (
              <button
                className="tb-btn tb-btn-ghost"
                disabled={!selected}
                onClick={startRename}
              >
                Rename
              </button>
            )}

            <button
              className="tb-btn tb-btn-danger"
              disabled={!selected}
              onClick={deleteSelected}
            >
              Delete
            </button>

            <button className="tb-btn tb-btn-primary" onClick={onClose}>
              Close
            </button>
          </>
        }
      >
        <div
          style={{
            fontFamily: 'ui-monospace, monospace',
            fontSize: '0.6rem',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: 'var(--tb-muted)',
            marginBottom: '0.625rem',
          }}
        >
          Select a location
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.375rem',
            maxHeight: '14rem',
            overflowY: 'auto',
            paddingRight: '0.25rem',
          }}
        >
          {loading ? (
            <div style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.7rem',
              color: 'var(--tb-yellow)',
              lineHeight: 1.6,
            }}>
              Loading saved locations...
            </div>
          ) : locations.length === 0 ? (
            <div style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.7rem',
              color: 'var(--tb-faint)',
              lineHeight: 1.6,
            }}>
              No saved locations found.
            </div>
          ) : (
            locations.map((loc) => {
              const isActive = selected?.name === loc.name;

              return (
                <button
                  key={loc.name}
                  onClick={() => {
                    setSelected(isActive ? null : loc);
                    setRenaming(false);
                    setNeedsRenameOverwrite(false);
                    setStatusMsg('');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.625rem',
                    padding: '0.5rem 0.75rem',
                    backgroundColor: isActive ? 'var(--tb-cyan-dim)' : '#060a0e',
                    border: `1px solid ${isActive ? 'rgba(34,211,238,0.45)' : 'var(--tb-border)'}`,
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  <MapPin
                    style={{
                      width: '0.75rem',
                      height: '0.75rem',
                      color: isActive ? 'var(--tb-cyan)' : 'var(--tb-faint)',
                      flexShrink: 0,
                      marginTop: '0.15rem',
                    }}
                  />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 0 }}>
                    <span
                      style={{
                        fontFamily: 'ui-monospace, monospace',
                        fontSize: '0.75rem',
                        color: isActive ? 'var(--tb-cyan)' : 'var(--tb-text)',
                      }}
                    >
                      {loc.name}
                    </span>

                    <span
                      style={{
                        fontFamily: 'ui-monospace, monospace',
                        fontSize: '0.55rem',
                        color: 'var(--tb-faint)',
                        lineHeight: 1.4,
                      }}
                    >
                      x={loc.x.toFixed(3)} y={loc.y.toFixed(3)}
                      <br />
                      z={loc.z.toFixed(3)} w={loc.w.toFixed(3)}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {selected && (
          <div
            style={{
              marginTop: '0.75rem',
              backgroundColor: '#060a0e',
              border: '1px solid var(--tb-border)',
              borderRadius: '0.5rem',
              padding: '0.75rem',
            }}
          >
            <div
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: '0.6rem',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: 'var(--tb-muted)',
                marginBottom: '0.5rem',
              }}
            >
              Selected pose
            </div>

            {[
              ['name', selected.name],
              ['frame', selected.frame_id],
              ['x', selected.x.toFixed(6)],
              ['y', selected.y.toFixed(6)],
              ['z', selected.z.toFixed(9)],
              ['w', selected.w.toFixed(9)],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', lineHeight: 1.7 }}>
                <span style={{
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: '0.6rem',
                  color: 'var(--tb-muted)',
                  textTransform: 'uppercase',
                }}>
                  {k}:
                </span>
                <span style={{
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: '0.65rem',
                  color: 'var(--tb-cyan)',
                }}>
                  {v}
                </span>
              </div>
            ))}
          </div>
        )}

        {renaming && selected && (
          <div style={{ marginTop: '0.75rem' }}>
            <label
              style={{
                display: 'block',
                fontFamily: 'ui-monospace, monospace',
                fontSize: '0.6rem',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: 'var(--tb-muted)',
                marginBottom: '0.375rem',
              }}
            >
              New name
            </label>

            <input
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setNeedsRenameOverwrite(false);
                setStatusMsg('');
              }}
              style={{
                width: '100%',
                backgroundColor: '#060a0e',
                border: '1px solid var(--tb-border2)',
                borderRadius: '0.375rem',
                padding: '0.5rem 0.75rem',
                fontFamily: 'ui-monospace, monospace',
                fontSize: '0.75rem',
                color: 'var(--tb-text)',
                outline: 'none',
              }}
              autoFocus
            />

            <div
              style={{
                marginTop: '0.5rem',
                fontFamily: 'ui-monospace, monospace',
                fontSize: '0.6rem',
                color: 'var(--tb-faint)',
                lineHeight: 1.5,
              }}
            >
              Renamed as: <span style={{ color: 'var(--tb-cyan)' }}>{cleanNewName || 'none'}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.625rem' }}>
              <button
                className="tb-btn tb-btn-ghost"
                onClick={() => {
                  setRenaming(false);
                  setNeedsRenameOverwrite(false);
                  setStatusMsg('');
                }}
              >
                Cancel rename
              </button>

              {needsRenameOverwrite ? (
                <button
                  className="tb-btn tb-btn-danger"
                  onClick={() => submitRename(true)}
                >
                  Overwrite
                </button>
              ) : (
                <button
                  className="tb-btn tb-btn-primary"
                  disabled={!cleanNewName}
                  onClick={() => submitRename(false)}
                >
                  Confirm rename
                </button>
              )}
            </div>
          </div>
        )}

        {statusMsg && (
          <div
            style={{
              marginTop: '0.75rem',
              padding: '0.5rem 0.625rem',
              borderRadius: '0.375rem',
              border: '1px solid var(--tb-border)',
              backgroundColor: '#060a0e',
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.65rem',
              color: needsRenameOverwrite ? 'var(--tb-yellow)' : 'var(--tb-muted)',
              lineHeight: 1.5,
            }}
          >
            {statusMsg}
          </div>
        )}
      </Modal>
    </Backdrop>
  );
}

export function MapEditorPanel({ ros, disabled = false, onLog }: MapEditorPanelProps) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [showOpen, setShowOpen] = useState(false);

  return (
    <>
      <div className="tb-card">
        <div className="tb-card-title">
          <div className="tb-card-title-bar" />
          <span className="tb-card-title-text">Map Editor</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button
            className="tb-btn tb-btn-ghost"
            style={{ width: '100%', justifyContent: 'flex-start', gap: '0.5rem' }}
            onClick={() => setSaveOpen(true)}
            disabled={disabled}
          >
            <MapPin style={{ width: '0.75rem', height: '0.75rem', flexShrink: 0 }} />
            Save location
          </button>

          <button
            className="tb-btn tb-btn-ghost"
            style={{ width: '100%', justifyContent: 'flex-start', gap: '0.5rem' }}
            onClick={() => setShowOpen(true)}
            disabled={disabled}
          >
            <List style={{ width: '0.75rem', height: '0.75rem', flexShrink: 0 }} />
            Show locations
          </button>
        </div>
      </div>

      {saveOpen && (
        <SaveLocationModal
          ros={ros}
          onClose={() => setSaveOpen(false)}
          onLog={onLog}
        />
      )}

      {showOpen && (
        <ShowLocationsModal
          ros={ros}
          onClose={() => setShowOpen(false)}
          onLog={onLog}
        />
      )}
    </>
  );
}