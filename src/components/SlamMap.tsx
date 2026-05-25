import { useEffect, useMemo, useRef, useState } from 'react';
import * as ROSLIB from 'roslib';

type Props = {
  ros: ROSLIB.Ros | null;
  topicName?: string; // default: /map

  // When true, allow "RViz-like" interactions:
  // - Set initial pose (publish /initialpose)
  // - Set goal (publish /goal_pose)
  // This is ONLY used for Navigation mode, and does not affect the existing SLAM drawing logic.
  navigationEnabled?: boolean;
};

type OccupancyGridMsg = {
  info: {
    width: number;
    height: number;
    resolution: number;
    origin: {
      position: { x: number; y: number; z: number };
      orientation: { x: number; y: number; z: number; w: number };
    };
  };
  data: number[];
};

// tf2_msgs/TFMessage (as it arrives through rosbridge)
type TfTransform = {
  header: { frame_id: string };
  child_frame_id: string;
  transform: {
    translation: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number; w: number };
  };
};

type SavedLocation = {
  name: string;
  frame_id: string;
  x: number;
  y: number;
  z: number;
  w: number;
};

type TfMessage = { transforms: TfTransform[] };

type Pose2D = { x: number; y: number; yaw: number };

type Quat = { x: number; y: number; z: number; w: number };
type Vec3 = { x: number; y: number; z: number };
type Transform3 = { t: Vec3; q: Quat };

function quatMul(a: Quat, b: Quat): Quat {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}

function quatNormalize(q: Quat): Quat {
  const n = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w) || 1;
  return { x: q.x / n, y: q.y / n, z: q.z / n, w: q.w / n };
}

function quatRotateVec(qIn: Quat, v: Vec3): Vec3 {
  const q = quatNormalize(qIn);
  // v' = q * (0,v) * q^-1
  const p: Quat = { x: v.x, y: v.y, z: v.z, w: 0 };
  const qInv: Quat = { x: -q.x, y: -q.y, z: -q.z, w: q.w };
  const qp = quatMul(q, p);
  const out = quatMul(qp, qInv);
  return { x: out.x, y: out.y, z: out.z };
}

function compose(a: Transform3, b: Transform3): Transform3 {
  // T_ac = T_ab ∘ T_bc
  const rb = quatRotateVec(a.q, b.t);
  return {
    t: { x: a.t.x + rb.x, y: a.t.y + rb.y, z: a.t.z + rb.z },
    q: quatNormalize(quatMul(a.q, b.q)),
  };
}

function yawFromQuat(q: Quat): number {
  const siny = 2 * (q.w * q.z + q.x * q.y);
  const cosy = 1 - 2 * (q.y * q.y + q.z * q.z);
  return Math.atan2(siny, cosy);
}

function quatFromYaw(yaw: number): Quat {
  const h = yaw / 2;
  return { x: 0, y: 0, z: Math.sin(h), w: Math.cos(h) };
}

