import { useEffect, useRef, useState } from 'react';
import * as ROSLIB from 'roslib';
import { ControlPanel } from './ControlPanel';
import { DirectionalPad } from './DirectionalPad';
import { SlamMap } from './SlamMap';
import { Module } from './Module';
import { VoiceCommandPanel, type VoiceRobotCommand } from './VoiceCommand';
import { MapEditorPanel } from './MapEditorPanel';

type Status = 'Inactive' | 'Active';
type Mode = 'manual driving' | 'navigation';
type SlamEnabled = 'yes' | 'no';
type ModuleStatus = 'Disabled' | 'Enabled';
type LogType = 'info' | 'warn' | 'error' | 'success';


export function MainTab() {
  const [status, setStatus]               = useState<Status>('Inactive');
  const [mode, setMode]                   = useState<Mode>('manual driving');
  const [slamEnabled, setSlamEnabled]     = useState<SlamEnabled>('no');
  const [robotStarted, setRobotStarted]   = useState(false);
  const [starting, setStarting]           = useState(false);
  const [bringupStatus, setBringupStatus] = useState<ModuleStatus>('Disabled');
  const [cartographerStatus, setCartographerStatus] = useState<ModuleStatus>('Disabled');
  const [navigationStatus, setNavigationStatus]     = useState<ModuleStatus>('Disabled');
  const [controlStatus, setControlStatus]           = useState<ModuleStatus>('Disabled');
  const [guidingStatus, setGuidingStatus]           = useState<ModuleStatus>('Disabled');
  const [batteryPercentage, setBatteryPercentage]   = useState<number | undefined>(undefined);
  const [linearVelocity, setLinearVelocity]   = useState(0);
  const [angularVelocity, setAngularVelocity] = useState(0);
  const [logs, setLogs] = useState<{ time: string; msg: string; type: LogType }[]>([
    { time: new Date().toLocaleTimeString(), msg: 'Dashboard initialized. Connecting to rosbridge...', type: 'info' },
  ]);

  const rosRef            = useRef<ROSLIB.Ros | null>(null);
  const cmdVelRef         = useRef<ROSLIB.Topic<any> | null>(null);
  const startRobotSrvRef  = useRef<ROSLIB.Service<any, any> | null>(null);
  const stopRobotSrvRef   = useRef<ROSLIB.Service<any, any> | null>(null);
  const startSlamSrvRef   = useRef<ROSLIB.Service<any, any> | null>(null);
  const saveMapSrvRef     = useRef<ROSLIB.Service<any, any> | null>(null);
  const startNavSrvRef    = useRef<ROSLIB.Service<any, any> | null>(null);
  const stopSlamSrvRef    = useRef<ROSLIB.Service<any, any> | null>(null);
  const stopNavSrvRef     = useRef<ROSLIB.Service<any, any> | null>(null);

  const startControlSrvRef = useRef<ROSLIB.Service<any, any> | null>(null);
  const stopControlSrvRef  = useRef<ROSLIB.Service<any, any> | null>(null);
  const startGuidingSrvRef = useRef<ROSLIB.Service<any, any> | null>(null);
  const stopGuidingSrvRef  = useRef<ROSLIB.Service<any, any> | null>(null);

  const voiceMotionPubRef  = useRef<ROSLIB.Topic<any> | null>(null);
  const voiceGuidingPubRef = useRef<ROSLIB.Topic<any> | null>(null);  

  const moduleStatusSrvRef = useRef<ROSLIB.Service<any, any> | null>(null);
  const batteryTopicRef   = useRef<ROSLIB.Topic<any> | null>(null);
  const activeMoveKeyRef  = useRef<string | null>(null);
  const lastBatteryUiUpdateMsRef = useRef<number>(0);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  const addLog = (msg: string, type: LogType = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev.slice(-49), { time, msg, type }]);
  };

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  useEffect(() => {
    const ros = new ROSLIB.Ros({ url: 'ws://172.20.10.2:9090' });

    ros.on('connection', () => {
      addLog('Connected to rosbridge ws://172.20.10.2:9090', 'success');
      setStatus('Active');
      lastBatteryUiUpdateMsRef.current = 0;

      try {
        const batteryTopic = new ROSLIB.Topic({ ros, name: '/battery_state', messageType: 'sensor_msgs/BatteryState' });
        batteryTopic.subscribe((message: any) => {
          let pct: number | undefined;
          if (message?.percentage !== undefined)
            pct = message.percentage <= 1.0 ? Math.round(message.percentage * 100) : Math.round(message.percentage);
          else if (message?.voltage !== undefined) {
            const v = message.voltage;
            pct = Math.round(((Math.min(12.6, Math.max(9.9, v)) - 9.9) / (12.6 - 9.9)) * 100);
          }
          if (pct === undefined) return;
          const now = Date.now();
          if (now - lastBatteryUiUpdateMsRef.current < 3000) return;
          lastBatteryUiUpdateMsRef.current = now;
          setBatteryPercentage(Math.max(0, Math.min(100, Math.trunc(pct))));
        });
        batteryTopicRef.current = batteryTopic;
        addLog('Subscribed to /battery_state', 'info');
      } catch { addLog('Failed to subscribe to /battery_state', 'warn'); }

      const cmdVelSub = new ROSLIB.Topic({ ros, name: '/cmd_vel', messageType: 'geometry_msgs/Twist' });
      cmdVelSub.subscribe((msg: any) => {
        setLinearVelocity(Math.abs(msg?.linear?.x ?? 0) * 100);
        setAngularVelocity(Math.abs(msg?.angular?.z ?? 0) * 100);
      });
    });

    const resetModules = () => {
      setStatus('Inactive');
      setRobotStarted(false);

      setBringupStatus('Disabled');
      setCartographerStatus('Disabled');
      setNavigationStatus('Disabled');
      setControlStatus('Disabled');
      setGuidingStatus('Disabled');

      setLinearVelocity(0);
      setAngularVelocity(0);
    };

    ros.on('error', (e) => { addLog(`Rosbridge error: ${e}`, 'error'); resetModules(); });
    ros.on('close', ()  => { addLog('Disconnected from rosbridge', 'warn'); resetModules(); });

    const cmdVel = new ROSLIB.Topic({ ros, name: '/cmd_vel', messageType: 'geometry_msgs/Twist' });
    startRobotSrvRef.current    = new ROSLIB.Service({ ros, name: '/start_robot',       serviceType: 'std_srvs/Trigger' });
    stopRobotSrvRef.current     = new ROSLIB.Service({ ros, name: '/stop_robot',        serviceType: 'std_srvs/Trigger' });
    
    startSlamSrvRef.current     = new ROSLIB.Service({ ros, name: '/start_slam',        serviceType: 'std_srvs/Trigger' });
    stopSlamSrvRef.current      = new ROSLIB.Service({ ros, name: '/stop_slam',         serviceType: 'std_srvs/Trigger' });
    saveMapSrvRef.current       = new ROSLIB.Service({ ros, name: '/save_map',          serviceType: 'std_srvs/Trigger' });

    startNavSrvRef.current      = new ROSLIB.Service({ ros, name: '/start_navigation',  serviceType: 'std_srvs/Trigger' });
    stopNavSrvRef.current       = new ROSLIB.Service({ ros, name: '/stop_navigation',   serviceType: 'std_srvs/Trigger' });

    startControlSrvRef.current  = new ROSLIB.Service({ ros,  name: '/start_control',    serviceType: 'std_srvs/Trigger' });
    stopControlSrvRef.current   = new ROSLIB.Service({ ros,  name: '/stop_control',     serviceType: 'std_srvs/Trigger' });
    startGuidingSrvRef.current  = new ROSLIB.Service({ ros, name: '/start_guiding',     serviceType: 'std_srvs/Trigger' });
    stopGuidingSrvRef.current   = new ROSLIB.Service({ ros, name: '/stop_guiding',      serviceType: 'std_srvs/Trigger' });
    voiceMotionPubRef.current   = new ROSLIB.Topic({ ros, name: '/voice_motion_cmd',    messageType: 'std_msgs/String' });
    voiceGuidingPubRef.current  = new ROSLIB.Topic({ ros, name: '/voice_guiding_cmd',   messageType: 'std_msgs/String' });
    
    moduleStatusSrvRef.current  = new ROSLIB.Service({ ros, name: '/get_module_status', serviceType: 'std_srvs/Trigger' });    

    rosRef.current    = ros;
    cmdVelRef.current = cmdVel;

    return () => {
      try { cmdVel.unsubscribe(); } catch {}
      try { batteryTopicRef.current?.unsubscribe(); } catch {}
      try { ros.close(); } catch {}
    };
  }, []);

  useEffect(() => {
    const pollModuleStatus = () => {
      if (status !== 'Active' || !moduleStatusSrvRef.current) {
        setBringupStatus('Disabled');
        setCartographerStatus('Disabled');
        setNavigationStatus('Disabled');
        setControlStatus('Disabled');
        setGuidingStatus('Disabled');
        setRobotStarted(false);
        return;
      }

      moduleStatusSrvRef.current.callService({} as any, (res: any) => {
        if (!res?.success) {
          setBringupStatus('Disabled');
          setCartographerStatus('Disabled');
          setNavigationStatus('Disabled');
          setControlStatus('Disabled');
          setGuidingStatus('Disabled');
          setRobotStarted(false);
          return;
        }

        try {
          const data = JSON.parse(res.message || '{}');

          const bringupOn = data.bringup === true;
          const slamOn = data.cartographer === true;
          const navOn = data.navigation === true;
          const controlOn = data.control === true;
          const guidingOn = data.guiding === true;

          setBringupStatus(bringupOn ? 'Enabled' : 'Disabled');
          setCartographerStatus(slamOn ? 'Enabled' : 'Disabled');
          setNavigationStatus(navOn ? 'Enabled' : 'Disabled');
          setControlStatus(controlOn ? 'Enabled' : 'Disabled');
          setGuidingStatus(guidingOn ? 'Enabled' : 'Disabled');

          setRobotStarted(bringupOn);
        } catch (e) {
          console.error('Failed to parse /get_module_status response:', e);
        }
      });
    };

    pollModuleStatus();
    const id = setInterval(pollModuleStatus, 2000);

    return () => clearInterval(id);
  }, [status]);  

  useEffect(() => {
    const check = () => {
      let opened = false;
      const ws = new WebSocket('ws://172.20.10.2:9090');
      const markInactive = () => { if (!opened) { setStatus('Inactive'); setRobotStarted(false); } };
      ws.onopen  = () => { opened = true; setStatus('Active'); ws.close(); };
      ws.onerror = markInactive;
      ws.onclose = markInactive;
    };
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, []);

  const callTrigger = (srv: ROSLIB.Service<any, any>) =>
    new Promise<any>((resolve) => srv.callService({} as any, resolve));

  const handleExportMap = () => {
    if (status !== 'Active' || !saveMapSrvRef.current) { addLog('Export failed: not connected', 'error'); return; }
    addLog('Exporting map...', 'info');
    saveMapSrvRef.current.callService({} as any, (res: any) =>
      res?.success ? addLog('Map saved: ~/map.yaml and ~/map.pgm', 'success')
                   : addLog(`Map export failed: ${res?.message ?? '(no message)'}`, 'error'));
  };

  const handleKillProcess = () => {
    if (status !== 'Active' || !stopRobotSrvRef.current) { addLog('Kill failed: not connected', 'error'); return; }
    addLog('Sending kill signal...', 'warn');
    setStarting(true);
    stopRobotSrvRef.current.callService({} as any, (res: any) => {
      setStarting(false);
      if (res?.success) {
        setRobotStarted(false);
        setBringupStatus('Disabled');
        setCartographerStatus('Disabled');
        setNavigationStatus('Disabled');
        setControlStatus('Disabled');
        setGuidingStatus('Disabled');
        addLog('All processes stopped', 'warn');
      } else addLog(`Kill failed: ${res?.message ?? '(no message)'}`, 'error');
    });
  };

  const handleSet = async () => {
    if (status !== 'Active' || !startRobotSrvRef.current) { addLog('Set failed: not connected', 'error'); return; }
    setStarting(true); setRobotStarted(false);
    setBringupStatus('Disabled'); setCartographerStatus('Disabled'); setNavigationStatus('Disabled');
    addLog(`Starting bringup (mode: ${mode}, SLAM: ${slamEnabled})...`, 'info');

    try {
      const bringupRes = await callTrigger(startRobotSrvRef.current);
      if (!bringupRes?.success) { setStarting(false); addLog(`Bringup failed: ${bringupRes?.message ?? '(no message)'}`, 'error'); return; }
      setBringupStatus('Enabled'); setRobotStarted(true); addLog('Bringup enabled', 'success');

      if (mode === 'manual driving' && slamEnabled === 'yes') {
        if (!startSlamSrvRef.current) { setStarting(false); addLog('SLAM service not ready', 'error'); return; }
        const slamRes = await callTrigger(startSlamSrvRef.current);
        if (!slamRes?.success) { setStarting(false); addLog(`Cartographer failed: ${slamRes?.message ?? '(no message)'}`, 'error'); return; }
        setCartographerStatus('Enabled'); addLog('Cartographer SLAM enabled', 'success');
      } else if (mode === 'navigation') {
        if (!startNavSrvRef.current) { setStarting(false); addLog('Navigation service not ready', 'error'); return; }
        const navRes = await callTrigger(startNavSrvRef.current);
        if (!navRes?.success) { setStarting(false); addLog(`Navigation failed: ${navRes?.message ?? '(no message)'}`, 'error'); return; }
        setNavigationStatus('Enabled'); addLog('Nav2 navigation enabled', 'success');
      }
      setStarting(false);
    } catch (e) { addLog(`Set failed: ${e}`, 'error'); setStarting(false); setRobotStarted(false); }
  };

  const publishVoiceMotion = (cmd: string) => {
    if (!voiceMotionPubRef.current) {
      addLog('Voice motion topic not ready', 'error');
      return;
    }

    voiceMotionPubRef.current.publish({ data: cmd } as any);
    addLog(`Published /voice_motion_cmd: ${cmd}`, 'success');
  };

  const publishVoiceGuiding = (cmd: string) => {
    if (!voiceGuidingPubRef.current) {
      addLog('Voice guiding topic not ready', 'error');
      return;
    }

    voiceGuidingPubRef.current.publish({ data: cmd } as any);
    addLog(`Published /voice_guiding_cmd: ${cmd}`, 'success');
  };

  const handleVoiceCommand = async (
    command: VoiceRobotCommand,
    rawText: string,
    target?: string,
    targets?: string[],
    optimize?: boolean
  ) => {  
    if (status !== 'Active') {
      addLog(`Voice ignored: rosbridge offline. Heard "${rawText}"`, 'warn');
      return;
    }

    addLog(`Voice heard: "${rawText}"`, 'info');

    try {
      switch (command) {
        case 'start_bringup': {
          if (!startRobotSrvRef.current) return addLog('/start_robot not ready', 'error');
          const res = await callTrigger(startRobotSrvRef.current);
          addLog(res?.message ?? 'start bringup done', res?.success ? 'success' : 'error');
          return;
        }

        case 'stop_bringup': {
          if (!stopRobotSrvRef.current) return addLog('/stop_robot not ready', 'error');
          const res = await callTrigger(stopRobotSrvRef.current);
          addLog(res?.message ?? 'stop bringup done', res?.success ? 'success' : 'error');
          return;
        }

        case 'start_cartographer': {
          if (!startSlamSrvRef.current) return addLog('/start_slam not ready', 'error');
          const res = await callTrigger(startSlamSrvRef.current);
          addLog(res?.message ?? 'start cartographer done', res?.success ? 'success' : 'error');
          return;
        }

        case 'stop_cartographer': {
          if (!stopSlamSrvRef.current) return addLog('/stop_slam not ready', 'error');
          const res = await callTrigger(stopSlamSrvRef.current);
          addLog(res?.message ?? 'stop cartographer done', res?.success ? 'success' : 'error');
          return;
        }

        case 'start_navigation': {
          if (!startNavSrvRef.current) return addLog('/start_navigation not ready', 'error');
          const res = await callTrigger(startNavSrvRef.current);
          addLog(res?.message ?? 'start navigation done', res?.success ? 'success' : 'error');
          return;
        }

        case 'stop_navigation': {
          if (!stopNavSrvRef.current) return addLog('/stop_navigation not ready', 'error');
          const res = await callTrigger(stopNavSrvRef.current);
          addLog(res?.message ?? 'stop navigation done', res?.success ? 'success' : 'error');
          return;
        }

        case 'start_control': {
          if (!startControlSrvRef.current) return addLog('/start_control not ready', 'error');
          const res = await callTrigger(startControlSrvRef.current);
          addLog(res?.message ?? 'start control done', res?.success ? 'success' : 'error');
          return;
        }

        case 'stop_control': {
          if (!stopControlSrvRef.current) return addLog('/stop_control not ready', 'error');
          const res = await callTrigger(stopControlSrvRef.current);
          addLog(res?.message ?? 'stop control done', res?.success ? 'success' : 'error');
          return;
        }

        case 'start_guiding': {
          if (!startGuidingSrvRef.current) return addLog('/start_guiding not ready', 'error');
          const res = await callTrigger(startGuidingSrvRef.current);
          addLog(res?.message ?? 'start guiding done', res?.success ? 'success' : 'error');
          return;
        }

        case 'stop_guiding': {
          if (!stopGuidingSrvRef.current) return addLog('/stop_guiding not ready', 'error');
          const res = await callTrigger(stopGuidingSrvRef.current);
          addLog(res?.message ?? 'stop guiding done', res?.success ? 'success' : 'error');
          return;
        }

        case 'guiding_location': {
          if (!target) {
            addLog(`Voice guiding failed: no location target found in "${rawText}"`, 'error');
            return;
          }

          publishVoiceGuiding(`go to ${target}`);
          return;
        }        

        case 'guiding_route': {
          if (!targets || targets.length < 2) {
            addLog(`Voice guiding failed: route needs at least 2 locations in "${rawText}"`, 'error');
            return;
          }

          const cleanTargets = targets.filter(Boolean);
          const cmd = optimize
            ? `route --optimize ${cleanTargets.join(' ')}`
            : `route ${cleanTargets.join(' ')}`;

          publishVoiceGuiding(cmd);
          return;
        }        

        case 'motion_forward':
          publishVoiceMotion('forward');
          return;

        case 'motion_backward':
          publishVoiceMotion('backward');
          return;

        case 'motion_left':
          publishVoiceMotion('left');
          return;

        case 'motion_right':
          publishVoiceMotion('right');
          return;

        case 'motion_stop':
          publishVoiceMotion('stop');
          return;

        case 'guiding_pos1':
          publishVoiceGuiding('go to position one');
          return;

        case 'guiding_pos2':
          publishVoiceGuiding('go to position two');
          return;

        case 'guiding_pause':
          publishVoiceGuiding('pause guiding');
          return;

        case 'guiding_return_dock':
          publishVoiceGuiding('return to the dock');
          return;

        default:
          addLog(`Unknown voice command: "${rawText}"`, 'warn');
          return;
      }
    } catch (e) {
      addLog(`Voice command error: ${e}`, 'error');
    }
  };

  const handleDirectionClick = (direction: 'up' | 'down' | 'left' | 'right' | 'stop') => {
    if (!robotStarted || !cmdVelRef.current) return;
    let linear = 0, angular = 0;
    switch (direction) {
      case 'up':    linear =  0.10; break;
      case 'down':  linear = -0.10; break;
      case 'left':  angular =  0.6; break;
      case 'right': angular = -0.6; break;
    }
    cmdVelRef.current.publish({ linear: { x: linear, y: 0, z: 0 }, angular: { x: 0, y: 0, z: angular } } as any);
  };

  useEffect(() => {
    const isInput = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      if (!el) return false;
      return ['input','textarea'].includes((el.tagName||'').toLowerCase()) || el.isContentEditable;
    };
    const keyToDir = (k: string) => {
      switch (k) {
        case 'w': case 'W': case 'ArrowUp':    return 'up';
        case 's': case 'S': case 'ArrowDown':  return 'down';
        case 'a': case 'A': case 'ArrowLeft':  return 'left';
        case 'd': case 'D': case 'ArrowRight': return 'right';
        case ' ': return 'stop';
        default: return null;
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (isInput(e.target) || bringupStatus !== 'Enabled') return;
      const dir = keyToDir(e.key) as any;
      if (!dir) return;
      e.preventDefault();
      if (dir !== 'stop') { if (activeMoveKeyRef.current === e.key) return; activeMoveKeyRef.current = e.key; }
      else activeMoveKeyRef.current = null;
      handleDirectionClick(dir);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (isInput(e.target) || bringupStatus !== 'Enabled') return;
      const dir = keyToDir(e.key);
      if (dir && activeMoveKeyRef.current === e.key) { activeMoveKeyRef.current = null; handleDirectionClick('stop'); }
    };
    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKeyDown as any); window.removeEventListener('keyup', onKeyUp as any); };
  }, [bringupStatus]);

  const logColors: Record<LogType, string> = {
    info:    'var(--tb-muted)',
    success: 'var(--tb-cyan)',
    warn:    'var(--tb-yellow)',
    error:   'var(--tb-red)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--tb-bg)' }}>
      {/* Main workspace — centred, content capped at max width */}
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0, display: 'flex', justifyContent: 'center' }}>

        {/* Inner row: sidebar + map, never wider than sidebar+1000px */}
        <div style={{ display: 'flex', width: '100%', maxWidth: '1516px', minHeight: 0 }}>

          {/* Left sidebar */}
          <div style={{
            width: '16rem', flexShrink: 0,
            display: 'flex', flexDirection: 'column', gap: '0.75rem',
            padding: '1rem',
            borderRight: '1px solid var(--tb-border)',
            overflowY: 'auto',
            backgroundColor: 'var(--tb-bg)',
          }}>
            <ControlPanel
              status={status} mode={mode} slamEnabled={slamEnabled}
              onModeChange={setMode} onSlamChange={setSlamEnabled}
              onExportMap={handleExportMap} exportDisabled={cartographerStatus !== 'Enabled'}
              slamDisabled={mode === 'navigation'}
              onKillProcess={handleKillProcess}
              onSet={handleSet}
              setDisabled={status !== 'Active' || starting || bringupStatus === 'Enabled'}
              setLabel={starting ? 'starting...' : 'set'}
            />
            <Module
              bringupStatus={bringupStatus} 
              cartographerStatus={cartographerStatus}
              navigationStatus={navigationStatus} 
              controlStatus={controlStatus}   
              guidingStatus={guidingStatus}             
              batteryPercentage={batteryPercentage}
              linearVelocity={linearVelocity} 
              angularVelocity={angularVelocity}
            />
            <DirectionalPad onDirectionClick={handleDirectionClick} disabled={bringupStatus !== 'Enabled'} />
          </div>

          {/* SLAM Map — grows to fill available space, never exceeds 1000px */}
          <div style={{
            flex: 1, minHeight: 0, minWidth: 0,
            maxWidth: '1000px',
            padding: '1rem',
            display: 'flex',
          }}>
            <SlamMap ros={rosRef.current} topicName="/map" navigationEnabled={navigationStatus === 'Enabled'} />
          </div>

          {/* Right sidebar — Voice command + Map Editor */}
          <div style={{
            width: '16rem', flexShrink: 0,
            display: 'flex', flexDirection: 'column', gap: '0.75rem',
            padding: '1rem',
            borderLeft: '1px solid var(--tb-border)',
            overflowY: 'auto',
            backgroundColor: 'var(--tb-bg)',
            minHeight: 0,
          }}>
            <div style={{ flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <VoiceCommandPanel 
                disabled={status !== 'Active'}
                onCommand={handleVoiceCommand}
              />
            </div>
            <div style={{ flexShrink: 0 }}>
              <MapEditorPanel
                ros={rosRef.current}
                disabled={status !== 'Active'}
                onLog={addLog}
              />
            </div>
          </div>

        </div>
      </div>

      {/* Log panel */}
      <div className="tb-log" style={{ height: '8rem', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.375rem 1rem',
          borderBottom: '1px solid var(--tb-border)',
        }}>
          <div style={{ width: '3px', height: '0.75rem', borderRadius: '9999px', backgroundColor: 'var(--tb-cyan)', flexShrink: 0 }} />
          <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--tb-muted)' }}>
            Console Output
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.25rem' }}>
            {['var(--tb-red)', 'var(--tb-yellow)', 'var(--tb-cyan)'].map((c, i) => (
              <div key={i} style={{ width: '6px', height: '6px', borderRadius: '9999px', backgroundColor: c, opacity: 0.4 }} />
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.375rem 1rem' }}>
          {logs.map((log, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.75rem', lineHeight: 1.6 }}>
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.6rem', color: 'var(--tb-faint)', flexShrink: 0 }}>{log.time}</span>
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.6rem', color: logColors[log.type] }}>{log.msg}</span>
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}