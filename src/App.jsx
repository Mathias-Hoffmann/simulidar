import * as React from "react";
import * as XLSX from "xlsx";

// Mini simulation interactive (React + Tailwind)
// VERSION: arcs d'angles PLEINS + rotation de la cible
// - Fond : BLANC quadrillé + option image de fond (taille/position/opacité)
// - Fenêtre de simulation AGRANDIE par défaut (panneau réglages plus étroit)
// - Pas de valeurs collées au schéma (meilleure UX)
// - Arcs colorés remplis pour α, ε, η, β
// - ✅ Variables d'entrée renommées selon votre attente :
//   FLRx, FLRy, FLRz, D1Rx, D1Ry, D1Lx, D1Ly (et rétro-compat: D1c.y / D1c.z si présents)

function deg2rad(d) { return (d * Math.PI) / 180; }
function rad2deg(r) { return (r * 180) / Math.PI; }
function safeNum(v, fallback=0) {
  const n = typeof v === "string" ? Number(v.toString().replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function SliderRow({ label, value, min= -5000, max=5000, step=1, onChange, unit="" }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums">{value} {unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-blue-600"
      />
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full border rounded-md px-2 py-1 text-xs"
      />
    </div>
  );
}

function guessMapping(columns) {
  const by = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const find = (cands) => columns.find((c)=> cands.map(by).includes(by(c)) ) || null;
  return {
    FLRx: find(["FLRx", "FLR_x", "FrontLeftX", "FLX"]),
    FLRy: find(["FLRy", "FLR_y", "FrontLeftY", "FLY"]),
    FLRz: find(["FLRz", "FLR_z", "FrontLeftZ", "FLZ", "D1c.z", "D1Cz", "D1Z"]),
    D1Lx: find(["D1Lx", "D1L.x", "D1LeftX"]),
    D1Ly: find(["D1Ly", "D1L.y", "D1LeftY", "D1c.y", "D1Cy", "D1Y"]),
    D1Rx: find(["D1Rx", "D1R.x", "D1RightX"]),
    D1Ry: find(["D1Ry", "D1R.y", "D1RightY", "D1c.y", "D1Cy", "D1Y"]),
    beta: find(["beta", "symmetry", "symetrie", "β"]),
    alpha: find(["alpha", "drive", "α"]),
    eps: find(["eps", "epsilon", "ε", "eps(zr)"]),
    zeta: find(["zeta", "theta", "ζ", "ζ(xr)", "thetaXR"]),
    piYr: find(["pi", "π", "pi(yr)", "yr"]),
    V: find(["V", "speed", "distance"]),
  };
}

// --- helpers angles/arcs (monde XY ➜ écran SVG) ---
function norm180(a){ let x = ((a + 180) % 360 + 360) % 360 - 180; return x; }
function angleWorldToScreen(a){ return -a; } // Y haut ➜ écran Y bas
function polarPointScreen(cx, cy, r, worldDeg){
  const a = deg2rad(angleWorldToScreen(worldDeg));
  return { x: cx + r*Math.cos(a), y: cy + r*Math.sin(a) };
}
function sectorPath(cx, cy, r0, r1, startWorldDeg, endWorldDeg){
  // Anneau rempli entre r0 et r1, sur l'arc le plus court de start→end (en monde)
  const norm = (ang)=>{ let v = ((ang+180)%360+360)%360-180; return v; };
  const d = norm(endWorldDeg - startWorldDeg);
  const endW = startWorldDeg + d;
  const a0s = angleWorldToScreen(startWorldDeg);
  const a1s = angleWorldToScreen(endW);
  const deltaS = a1s - a0s;
  const largeArc = Math.abs(deltaS) > 180 ? 1 : 0;
  const sweep = deltaS >= 0 ? 1 : 0;
  const a0 = deg2rad(a0s), a1 = deg2rad(a1s);
  const x0 = cx + r1*Math.cos(a0), y0 = cy + r1*Math.sin(a0);
  const x1 = cx + r1*Math.cos(a1), y1 = cy + r1*Math.sin(a1);
  const x2 = cx + r0*Math.cos(a1), y2 = cy + r0*Math.sin(a1);
  const x3 = cx + r0*Math.cos(a0), y3 = cy + r0*Math.sin(a0);
  return `M ${x0} ${y0} A ${r1} ${r1} 0 ${largeArc} ${sweep} ${x1} ${y1} L ${x2} ${y2} A ${r0} ${r0} 0 ${largeArc} ${1-sweep} ${x3} ${y3} Z`;
}

export default function MiniSimulation() {
  const [mode, setMode] = React.useState("manuel"); // "manuel" | "fichier"
  const [control, setControl] = React.useState("angles"); // "angles" | "cible" | "camera"

  const [rows, setRows] = React.useState([]);
  const [columns, setColumns] = React.useState([]);
  const [mapping, setMapping] = React.useState({});
  const [rowIndex, setRowIndex] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const [fps, setFps] = React.useState(4);

  // Entrées principales (selon votre nomenclature)
  const [FLRx, setFLRx] = React.useState(0);
  const [FLRy, setFLRy] = React.useState(0);
  const [FLRz, setFLRz] = React.useState(0);

  const [D1Lx, setD1Lx] = React.useState(-4309.481443);
  const [D1Ly, setD1Ly] = React.useState(0);
  const [D1Rx, setD1Rx] = React.useState(-4296.361317);
  const [D1Ry, setD1Ry] = React.useState(0);

  const [alpha, setAlpha] = React.useState(-21.11);   // α (drive) [°]
  const [eps, setEps] = React.useState(0);            // ε(zr) [°]
  const [zeta, setZeta] = React.useState(90);         // ζ(xr) [°]
  const [beta, setBeta] = React.useState(0);          // β (symétrie) [°]
  const [piYr, setPiYr] = React.useState(0);          // π(yr) [°]
  const [V, setV] = React.useState(1000);             // distance

  // Contrôle direct de la cible (modes cible/camera)
  const [XtM, setXtM] = React.useState(0);
  const [YtM, setYtM] = React.useState(0);
  const [ZtM, setZtM] = React.useState(0);
  const [targetYaw, setTargetYaw] = React.useState(0);

  // Fond image (optionnel)
  const [bgUrl, setBgUrl] = React.useState(null);
  const [showGrid, setShowGrid] = React.useState(true);
  const [bgOpacity, setBgOpacity] = React.useState(0.85);
  const [bgScale, setBgScale] = React.useState(1); // échelle de l'image
  const [bgOffsetX, setBgOffsetX] = React.useState(0);
  const [bgOffsetY, setBgOffsetY] = React.useState(0);

  // Affichage (vue très large)
  const [scale, setScale] = React.useState(0.05);
  const [viewW, setViewW] = React.useState(1700);
  const [viewH, setViewH] = React.useState(1000);

  const svgRef = React.useRef(null);
  const [draggingTarget, setDraggingTarget] = React.useState(false);
  const [draggingCam, setDraggingCam] = React.useState(false);
  const [draggingRotate, setDraggingRotate] = React.useState(false);

  // Import Excel
  function onFile(ev) {
    const file = ev.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: null });
        const cols = json.length ? Object.keys(json[0]) : [];
        setRows(json);
        setColumns(cols);
        setMapping(guessMapping(cols));
        setRowIndex(0);
        setMode("fichier");
      } catch (err) {
        alert("Fichier non lisible: " + err);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // Import Image de fond
  function onBgFile(ev){
    const file = ev.target.files?.[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (e)=> setBgUrl(e.target.result);
    reader.readAsDataURL(file);
  }

  // Défilement auto
  React.useEffect(() => {
    if (!playing || rows.length === 0) return;
    const interval = setInterval(() => {
      setRowIndex((i) => (i + 1) % rows.length);
    }, 1000 / Math.max(1, fps));
    return () => clearInterval(interval);
  }, [playing, rows.length, fps]);

  // Appliquer ligne courante
  React.useEffect(() => {
    if (mode !== "fichier" || rows.length === 0) return;
    const r = rows[Math.max(0, Math.min(rowIndex, rows.length-1))] || {};
    const m = mapping || {};
    setFLRx(safeNum(r[m.FLRx], FLRx));
    setFLRy(safeNum(r[m.FLRy], FLRy));
    setFLRz(safeNum(r[m.FLRz], FLRz));
    setD1Lx(safeNum(r[m.D1Lx], D1Lx));
    setD1Ly(safeNum(r[m.D1Ly], D1Ly));
    setD1Rx(safeNum(r[m.D1Rx], D1Rx));
    setD1Ry(safeNum(r[m.D1Ry], D1Ry));
    setBeta(safeNum(r[m.beta], beta));
    setAlpha(safeNum(r[m.alpha], alpha));
    setEps(safeNum(r[m.eps], eps));
    setZeta(safeNum(r[m.zeta], zeta));
    setPiYr(safeNum(r[m.piYr], piYr));
    setV(safeNum(r[m.V], V));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, rowIndex, rows, mapping]);

  // Intermédiaires géométrie D1c (à partir de D1L et D1R)
  const D1Cx = D1Lx + (D1Rx - D1Lx)/2;               // D1c.x
  const D1Cy = D1Ly + (D1Ry - D1Ly)/2;               // D1c.y

  const betaRad = deg2rad(beta);
  const cosb = Math.cos(betaRad), sinb = Math.sin(betaRad);

  // Position SLR.FL (base caméra) dans le plan XY
  const SLR_FL_X = D1Cx + (FLRx * cosb - FLRy * sinb);
  const SLR_FL_Y = D1Cy + (FLRx * sinb + FLRy * cosb);
  const SLR_FL_Z = FLRz;                              // Z issu de FLRz

  // Intermédiaires
  const B = Math.hypot(FLRx, FLRy);
  const delta1 = rad2deg(Math.atan2(FLRy, FLRx));     // Δ'
  const delta2 = delta1 + beta;                        // Δ''

  const eta = eps - alpha;                             // η = ε − α
  const etaRad = deg2rad(eta);
  const thetaRad = deg2rad(zeta);

  // Position cible
  let Xt, Yt, Zt;
  if (control === "angles") {
    Xt = SLR_FL_X + Math.cos(etaRad) * Math.sin(thetaRad) * V;
    Yt = SLR_FL_Y + Math.sin(etaRad) * Math.sin(thetaRad) * V;
    Zt = SLR_FL_Z + Math.cos(thetaRad) * V;
  } else {
    Xt = XtM; Yt = YtM; Zt = ZtM;
  }

  // Angles courants
  const dx = Xt - SLR_FL_X, dy = Yt - SLR_FL_Y, dz = Zt - SLR_FL_Z;
  const rxy = Math.hypot(dx, dy);
  const V_now = Math.hypot(rxy, dz);
  const eta_now = rad2deg(Math.atan2(dy, dx)); // = ε − α
  const zeta_now = rad2deg(Math.atan2(rxy, dz));
  const eps_now = eta_now + alpha;

  React.useEffect(() => {
    if (control === "angles") return;
    setV(V_now);
    setZeta(zeta_now);
    setEps(eps_now);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [control, Xt, Yt, Zt, SLR_FL_X, SLR_FL_Y, SLR_FL_Z, alpha]);

  React.useEffect(() => {
    if (control === "cible" || control === "camera") {
      setXtM(Xt); setYtM(Yt); setZtM(Zt);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [control]);

  // ⚙️ Petits tests/garanties (console)
  React.useEffect(() => {
    const tol = 1e-6;
    const epsUsed = (control !== "angles" ? eps_now : eps);
    const etaExpect = epsUsed - alpha;
    console.assert(Math.abs(norm180(eta_now - etaExpect)) < 1e-6, "[TEST] η mismatch: η_now vs (ε-α)");
    const VExpect = (control !== "angles" ? V_now : V);
    const VDirect = Math.hypot(Xt - SLR_FL_X, Yt - SLR_FL_Y, Zt - SLR_FL_Z);
    console.assert(Math.abs(VDirect - VExpect) < tol, "[TEST] V mismatch: ||base→cible|| vs V");
  }, [control, eps, eps_now, alpha, eta_now, V, V_now, Xt, Yt, Zt, SLR_FL_X, SLR_FL_Y, SLR_FL_Z]);

  // Projection simple (XY)
  const sx = viewW/2 + Xt * scale;
  const sy = viewH/2 - Yt * scale;

  // Taille visuelle cible
  const targetPxW = 90;
  const targetPxH = 16;

  // Conversion écran→monde
  function screenToWorld(clientX, clientY) {
    const svg = svgRef.current;
    if (!svg) return { x: Xt, y: Yt };
    const rect = svg.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const wx = (px - viewW/2) / scale;
    const wy = -(py - viewH/2) / scale;
    return { x: wx, y: wy };
  }

  // Drags
  function onPointerDownTarget(e) {
    if (!(control === "cible" || control === "camera")) return;
    setDraggingTarget(true);
    if (e.currentTarget && e.currentTarget.setPointerCapture) {
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    }
    const p = screenToWorld(e.clientX, e.clientY);
    setXtM(p.x); setYtM(p.y);
  }
  function onPointerDownCam(e) {
    if (control !== "camera") return;
    setDraggingCam(true);
    if (e && e.currentTarget && e.currentTarget.setPointerCapture) {
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    }
  }
  function onPointerDownRotate(e){
    e.stopPropagation();
    setDraggingRotate(true);
    if (e.currentTarget && e.currentTarget.setPointerCapture) {
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    }
  }

  function onPointerMove(e) {
    const p = screenToWorld(e.clientX, e.clientY);
    if (draggingTarget && (control === "cible" || control === "camera")) {
      setXtM(p.x); setYtM(p.y);
    }
    if (draggingCam && control === "camera") {
      const dx = p.x - D1Cx; const dy = p.y - D1Cy;
      const FLRx_new = dx * cosb + dy * sinb;
      const FLRy_new = -dx * sinb + dy * cosb;
      setFLRx(FLRx_new); setFLRy(FLRy_new);
    }
    if (draggingRotate) {
      const cx = Xt; const cy = Yt;
      const vx = p.x - cx; const vy = p.y - cy;
      const pointerAngleW = rad2deg(Math.atan2(vy, vx));
      const baseRectW = (eta_now + 90);
      const yaw = norm180(pointerAngleW - baseRectW);
      setTargetYaw(yaw);
    }
  }
  function onPointerUp() { setDraggingTarget(false); setDraggingCam(false); setDraggingRotate(false); }

  // Affichages auxiliaires
  const azimuth = eta_now;
  const elevation = rad2deg(Math.atan2(dz, rxy));
  const screenAngle = -azimuth;
  const rectAngle = screenAngle + 90 + targetYaw;

  const camScreenX = viewW/2 + SLR_FL_X*scale;
  const camScreenY = viewH/2 - SLR_FL_Y*scale;

  // Sorties (Xt, Yt, Zt) + utilitaires
  const [copied, setCopied] = React.useState(false);
  function copyOutputs(){
    const text = `Xt=${Xt.toFixed(3)}, Yt=${Yt.toFixed(3)}, Zt=${Zt.toFixed(3)}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(()=>{ setCopied(true); setTimeout(()=>setCopied(false), 1200); })
        .catch(()=>{});
    }
  }
  function exportOutputs(){
    try {
      const row = [{
        FLRx, FLRy, FLRz, D1Lx, D1Ly, D1Rx, D1Ry,
        alpha, beta, eps: (control!=="angles"?eps_now:eps), zeta: (control!=="angles"?zeta_now:zeta), V: (control!=="angles"?V_now:V),
        Xt, Yt, Zt
      }];
      const ws = XLSX.utils.json_to_sheet(row);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sorties");
      XLSX.writeFile(wb, "Sorties_XYZ.xlsx");
    } catch(e){
      console.error(e);
      alert("Export échoué: "+e);
    }
  }

  // Styles des arcs
  const epsDisp = (control!=="angles"?eps_now:eps);
  const Rarc = 110;
  const RarcInner = Rarc - 16; // anneau rempli (η)
  const Rbeta = 60;
  const RbetaInner = Rbeta - 12;

  return (
    <div className="w-full min-h-screen bg-slate-100 py-4">
      <div className="max-w-[2200px] mx-auto px-4">
        <h1 className="text-2xl font-semibold mb-3">Prototype Mini simulation Cible & Caméra</h1>
        <p className="text-sm text-slate-600 mb-4">Le point vert correspond à la caméra ou le capteur et le rectangle jaune désigne la cible</p>

        <div className="flex gap-4 items-start">
          {/* Panneau de contrôle (compact) */}
          <div className="bg-white rounded-2xl shadow p-4 space-y-3 w-[340px] shrink-0 text-xs">
            

            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span>Contrôle :</span>
              <button className={`px-3 py-1.5 rounded-xl text-xs shadow ${control==="angles"?"bg-slate-900 text-white":"bg-slate-100"}`} onClick={()=>setControl("angles")}>Angles</button>
              <button className={`px-3 py-1.5 rounded-xl text-xs shadow ${control==="cible"?"bg-slate-900 text-white":"bg-slate-100"}`} onClick={()=>setControl("cible")}>Cible</button>
              <button className={`px-3 py-1.5 rounded-xl text-xs shadow ${control==="camera"?"bg-slate-900 text-white":"bg-slate-100"}`} onClick={()=>setControl("camera")}>Caméra</button>
            </div>

            {/* Import fichier */}
            <div className="space-y-2">
              <label className="flex flex-col">
                <span className="mb-1 font-medium">Charger CLCT.xlsx</span>
                <input type="file" accept=".xlsx,.xls" onChange={onFile} className="border rounded-md px-2 py-1" />
              </label>
              {rows.length>0 && (
                <div className="text-[11px] text-slate-600">{rows.length} lignes chargées · Colonnes: {columns.join(", ")}</div>
              )}
            </div>

            {/* Image de fond */}
            <div className="space-y-2">
              <label className="flex items-center justify-between gap-2">
                <span className="font-medium">Quadrillage</span>
                <input type="checkbox" checked={showGrid} onChange={(e)=>setShowGrid(e.target.checked)} />
              </label>
              <label className="flex flex-col">
                <span className="mb-1 font-medium">Image de fond (PNG/JPG)</span>
                <input type="file" accept="image/*" onChange={onBgFile} className="border rounded-md px-2 py-1" />
              </label>
              {bgUrl && (
                <div className="grid grid-cols-2 gap-2">
                  <SliderRow label="Opacité" value={bgOpacity} onChange={setBgOpacity} min={0} max={1} step={0.01} />
                  <SliderRow label="Échelle" value={bgScale} onChange={setBgScale} min={0.1} max={5} step={0.01} />
                  <SliderRow label="Décalage X (px)" value={bgOffsetX} onChange={setBgOffsetX} min={-2000} max={2000} step={1} />
                  <SliderRow label="Décalage Y (px)" value={bgOffsetY} onChange={setBgOffsetY} min={-2000} max={2000} step={1} />
                </div>
              )}
            </div>

            {mode === "fichier" && rows.length>0 && (
              <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <button className={`px-3 py-1.5 rounded-xl text-xs shadow ${playing?"bg-rose-600 text-white":"bg-emerald-600 text-white"}`} onClick={()=>setPlaying((p)=>!p)}>
                    {playing?"Pause":"Lecture"}
                  </button>
                  <div className="flex items-center gap-2">
                    <span>Vitesse:</span>
                    <input type="number" className="border rounded px-2 py-1 w-20" value={fps} onChange={(e)=>setFps(safeNum(e.target.value,4))} />
                    <span className="text-[10px] text-slate-500">images/s</span>
                  </div>
                </div>
                <div>
                  <input type="range" min={0} max={rows.length-1} step={1} value={rowIndex} onChange={(e)=>setRowIndex(Number(e.target.value))} className="w-full accent-blue-600" />
                  <div className="flex justify-between text-[10px] mt-1">
                    <span>0</span>
                    <span className="tabular-nums">{rowIndex}</span>
                    <span>{rows.length-1}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Paramètres manuels (nomenclature FLR*/}
            <div className="grid grid-cols-2 gap-2">
              <SliderRow label="FLRx" value={FLRx} onChange={setFLRx} min={-5000} max={5000} step={1} />
              <SliderRow label="FLRy" value={FLRy} onChange={setFLRy} min={-5000} max={5000} step={1} />
              <SliderRow label="FLRz" value={FLRz} onChange={setFLRz} min={-5000} max={5000} step={1} />

              <SliderRow label="D1Lx" value={D1Lx} onChange={setD1Lx} min={-10000} max={10000} step={0.001} />
              <SliderRow label="D1Ly" value={D1Ly} onChange={setD1Ly} min={-10000} max={10000} step={0.001} />
              <SliderRow label="D1Rx" value={D1Rx} onChange={setD1Rx} min={-10000} max={10000} step={0.001} />
              <SliderRow label="D1Ry" value={D1Ry} onChange={setD1Ry} min={-10000} max={10000} step={0.001} />

              <SliderRow label="β (sym) [°]" value={beta} onChange={setBeta} min={-180} max={180} step={0.01} />
              <SliderRow label="α drive [°]" value={alpha} onChange={setAlpha} min={-180} max={180} step={0.01} />
              <SliderRow label="ε(zr) [°]" value={eps} onChange={(v)=>{ setEps(v); if(control!=="angles"){ setControl("angles"); }}} min={-180} max={180} step={0.01} />
              <SliderRow label="ζ(xr) [°]" value={zeta} onChange={(v)=>{ setZeta(v); if(control!=="angles"){ setControl("angles"); }}} min={0} max={180} step={0.01} />
              <SliderRow label="π(yr) [°]" value={piYr} onChange={setPiYr} min={-180} max={180} step={0.01} />
              <SliderRow label="V" value={V} onChange={(v)=>{ setV(v); if(control!=="angles"){ setControl("angles"); }}} min={0} max={5000} step={1} />
              <SliderRow label="Échelle dessin" value={scale} onChange={setScale} min={0.001} max={0.5} step={0.001} />
            </div>

            {/* Intermédiaires */}
            <div className="grid grid-cols-1 gap-2 text-[11px] mt-1">
              <div className="bg-slate-50 rounded-xl p-2">
                <div>D1c = (<span className="tabular-nums">{D1Cx.toFixed(6)}</span>, <span className="tabular-nums">{D1Cy.toFixed(6)}</span>) · B = <span className="tabular-nums">{B.toFixed(3)}</span></div>
                <div>Δ' = <span className="tabular-nums">{delta1.toFixed(3)}</span>° · Δ'' = <span className="tabular-nums">{delta2.toFixed(3)}</span>°</div>
                <div>η = ε − α = <span className="tabular-nums">{(eta_now).toFixed(3)}</span>°</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-2">
                <div>SLR.FL = (<span className="tabular-nums">{SLR_FL_X.toFixed(3)}</span>, <span className="tabular-nums">{SLR_FL_Y.toFixed(3)}</span>, <span className="tabular-nums">{SLR_FL_Z.toFixed(3)}</span>)</div>
              </div>
              <div className="bg-indigo-50 rounded-xl p-2">
                <div>α=<span className="tabular-nums">{alpha.toFixed(2)}</span>° · β=<span className="tabular-nums">{beta.toFixed(2)}</span>° · ε=<span className="tabular-nums">{(control!=="angles"?eps_now:eps).toFixed(2)}</span>° · ζ=<span className="tabular-nums">{(control!=="angles"?zeta_now:zeta).toFixed(2)}</span>° · V=<span className="tabular-nums">{(control!=="angles"?V_now:V).toFixed(1)}</span></div>
              </div>
            </div>

            {/* Sorties (Xt, Yt, Zt) */}
            <div className="bg-amber-50 rounded-xl p-3 text-[11px] flex flex-col gap-2">
              <div className="font-medium text-amber-900">Sorties (monde):</div>
              <div className="grid grid-cols-3 gap-2">
                <div>Xt = <span className="tabular-nums font-mono">{Xt.toFixed(3)}</span></div>
                <div>Yt = <span className="tabular-nums font-mono">{Yt.toFixed(3)}</span></div>
                <div>Zt = <span className="tabular-nums font-mono">{Zt.toFixed(3)}</span></div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={copyOutputs} className="px-3 py-1.5 rounded-xl bg-amber-600 text-white text-xs shadow">Copier</button>
                <button onClick={exportOutputs} className="px-3 py-1.5 rounded-xl bg-amber-700 text-white text-xs shadow">Exporter (.xlsx)</button>
                {copied && <span className="text-emerald-700 text-[10px]">Copié ✓</span>}
              </div>
            </div>

            {/* Réinit + Vue */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <button
                className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs shadow"
                onClick={() => {
                  setFLRx(0); setFLRy(0); setFLRz(0);
                  setD1Lx(-4309.481443); setD1Ly(0); setD1Rx(-4296.361317); setD1Ry(0);
                  setBeta(0); setAlpha(-21.11); setEps(0); setZeta(90); setPiYr(0);
                  setV(1000); setScale(0.05);
                  setViewW(1700); setViewH(1000);
                  setControl('angles'); setXtM(0); setYtM(0); setZtM(0); setTargetYaw(0);
                  setBgUrl(null); setBgOpacity(0.85); setBgScale(1); setBgOffsetX(0); setBgOffsetY(0); setShowGrid(true);
                }}
              >Réinitialiser</button>
              <div className="flex items-center gap-2 ml-auto">
                <select className="border rounded px-2 py-1 text-xs" defaultValue="" onChange={(e)=>{ const v=e.target.value; if(!v) return; const [w,h]=v.split('x').map((n)=>parseInt(n,10)); if(Number.isFinite(w)&&Number.isFinite(h)){ setViewW(w); setViewH(h);} }}>
                  <option value="">Préréglages</option>
                  <option value="1280x720">1280×720</option>
                  <option value="1600x900">1600×900</option>
                  <option value="1700x1000">1700×1000</option>
                  <option value="1920x1080">1920×1080</option>
                  <option value="2160x1200">2160×1200</option>
                </select>
                <label className="flex items-center gap-1">W
                  <input type="number" value={viewW} onChange={(e)=>setViewW(safeNum(e.target.value, viewW))} className="w-20 border rounded px-2 py-1 text-xs" />
                </label>
                <label className="flex items-center gap-1">H
                  <input type="number" value={viewH} onChange={(e)=>setViewH(safeNum(e.target.value, viewH))} className="w-20 border rounded px-2 py-1 text-xs" />
                </label>
              </div>
            </div>
          </div>

          {/* Zone de visualisation (immense) */}
          <div className="bg-white rounded-2xl shadow overflow-hidden flex-1">
            <div
              className="relative bg-white"
              style={{ width: viewW + 'px', height: viewH + 'px' }}
            >
              <svg ref={svgRef} width={viewW} height={viewH} className="absolute inset-0"
                   onPointerMove={onPointerMove}
                   onPointerUp={onPointerUp}
                   onPointerCancel={onPointerUp}
                   onPointerLeave={onPointerUp}
              >
                {/* Image de fond (optionnelle) */}
                {bgUrl && (
                  <g transform={`translate(${bgOffsetX},${bgOffsetY}) scale(${bgScale})`} opacity={bgOpacity}>
                    <image href={bgUrl} x={0} y={0} width={viewW} height={viewH} preserveAspectRatio="xMidYMid meet" />
                  </g>
                )}

                {/* Quadrillage */}
                {showGrid && (
                  <>
                    <defs>
                      <pattern id="grid" width={50} height={50} patternUnits="userSpaceOnUse">
                        <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="1"/>
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                  </>
                )}

                {/* Axes */}
                <line x1={viewW/2} y1="0" x2={viewW/2} y2={viewH} stroke="rgba(30,30,30,0.35)" strokeWidth="1.5"/>
                <line x1="0" y1={viewH/2} x2={viewW} y2={viewH/2} stroke="rgba(30,30,30,0.35)" strokeWidth="1.5"/>

                {/* Légende (sans valeurs) */}
                <g transform={`translate(${12}, ${12})`} pointerEvents="none">
                  <rect x="0" y="0" width={220} height={64} rx={10} fill="rgba(255,255,255,0.9)" />
                  <g transform="translate(10,16)"><rect width="12" height="12" rx="2" fill="#6366f1" /><text x="18" y="11" fontSize="12" fill="#111827">α (drive)</text></g>
                  <g transform="translate(10,36)"><rect width="12" height="12" rx="2" fill="#0284c7" /><text x="18" y="11" fontSize="12" fill="#111827">ε (zr)</text></g>
                  <g transform="translate(110,16)"><rect width="12" height="12" rx="2" fill="rgba(245,158,11,0.75)" /><text x="18" y="11" fontSize="12" fill="#111827">η = ε−α</text></g>
                  <g transform="translate(110,36)"><rect width="12" height="12" rx="2" fill="rgba(51,65,85,0.6)" /><text x="18" y="11" fontSize="12" fill="#111827">β (sym)</text></g>
                </g>

                {/* Base SLR.FL / Caméra */}
                {(() => {
                  const cx = camScreenX, cy = camScreenY;
                  const pAlpha = polarPointScreen(cx, cy, Rarc+14, alpha);
                  const pEps   = polarPointScreen(cx, cy, Rarc+14, epsDisp);
                  return (
                    <g>
                      {/* secteur η rempli */}
                      <path d={sectorPath(cx, cy, RarcInner, Rarc, alpha, epsDisp)} fill="rgba(245,158,11,0.35)" stroke="rgba(245,158,11,0.9)" strokeWidth={2} />
                      {/* rayon α */}
                      <line x1={cx} y1={cy} x2={pAlpha.x} y2={pAlpha.y} stroke="#6366f1" strokeWidth={3} />
                      {/* rayon ε */}
                      <line x1={cx} y1={cy} x2={pEps.x} y2={pEps.y} stroke="#0284c7" strokeWidth={3} />
                      {/* point caméra */}
                      <circle cx={cx} cy={cy} r={7} fill="rgba(16,185,129,0.95)"
                              style={{ cursor: control==="camera" ? (draggingCam?"grabbing":"grab") : "default" }}
                              onPointerDown={onPointerDownCam}
                      />
                    </g>
                  );
                })()}

                {/* Vecteur base→cible */}
                <line x1={camScreenX} y1={camScreenY} x2={sx} y2={sy} stroke="rgba(2,132,199,0.7)" strokeWidth="2" />

                {/* Arc β autour de D1c */}
                {(() => {
                  const d1cX = viewW/2 + D1Cx*scale;
                  const d1cY = viewH/2 - D1Cy*scale;
                  const pB = polarPointScreen(d1cX, d1cY, Rbeta+8, beta);
                  return (
                    <g>
                      <line x1={d1cX} y1={d1cY} x2={d1cX + Rbeta + 14} y2={d1cY} stroke="rgba(30,41,59,0.6)" strokeWidth={1.5} />
                      <path d={sectorPath(d1cX, d1cY, RbetaInner, Rbeta, 0, beta)} fill="rgba(51,65,85,0.25)" stroke="rgba(51,65,85,0.9)" strokeWidth={2} />
                      <line x1={d1cX} y1={d1cY} x2={pB.x} y2={pB.y} stroke="rgba(30,41,59,0.9)" strokeWidth={2} />
                    </g>
                  );
                })()}

                {/* Cible */}
                <g transform={`translate(${sx},${sy}) rotate(${rectAngle})`}>
                  <rect x={-targetPxW/2} y={-targetPxH/2} width={targetPxW} height={targetPxH}
                        fill="#facc15" stroke="none"
                        onPointerDown={onPointerDownTarget}
                        style={{ cursor: (control==="cible"||control==="camera") ? (draggingTarget?"grabbing":"grab") : "default" }}
                  />
                  <line x1={0} y1={-targetPxH/2} x2={0} y2={-(targetPxH/2+18)} stroke="rgba(0,0,0,0.5)" strokeWidth="2" />
                  <circle cx={0} cy={-(targetPxH/2+26)} r={6} fill="white" stroke="rgba(0,0,0,0.7)" strokeWidth="2"
                          onPointerDown={onPointerDownRotate}
                          style={{ cursor: "grab" }}
                  />
                </g>
              </svg>
            </div>
            <div className="p-3 text-[11px] text-slate-600 flex flex-col sm:flex-row sm:justify-between gap-2">
              <div>Plan : XY (Y vers le haut) – Z base via « FLRz ».</div>
              <div>Échelle : <span className="tabular-nums">{scale}</span> px/unité</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