export function SlamMap({ ros, topicName = '/map', navigationEnabled = false }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [mapInfo, setMapInfo] = useState<{ w: number; h: number } | null>(null);

  // keep last occupancy image (raw pixels, unscaled)
  const lastImageRef = useRef<ImageData | null>(null);
  const lastWHRef = useRef<{ w: number; h: number } | null>(null);

  // offscreen canvas cache (avoid recreating each draw)
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);

  // keep map metadata needed for world->pixel
  const mapMetaRef = useRef<{
    w: number;
    h: number;
    resolution: number;
    originX: number;
    originY: number;
  } | null>(null);

  // store latest TFs: key = `${parent}->${child}`
  const tfStoreRef = useRef<Map<string, Transform3>>(new Map());

  // robot pose in map frame (state is only for showing text label)
  const [robotPose, setRobotPose] = useState<Pose2D | null>(null);
  const robotPoseRef = useRef<Pose2D | null>(null);

  // remember how we drew the map (scale + offset) so overlays match
  const drawParamsRef = useRef<{ scale: number; offsetX: number; offsetY: number } | null>(null);

  // saved locations (for demo of map editing features)
  const savedLocationsRef = useRef<SavedLocation[]>([]);
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);

  const [mapView, setMapView] = useState<{
    scale: number;
    offsetX: number;
    offsetY: number;
    w: number;
    h: number;
    resolution: number;
    originX: number;
    originY: number;
  } | null>(null);

  const lastMapViewKeyRef = useRef('');  

  const locationReqTopicRef = useRef<ROSLIB.Topic<any> | null>(null);
  const locationResTopicRef = useRef<ROSLIB.Topic<any> | null>(null);  
  const locationRequestIdRef = useRef('');

  // --- redraw scheduling (prevents flashing with high-rate /tf)
  const rafPendingRef = useRef(false);
  const scheduleDraw = () => {
    if (rafPendingRef.current) return;
    rafPendingRef.current = true;
    requestAnimationFrame(() => {
      rafPendingRef.current = false;
      drawToCanvas();
    });
  };

  // limit how often we update React state for pose label
  const lastPoseStateUpdateMsRef = useRef(0);

  // ---------------- Navigation interaction (click + drag like RViz) ----------------
  type NavTool = 'pose' | 'goal';
  const [navTool, setNavTool] = useState<NavTool>('goal');

  // drag state: start + current (world coords)
  const dragRef = useRef<{
    active: boolean;
    startWorld: { x: number; y: number } | null;
    currWorld: { x: number; y: number } | null;
  }>({ active: false, startWorld: null, currWorld: null });

  const initialPoseTopic = useMemo(() => {
    if (!ros || !navigationEnabled) return null;
    return new ROSLIB.Topic({
      ros,
      name: '/initialpose',
      messageType: 'geometry_msgs/PoseWithCovarianceStamped',
      queue_size: 1,
    });
  }, [ros, navigationEnabled]);

  const goalPoseTopic = useMemo(() => {
    if (!ros || !navigationEnabled) return null;
    return new ROSLIB.Topic({
      ros,
      name: '/goal_pose',
      messageType: 'geometry_msgs/PoseStamped',
      queue_size: 1,
    });
  }, [ros, navigationEnabled]);

  const pixelToWorld = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    const meta = mapMetaRef.current;
    const wh = lastWHRef.current;
    const dp = drawParamsRef.current;
    if (!canvas || !meta || !wh || !dp) return null;

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // outside canvas
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;

    // canvas -> map image px
    const px = (x - dp.offsetX) / dp.scale;
    const py = (y - dp.offsetY) / dp.scale;

    // outside drawn map area
    if (px < 0 || py < 0 || px >= wh.w || py >= wh.h) return null;

    // undo the vertical flip done when building occupancy ImageData
    const gx = px;
    const gy = (wh.h - 1) - py;

    const wx = meta.originX + gx * meta.resolution;
    const wy = meta.originY + gy * meta.resolution;

    if (!Number.isFinite(wx) || !Number.isFinite(wy)) return null;
    return { x: wx, y: wy };
  };

  const publishInitialPose = (x: number, y: number, yaw: number) => {
    if (!initialPoseTopic) return;

    const q = quatFromYaw(yaw);

    // Basic covariance (reasonable defaults). Nav2/AMCL mainly needs the pose + some uncertainty.
    const cov = new Array(36).fill(0);
    cov[0] = 0.25; // x
    cov[7] = 0.25; // y
    cov[35] = 0.0685; // yaw

    initialPoseTopic.publish({
      header: { frame_id: 'map', stamp: { secs: 0, nsecs: 0 } },
      pose: {
        pose: {
          position: { x, y, z: 0 },
          orientation: q,
        },
        covariance: cov,
      },
    } as any);
  };

  const publishGoalPose = (x: number, y: number, yaw: number) => {
    if (!goalPoseTopic) return;

    const q = quatFromYaw(yaw);

    goalPoseTopic.publish({
      header: { frame_id: 'map', stamp: { secs: 0, nsecs: 0 } },
      pose: {
        position: { x, y, z: 0 },
        orientation: q,
      },
    } as any);
  };

  const savedLocationMarkers = useMemo(() => {
    if (!navigationEnabled || !mapView) return [];

    return savedLocations
      .filter((loc) => !loc.frame_id || loc.frame_id === 'map')
      .map((loc) => {
        const gx = (loc.x - mapView.originX) / mapView.resolution;
        const gy = (loc.y - mapView.originY) / mapView.resolution;

        if (!Number.isFinite(gx) || !Number.isFinite(gy)) return null;
        if (gx < 0 || gy < 0 || gx >= mapView.w || gy >= mapView.h) return null;

        const px = gx;
        const py = (mapView.h - 1) - gy;

        return {
          name: loc.name,
          x: mapView.offsetX + px * mapView.scale,
          y: mapView.offsetY + py * mapView.scale,
        };
      })
      .filter(Boolean) as { name: string; x: number; y: number }[];
  }, [savedLocations, mapView, navigationEnabled]);

  const onPointerDown = (e: any) => {
    if (!navigationEnabled) return;

    const w = pixelToWorld(e.clientX, e.clientY);
    if (!w) return;

    dragRef.current = { active: true, startWorld: w, currWorld: w };

    // capture so pointerup works even if cursor leaves canvas
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);

    scheduleDraw();
  };

  const onPointerMove = (e: any) => {
    if (!navigationEnabled) return;
    if (!dragRef.current.active) return;

    const w = pixelToWorld(e.clientX, e.clientY);
    if (!w) return;

    dragRef.current.currWorld = w;
    scheduleDraw();
  };

  const onPointerUp = (e: any) => {
    if (!navigationEnabled) return;
    if (!dragRef.current.active) return;

    const start = dragRef.current.startWorld;
    const end = dragRef.current.currWorld;

    dragRef.current.active = false;

    if (!start || !end) {
      scheduleDraw();
      return;
    }

    const dx = end.x - start.x;
    const dy = end.y - start.y;

    // If user just clicked without dragging, keep yaw = 0
    const yaw = Math.abs(dx) < 1e-4 && Math.abs(dy) < 1e-4 ? 0 : Math.atan2(dy, dx);

    if (navTool === 'pose') publishInitialPose(start.x, start.y, yaw);
    else publishGoalPose(start.x, start.y, yaw);

    scheduleDraw();
  };

  // ---------------- end nav interaction ----------------

  const requestSavedLocations = () => {
    if (!locationReqTopicRef.current) return;

    const requestId = `slam-map-locations-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    locationRequestIdRef.current = requestId;

    locationReqTopicRef.current.publish({
      data: JSON.stringify({
        request_id: requestId,
        action: 'list',
      }),
    } as any);
  };

  // Request saved locations on load (for demo of map editing features)
  useEffect(() => {
    if (!ros || !navigationEnabled) {
      savedLocationsRef.current = [];
      setSavedLocations([]);
      scheduleDraw();
      return;
    }

    const reqTopic = new ROSLIB.Topic({
      ros,
      name: '/location_manage_request',
      messageType: 'std_msgs/String',
    });

    const resTopic = new ROSLIB.Topic({
      ros,
      name: '/location_manage_response',
      messageType: 'std_msgs/String',
    });

    const onResponse = (msg: any) => {
      try {
        const data = JSON.parse(msg?.data || '{}');

        if (data.request_id !== locationRequestIdRef.current) return;
        if (!Array.isArray(data.locations)) return;

        const locations = data.locations
          .map((loc: any) => ({
            name: String(loc.name ?? ''),
            frame_id: String(loc.frame_id ?? 'map'),
            x: Number(loc.x ?? 0),
            y: Number(loc.y ?? 0),
            z: Number(loc.z ?? 0),
            w: Number(loc.w ?? 1),
          }))
          .filter((loc: SavedLocation) =>
            loc.name &&
            Number.isFinite(loc.x) &&
            Number.isFinite(loc.y)
          );

        savedLocationsRef.current = locations;
        setSavedLocations(locations);
        scheduleDraw();
      } catch {
        // ignore malformed response
      }
    };

    const onLocationsChanged = () => {
      requestSavedLocations();
    };

    resTopic.subscribe(onResponse);

    locationReqTopicRef.current = reqTopic;
    locationResTopicRef.current = resTopic;

    window.addEventListener('saved-locations-changed', onLocationsChanged);

    const timer = window.setTimeout(() => {
      requestSavedLocations();
    }, 300);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('saved-locations-changed', onLocationsChanged);

      try {
        resTopic.unsubscribe(onResponse);
      } catch {}

      locationReqTopicRef.current = null;
      locationResTopicRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ros, navigationEnabled]);

  // Resize canvas to fit the right panel
  useEffect(() => {
    const el = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!el || !canvas) return;

    const syncSize = () => {
      const rect = el.getBoundingClientRect();

      const cssW = Math.max(1, Math.floor(rect.width));
      const cssH = Math.max(1, Math.floor(rect.height));

      const dpr = Math.max(1, window.devicePixelRatio || 1);

      const pixelW = Math.floor(cssW * dpr);
      const pixelH = Math.floor(cssH * dpr);

      if (canvas.width !== pixelW) canvas.width = pixelW;
      if (canvas.height !== pixelH) canvas.height = pixelH;

      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;

      scheduleDraw();
    };

    // Measure immediately (synchronous) so first paint is already correct
    syncSize();

    const ro = new ResizeObserver(syncSize);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mapTopic = useMemo(() => {
    if (!ros) return null;
    return new ROSLIB.Topic({
      ros,
      name: topicName,
      messageType: 'nav_msgs/OccupancyGrid',
      queue_size: 1,
      throttle_rate: 0,
    });
  }, [ros, topicName]);

  const tfTopic = useMemo(() => {
    if (!ros) return null;
    return new ROSLIB.Topic({
      ros,
      name: '/tf',
      messageType: 'tf2_msgs/TFMessage',
      queue_size: 10,
      throttle_rate: 0,
    });
  }, [ros]);

  const tfStaticTopic = useMemo(() => {
    if (!ros) return null;
    return new ROSLIB.Topic({
      ros,
      name: '/tf_static',
      messageType: 'tf2_msgs/TFMessage',
      queue_size: 10,
      throttle_rate: 0,
    });
  }, [ros]);

  // OccupancyGrid subscription
  useEffect(() => {
    if (!mapTopic) return;

    const onMsg = (msg: any) => {
      const grid = msg as OccupancyGridMsg;

      const w = grid.info.width;
      const h = grid.info.height;
      const data = grid.data;

      if (!w || !h || data.length !== w * h) return;

      setMapInfo({ w, h });

      mapMetaRef.current = {
        w,
        h,
        resolution: grid.info.resolution,
        originX: grid.info.origin.position.x,
        originY: grid.info.origin.position.y,
      };

      const img = new ImageData(w, h);
      for (let y = 0; y < h; y++) {
        const srcRow = y;
        const dstRow = h - 1 - y; // flip Y to match "up" on canvas
        for (let x = 0; x < w; x++) {
          const srcIdx = srcRow * w + x;
          const dstIdx = (dstRow * w + x) * 4;

          const v = data[srcIdx];
          let c = 255;
          if (v === -1) c = 205; // unknown
          else if (v >= 50) c = 0; // occupied

          img.data[dstIdx + 0] = c;
          img.data[dstIdx + 1] = c;
          img.data[dstIdx + 2] = c;
          img.data[dstIdx + 3] = 255;
        }
      }

      lastImageRef.current = img;
      lastWHRef.current = { w, h };

      // refresh cached offscreen
      if (!offscreenRef.current) offscreenRef.current = document.createElement('canvas');
      offscreenRef.current.width = w;
      offscreenRef.current.height = h;
      const offCtx = offscreenRef.current.getContext('2d');
      if (offCtx) offCtx.putImageData(img, 0, 0);

      scheduleDraw();
    };

    mapTopic.subscribe(onMsg);
    return () => mapTopic.unsubscribe(onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapTopic]);

  // TF subscriptions + pose extraction
  useEffect(() => {
    if (!tfTopic && !tfStaticTopic) return;

    const robotFrames = ['base_footprint', 'base_link']; // try these in order
    const fixedFrame = 'map';
    const odomFrame = 'odom';

    const upsert = (t: TfTransform) => {
      const parent = (t.header?.frame_id ?? '').replace(/^\/+/, '');
      const child = (t.child_frame_id ?? '').replace(/^\/+/, '');
      if (!parent || !child) return;

      tfStoreRef.current.set(`${parent}->${child}`, {
        t: { x: t.transform.translation.x, y: t.transform.translation.y, z: t.transform.translation.z },
        q: quatNormalize({
          x: t.transform.rotation.x,
          y: t.transform.rotation.y,
          z: t.transform.rotation.z,
          w: t.transform.rotation.w,
        }),
      });
    };

    const tryComputePose = () => {
      const store = tfStoreRef.current;
      const get = (p: string, c: string) => store.get(`${p}->${c}`) ?? null;

      let best: Transform3 | null = null;

      // 1) direct map->base_footprint / map->base_link
      for (const rf of robotFrames) {
        const direct = get(fixedFrame, rf);
        if (direct) {
          best = direct;
          break;
        }
      }

      // 2) compose map->odom + odom->base_footprint/base_link (common cartographer setup)
      if (!best) {
        const m2o = get(fixedFrame, odomFrame);
        if (m2o) {
          for (const rf of robotFrames) {
            const o2b = get(odomFrame, rf);
            if (o2b) {
              best = compose(m2o, o2b);
              break;
            }
          }
        }
      }

      if (!best) return;

      const yaw = yawFromQuat(best.q);
      const pose: Pose2D = { x: best.t.x, y: best.t.y, yaw };
      robotPoseRef.current = pose;

      // Update label at ~10Hz max, but redraw overlay at animation frame speed
      const now = Date.now();
      if (now - lastPoseStateUpdateMsRef.current >= 100) {
        lastPoseStateUpdateMsRef.current = now;
        setRobotPose(pose);
      }

      scheduleDraw();
    };

    const onTf = (msg: any) => {
      const m = msg as TfMessage;
      if (!m?.transforms?.length) return;
      for (const t of m.transforms) upsert(t);
      tryComputePose();
    };

    if (tfTopic) tfTopic.subscribe(onTf);
    if (tfStaticTopic) tfStaticTopic.subscribe(onTf);

    return () => {
      try {
        if (tfTopic) tfTopic.unsubscribe(onTf);
      } catch {}
      try {
        if (tfStaticTopic) tfStaticTopic.unsubscribe(onTf);
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tfTopic, tfStaticTopic]);

  const worldToCanvas = (wx: number, wy: number): { x: number; y: number } | null => {
    const meta = mapMetaRef.current;
    const wh = lastWHRef.current;
    const dp = drawParamsRef.current;

    if (!meta || !wh || !dp) return null;

    const gx = (wx - meta.originX) / meta.resolution;
    const gy = (wy - meta.originY) / meta.resolution;

    if (!Number.isFinite(gx) || !Number.isFinite(gy)) return null;

    if (gx < 0 || gy < 0 || gx >= wh.w || gy >= wh.h) return null;

    const px = gx;
    const py = (wh.h - 1) - gy;

    return {
      x: dp.offsetX + px * dp.scale,
      y: dp.offsetY + py * dp.scale,
    };
  };

  const drawRobotOverlay = (ctx: CanvasRenderingContext2D) => {
    const meta = mapMetaRef.current;
    const wh = lastWHRef.current;
    const p = robotPoseRef.current;
    const drawParams = drawParamsRef.current;

    if (!meta || !wh || !p || !drawParams) return;

    // world (map frame) -> grid cell
    const gx = (p.x - meta.originX) / meta.resolution;
    const gy = (p.y - meta.originY) / meta.resolution;

    if (!Number.isFinite(gx) || !Number.isFinite(gy)) return;

    // because we flipped Y in the occupancy ImageData:
    const px = gx;
    const py = (wh.h - 1) - gy;

    // map-image pixel -> canvas pixel (using same scale/offset as drawImage)
    const cx = drawParams.offsetX + px * drawParams.scale;
    const cy = drawParams.offsetY + py * drawParams.scale;

    // FIX: keep marker size in SCREEN pixels (not scaled with map)
    const r = 9; // dot radius in px
    const len = 45; // arrow length in px
    const lineW = 4; // arrow line width in px

    ctx.save();
    ctx.translate(cx, cy);

    // dot
    ctx.beginPath();
    ctx.fillStyle = 'rgba(255,0,0,0.85)';
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // outline (makes it easier to see on black walls)
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.stroke();

    // heading (map frame yaw: CCW). Because our image is vertically flipped, yaw must be mirrored.
    const yawForCanvas = -p.yaw;

    ctx.strokeStyle = 'rgba(255,0,0,0.85)';
    ctx.lineWidth = lineW;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(yawForCanvas) * len, Math.sin(yawForCanvas) * len);
    ctx.stroke();

    ctx.restore();
  };

  const drawSavedLocationOverlay = (ctx: CanvasRenderingContext2D) => {
    if (!navigationEnabled) return;

    const locations = savedLocationsRef.current;
    if (!locations.length) return;

    ctx.save();

    for (const loc of locations) {
      if (loc.frame_id && loc.frame_id !== 'map') continue;

      const p = worldToCanvas(loc.x, loc.y);
      if (!p) continue;

      const label = loc.name;
      const paddingX = 7;
      const boxH = 22;

      ctx.font = '700 12px ui-monospace, monospace';
      const textW = ctx.measureText(label).width;
      const boxW = Math.max(42, textW + paddingX * 2);

      const boxX = p.x - boxW / 2;
      const boxY = p.y - boxH - 10;

      // connection dot
      ctx.beginPath();
      ctx.fillStyle = 'rgba(34, 211, 238, 0.95)';
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();

      // connection line
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.8)';
      ctx.lineWidth = 2;
      ctx.moveTo(p.x, p.y - 4);
      ctx.lineTo(p.x, boxY + boxH);
      ctx.stroke();

      // label box
      ctx.fillStyle = 'rgba(6, 10, 14, 0.88)';
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.95)';
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 5);
      ctx.fill();
      ctx.stroke();

      // label text
      ctx.fillStyle = 'rgba(34, 211, 238, 1)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, p.x, boxY + boxH / 2);
    }

    ctx.restore();
  };  

  const drawNavDragOverlay = (ctx: CanvasRenderingContext2D) => {
    if (!navigationEnabled) return;
    const meta = mapMetaRef.current;
    const wh = lastWHRef.current;
    const dp = drawParamsRef.current;
    if (!meta || !wh || !dp) return;

    const d = dragRef.current;
    if (!d.active || !d.startWorld || !d.currWorld) return;

    const toCanvas = (w: { x: number; y: number }) => {
      const gx = (w.x - meta.originX) / meta.resolution;
      const gy = (w.y - meta.originY) / meta.resolution;
      const px = gx;
      const py = (wh.h - 1) - gy;
      return {
        x: dp.offsetX + px * dp.scale,
        y: dp.offsetY + py * dp.scale,
      };
    };

    const s = toCanvas(d.startWorld);
    const c = toCanvas(d.currWorld);

    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = navTool === 'pose' ? 'rgba(0,128,255,0.9)' : 'rgba(0,200,0,0.9)';
    ctx.fillStyle = navTool === 'pose' ? 'rgba(0,128,255,0.9)' : 'rgba(0,200,0,0.9)';

    // line
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();

    // arrow head
    const ang = Math.atan2(c.y - s.y, c.x - s.x);
    const ah = 10;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(c.x - Math.cos(ang - Math.PI / 6) * ah, c.y - Math.sin(ang - Math.PI / 6) * ah);
    ctx.lineTo(c.x - Math.cos(ang + Math.PI / 6) * ah, c.y - Math.sin(ang + Math.PI / 6) * ah);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  };

  const drawToCanvas = () => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    const wh = lastWHRef.current;

    if (!canvas || !wrapper) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(1, rect.width);
    const cssH = Math.max(1, rect.height);

    const dpr = Math.max(1, window.devicePixelRatio || 1);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);    

    // background
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cssW, cssH);

    if (!wh) return;

    const off = offscreenRef.current;
    if (!off) return;

    // Fit with aspect ratio (no stretching)
    const scale = Math.min(cssW / wh.w, cssH / wh.h);
    const drawW = wh.w * scale;
    const drawH = wh.h * scale;
    const offsetX = (cssW - drawW) / 2;
    const offsetY = (cssH - drawH) / 2;

    drawParamsRef.current = { scale, offsetX, offsetY };

    const meta = mapMetaRef.current;
    if (meta) {
      const nextKey = [
        scale,
        offsetX,
        offsetY,
        wh.w,
        wh.h,
        meta.resolution,
        meta.originX,
        meta.originY,
      ].join('|');

      if (nextKey !== lastMapViewKeyRef.current) {
        lastMapViewKeyRef.current = nextKey;
        setMapView({
          scale,
          offsetX,
          offsetY,
          w: wh.w,
          h: wh.h,
          resolution: meta.resolution,
          originX: meta.originX,
          originY: meta.originY,
        });
      }
    }

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, wh.w, wh.h, offsetX, offsetY, drawW, drawH);

    // Do not draw saved location labels on the canvas.
    // They are rendered as HTML overlay boxes to prevent flickering.

    // overlay robot pose
    drawRobotOverlay(ctx);

    // overlay drag arrow when setting pose/goal
    drawNavDragOverlay(ctx);
  };

  // when pose label updates, also ensure we redraw (safe)
  useEffect(() => {
    scheduleDraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [robotPose]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',          /* fill whatever the parent gives — no Tailwind needed */
      minHeight: 0,
      backgroundColor: 'var(--tb-surface)',
      border: '1px solid var(--tb-border)',
      borderRadius: '0.75rem',
      padding: '1rem',
      boxSizing: 'border-box',
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
    }}>
      {/* Title row */}
      {navigationEnabled && savedLocations.length > 0 && (
        <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.6rem', color: 'var(--tb-faint)' }}>
          · places {savedLocations.length}
        </span>
      )}      
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '0.625rem', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '3px', height: '1rem', borderRadius: '9999px', backgroundColor: 'var(--tb-cyan)', flexShrink: 0 }} />
          <span style={{
            fontFamily: 'ui-monospace, monospace', fontSize: '0.65rem',
            letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--tb-muted)',
          }}>
            {navigationEnabled ? 'Navigation Map' : 'SLAM Map'}
          </span>
          {mapInfo && (
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.6rem', color: 'var(--tb-faint)' }}>
              {mapInfo.w}×{mapInfo.h}
            </span>
          )}
          {robotPose && (
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.6rem', color: 'var(--tb-faint)' }}>
              · robot ({robotPose.x.toFixed(2)}, {robotPose.y.toFixed(2)})
            </span>
          )}
        </div>

        {navigationEnabled && (
          <div style={{ display: 'flex', gap: '0.375rem' }}>
            {(['pose', 'goal'] as const).map((tool) => (
              <button
                key={tool}
                type="button"
                onClick={() => setNavTool(tool)}
                className="tb-btn"
                style={{
                  backgroundColor: navTool === tool ? 'var(--tb-cyan)' : 'transparent',
                  color: navTool === tool ? 'var(--tb-bg)' : 'var(--tb-muted)',
                  borderColor: navTool === tool ? 'var(--tb-cyan)' : 'var(--tb-border2)',
                  padding: '0.25rem 0.625rem',
                  fontSize: '0.6rem',
                }}
                title={tool === 'pose' ? 'Publish /initialpose' : 'Publish /goal_pose'}
              >
                {tool === 'pose' ? 'Set Pose' : 'Set Goal'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map canvas wrapper — takes all remaining height */}
      <div
        ref={wrapperRef}
        style={{
          position: 'relative',
          flex: 1,
          minHeight: 0,           /* critical: allows flex child to shrink */
          border: '1px solid var(--tb-border2)',
          borderRadius: '0.5rem',
          backgroundColor: '#ffffff',
          overflow: 'hidden',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {/* Status overlay */}
        {!mapInfo && (
          <div style={{
            position: 'absolute', top: '0.625rem', left: '0.75rem',
            fontFamily: 'ui-monospace, monospace', fontSize: '0.7rem',
            color: 'var(--tb-muted)', pointerEvents: 'none',
          }}>
            Waiting for {topicName}…
          </div>
        )}

        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', touchAction: 'none', display: 'block' }} />
        {navigationEnabled && savedLocationMarkers.map((loc) => (
          <div
            key={loc.name}
            style={{
              position: 'absolute',
              left: loc.x,
              top: loc.y,
              transform: 'translate(-50%, calc(-100% - 10px))',
              pointerEvents: 'none',
              zIndex: 5,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                padding: '0.25rem 0.45rem',
                backgroundColor: 'rgba(6, 10, 14, 0.9)',
                border: '1px solid rgba(34, 211, 238, 0.95)',
                borderRadius: '0.375rem',
                color: 'rgba(34, 211, 238, 1)',
                fontFamily: 'ui-monospace, monospace',
                fontSize: '0.65rem',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                boxShadow: '0 0 8px rgba(34, 211, 238, 0.25)',
              }}
            >
              {loc.name}
            </div>

            <div
              style={{
                width: '2px',
                height: '8px',
                backgroundColor: 'rgba(34, 211, 238, 0.85)',
              }}
            />

            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(34, 211, 238, 0.95)',
                border: '1px solid rgba(6, 10, 14, 0.9)',
              }}
            />
          </div>
        ))}        
      </div>
    </div>
  );
}