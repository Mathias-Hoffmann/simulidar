import * as React from "react";
<<<<<<< HEAD
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
=======

/***** ----------------------------------------------------------
 * Simulation 3D — UX clean (sans Tailwind)
 * - Panneau paramètres à GAUCHE (propre, scrollable)
 * - Fenêtre de simulation à DROITE (s'adapte à la place)
 * - Splitter redimensionnable (barre verticale)
 * - Boîte 3D + Rectangle cible + Caméra/Base
 * - Drag XY, ALT+Drag = Z, poignées Yaw/Pitch/Roll
 *
 * MàJ :
 * - computeRay corrigé en repère sphérique classique :
 *     x = cos(η) * sin(θ) * V
 *     y = sin(η) * sin(θ) * V
 *     z = cos(θ) * V
 * - α (drive) saisi en minutes d'arc (′) et converti en degrés via /60.
 * - Cartouche "Angles (sortie)" qui recalcule η, θ, élévation et ε tel que η = ε - α.
 * - Correction des erreurs JSX (balises et commentaires correctement fermés).
 * - Tests étendus dans SelfTests.
 * ----------------------------------------------------------- */

function deg2rad(d){ return (d*Math.PI)/180; }
function rad2deg(r){ return (r*180)/Math.PI; }
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

// --------- UI tokens (styles centralisés) ---------------------------------
const UI = {
  appBg: "#f1f5f9",
  text: "#0f172a",
  subtext: "#475569",
  cardBg: "#ffffff",
  border: "#e5e7eb",
  blue: "#2563eb",
  blueLite: "#60a5fa",
  amber: "#f59e0b",
  green: "#10b981",
  red: "#ef4444",
  shadow: "0 10px 30px rgba(15,23,42,.08), 0 2px 8px rgba(15,23,42,.06)",
  radius: 14,
};

const S = {
  app: { width:"100%", minHeight:"100vh", background:UI.appBg, color:UI.text, padding:"24px 16px" },
  container: { maxWidth: 2200, margin:"0 auto" },
  title: { fontSize:22, fontWeight:600, margin:"0 0 6px" },
  subtitle: { fontSize:13, color:UI.subtext, margin:"0 0 16px" },

  splitWrap:{
    display:"flex", width:"100%", height:"calc(100vh - 140px)", minHeight:560,
    borderRadius:UI.radius, overflow:"hidden", background:"#fff", boxShadow:UI.shadow,
  },
  left:{
    width: 380, height:"100%", overflowY:"auto", borderRight:`1px solid ${UI.border}`, background:"#fff"
  },
  splitter:{
    width: 10, background:"#e5e7eb", cursor:"col-resize", transition:"background .15s",
  },
  right:{ flex:1, height:"100%", position:"relative", overflow:"hidden", background:"#fff" },
  pad:{ padding:16 },

  hGroup:{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap", marginBottom:8 },
  badge:{ fontSize:12, color:UI.subtext },
  segBtn:(active)=>({
    padding:"6px 10px", borderRadius:8, border:`1px solid ${active?UI.blue:UI.border}`,
    background: active ? "#eef2ff" : "#fff", color: active ? UI.blue : UI.text, fontSize:12, cursor:"pointer"
  }),

  card:{ background:UI.cardBg, border:`1px solid ${UI.border}`, borderRadius:12, padding:12, marginBottom:12 },
  sectionTitle:{ fontWeight:600, fontSize:12, marginBottom:8 },
  grid2:{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 },

  sliderRow:{ display:"flex", flexDirection:"column", gap:6 },
  sliderHeader:{ display:"flex", justifyContent:"space-between", fontSize:12 },
  number:{ width:"100%", border:`1px solid ${UI.border}`, borderRadius:8, padding:"6px 8px", fontSize:12 },
  range:{ width:"100%" },

  help:{
    position:"absolute", left:12, right:12, bottom:12, fontSize:11, color:UI.subtext,
    background:"rgba(255,255,255,.85)", padding:"10px 12px", borderRadius:10, boxShadow:"0 2px 10px rgba(0,0,0,.08)"
  },

  resetBtn:{
    padding:"10px 14px", borderRadius:10, border:`1px solid ${UI.border}`, background:"#111827", color:"#fff",
    fontSize:12, cursor:"pointer", boxShadow:"0 6px 14px rgba(17,24,39,.15)"
  }
};

// --------- UI small components --------------------------------------------
function SliderRow({ label, value, min=-5000, max=5000, step=1, onChange, unit='' }){
  const toFixed = (v)=>Number(v).toFixed(typeof step==='number'&&step<1?3:0);
  return (
    <div style={S.sliderRow}>
      <div style={S.sliderHeader}>
        <span style={{fontWeight:500}}>{label}</span>
        <span style={{fontVariantNumeric:"tabular-nums"}}>{toFixed(value)} {unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
             onChange={(e)=>onChange(parseFloat(e.target.value))} style={S.range}/>
      <input type="number" value={value} onChange={(e)=>onChange(parseFloat(e.target.value))} style={S.number}/>
>>>>>>> 6bbee61 (Ajout de la simulation 3D commentée)
    </div>
  );
}

<<<<<<< HEAD
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
=======
function Section({ title, children, defaultOpen=true }){
  const [open,setOpen]=React.useState(defaultOpen);
  return (
    <div style={S.card}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer"}} onClick={()=>setOpen(!open)}>
        <div style={S.sectionTitle}>{title}</div>
        <div style={{fontSize:18, color:UI.subtext}}>{open?"▾":"▸"}</div>
      </div>
      {open && <div style={{marginTop:10}}>{children}</div>}
    </div>
  );
}

function SegButton({active, onClick, children}){ return <button style={S.segBtn(active)} onClick={onClick}>{children}</button>; }

// --------- Math utils ------------------------------------------------------
function vec(a){ return [a[0],a[1],a[2]]; }
function add(a,b){ return [a[0]+b[0], a[1]+b[1], a[2]+b[2]]; }
function sub(a,b){ return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
function dot(a,b){ return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
function cross(a,b){ return [ a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0] ]; }
function len(a){ return Math.hypot(a[0],a[1],a[2]); }
function norm(a){ const L=len(a)||1; return [a[0]/L, a[1]/L, a[2]/L]; }
function mulScalar(a,s){ return [a[0]*s,a[1]*s,a[2]*s]; }

function Rz(a){ const c=Math.cos(a), s=Math.sin(a); return [[c,-s,0],[s,c,0],[0,0,1]]; }
function Rx(a){ const c=Math.cos(a), s=Math.sin(a); return [[1,0,0],[0,c,-s],[0,s,c]]; }
function Ry(a){ const c=Math.cos(a), s=Math.sin(a); return [[c,0,s],[0,1,0],[-s,0,c]]; }
function mulMat3(m,n){
  const r=[[0,0,0],[0,0,0],[0,0,0]];
  for(let i=0;i<3;i++) for(let j=0;j<3;j++) r[i][j]=m[i][0]*n[0][j]+m[i][1]*n[1][j]+m[i][2]*n[2][j];
  return r;
}
function mulMat3Vec3(m,v){ return [m[0][0]*v[0]+m[0][1]*v[1]+m[0][2]*v[2], m[1][0]*v[0]+m[1][1]*v[1]+m[1][2]*v[2], m[2][0]*v[0]+m[2][1]*v[1]+m[2][2]*v[2]]; }

// --------- Camera & projection --------------------------------------------
function cameraBasis(eye, target=[0,0,0], up=[0,0,1]){
  const f = norm(sub(target, eye));
  const r = norm(cross(f, up));
  const u = cross(r, f);
  return { r,u,f };
}
function worldToCamera(p, eye, target=[0,0,0], up=[0,0,1]){
  const {r,u,f} = cameraBasis(eye,target,up);
  const pe = sub(p, eye);
  return [dot(pe,r), dot(pe,u), dot(pe,f)];
}
function projectPoint(pWorld, cam, viewport){
  const { eye, target, up, fov, aspect, near } = cam;
  const pc = worldToCamera(pWorld, eye, target, up);
  const z = pc[2];
  if (z <= near) return { visible:false };
  const f = 1 / Math.tan(0.5*fov);
  const x_ndc = (pc[0] * f) / (z * aspect);
  const y_ndc = (pc[1] * f) / (z);
  const sx = (x_ndc + 1) * 0.5 * viewport.w;
  const sy = (1 - y_ndc) * 0.5 * viewport.h;
  return { x:sx, y:sy, z, visible:true, scale: f/z };
}
function screenToRay(px,py, cam, vp){
  const x_ndc = (px / vp.w)*2 - 1;
  const y_ndc = 1 - (py / vp.h)*2;
  const f = 1/Math.tan(0.5*cam.fov);
  const dirCam = norm([ (x_ndc*cam.aspect)/f, y_ndc/f, 1 ]);
  const { r,u,f:fw } = cameraBasis(cam.eye, cam.target, cam.up);
  const dirWorld = norm([ r[0]*dirCam[0] + u[0]*dirCam[1] + fw[0]*dirCam[2],
                          r[1]*dirCam[0] + u[1]*dirCam[1] + fw[1]*dirCam[2],
                          r[2]*dirCam[0] + u[2]*dirCam[1] + fw[2]*dirCam[2] ]);
  return { origin: vec(cam.eye), dir: dirWorld };
}
function intersectRayPlaneZ(origin,dir,planeZ){
  const denom = dir[2]; if (Math.abs(denom) < 1e-8) return null;
  const t = (planeZ - origin[2]) / denom; if (t<=0) return null;
  return add(origin, mulScalar(dir, t));
}

// --------- Scene primitives ------------------------------------------------
function Segment({ a, b, cam, vp, stroke="#94a3b8", width=1, dash }){
  const pa = projectPoint(a, cam, vp), pb = projectPoint(b, cam, vp);
  if(!pa.visible || !pb.visible) return null;
  return <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} stroke={stroke} strokeWidth={width} strokeDasharray={dash}/>;
}

function boxVerticesWorld(center, box){
  const { x,y,z } = center;
  const { sx, sy, sz, yaw, pitch, roll } = box;
  const R = mulMat3( mulMat3(Rz(yaw), Rx(pitch)), Ry(roll) );
  const hx=sx/2, hy=sy/2, hz=sz/2;
  const locals = [
    [ +hx, +hy, +hz ], [ -hx, +hy, +hz ], [ -hx, -hy, +hz ], [ +hx, -hy, +hz ],
    [ +hx, +hy, -hz ], [ -hx, +hy, -hz ], [ -hx, -hy, -hz ], [ +hx, -hy, -hz ],
  ];
  return locals.map(v=> add([x,y,z], mulMat3Vec3(R, v)) );
}
const BOX_FACES = [
  [0,1,2,3], [7,6,5,4], [0,3,7,4], [1,5,6,2], [0,4,5,1], [3,2,6,7],
];

function SceneSVG({
  width, height,
  orbit, setOrbit,
  base, target, rect, box,
  interaction,
  onDragBase, onDragTarget, onRotateTarget,
  onDragBox, onRotateBox,
}){
  const vp = { w: width, h: height };
  const { yaw, pitch, radius } = orbit;
  const eye = React.useMemo(()=>{
    const cy=Math.cos(yaw), sy=Math.sin(yaw);
    const cp=Math.cos(pitch), sp=Math.sin(pitch);
    return [ radius*cp*cy, radius*cp*sy, radius*sp ];
  },[yaw,pitch,radius]);
  const cam = React.useMemo(()=>({ eye, target:[0,0,0], up:[0,0,1], fov:deg2rad(50), aspect:width/height, near:1 }),[eye,width,height]);

  const svgRef = React.useRef(null);
  const dragRef = React.useRef({ type:null, lastY:0, lastAngle:0 });

  function rectCornersWorld(center, rect){
    const { x,y,z } = center; const { w,h, yaw, pitch, roll } = rect;
    const R = mulMat3( mulMat3(Rz(yaw), Rx(pitch)), Ry(roll) );
    const hx=w/2, hy=h/2;
    const locals = [ [ hx, hy,0], [-hx, hy,0], [-hx,-hy,0], [ hx,-hy,0] ];
    return locals.map(v=> add([x,y,z], mulMat3Vec3(R, v)) );
  }

  const pBase = projectPoint([base.x,base.y,base.z], cam, vp);
  const pTarg = projectPoint([target.x,target.y,target.z], cam, vp);

  const corners = rectCornersWorld(target, rect);
  const pc = corners.map(c=>projectPoint(c,cam,vp));
  const rectAllVisible = pc.every(p=>p.visible);

  const boxVertsW = boxVerticesWorld(box.center, box.geom);
  const boxProj = boxVertsW.map(v=>projectPoint(v,cam,vp));
  const pBox = projectPoint([box.center.x,box.center.y,box.center.z], cam, vp);
  const boxBounds = React.useMemo(()=>{
    const xs = boxProj.filter(p=>p.visible).map(p=>p.x);
    const ys = boxProj.filter(p=>p.visible).map(p=>p.y);
    if(xs.length===0) return null;
    return { minx:Math.min(...xs), maxx:Math.max(...xs), miny:Math.min(...ys), maxy:Math.max(...ys) };
  },[boxProj]);

  React.useEffect(()=>{
    const el = svgRef.current; if(!el) return;
    const onDown = (e)=>{
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left; const y = e.clientY - r.top;
      dragRef.current.lastY = y;

      const wantRotate = (interaction==='rotateTarget' || interaction==='free');
      const wantMoveBase = (interaction==='moveBase' || interaction==='free');
      const wantMoveTarget = (interaction==='moveTarget' || interaction==='free');
      const wantOrbit = (interaction==='orbit' || interaction==='free');
      const wantMoveBox = (interaction==='moveBox' || interaction==='free');
      const wantRotateBox = (interaction==='rotateBox' || interaction==='free');

      if (wantRotate && pTarg.visible){
        const dx = x - pTarg.x, dy = y - pTarg.y;
        const dist = Math.hypot(dx,dy);
        const ringR = Math.max(40, 150*pTarg.scale), yawBand = 12;
        if (Math.abs(dist - ringR) < yawBand){ dragRef.current.type = 'rotYaw'; dragRef.current.lastAngle = Math.atan2(dy, dx); e.preventDefault(); return; }
        const ph = { x: pTarg.x + 2.2*ringR, y: pTarg.y };
        if (Math.hypot(x-ph.x, y-ph.y) < 12){ dragRef.current.type='rotPitch'; e.preventDefault(); return; }
        const rh = { x: pTarg.x - 2.2*ringR, y: pTarg.y };
        if (Math.hypot(x-rh.x, y-rh.y) < 12){ dragRef.current.type='rotRoll'; e.preventDefault(); return; }
      }
      if (wantRotateBox && pBox.visible){
        const dx = x - pBox.x, dy = y - pBox.y;
        const dist = Math.hypot(dx,dy);
        const ringR = Math.max(40, 150*pBox.scale), yawBand = 12;
        if (Math.abs(dist - ringR) < yawBand){ dragRef.current.type = 'boxRotYaw'; dragRef.current.lastAngle = Math.atan2(dy, dx); e.preventDefault(); return; }
        const ph = { x: pBox.x + 2.2*ringR, y: pBox.y };
        if (Math.hypot(x-ph.x, y-ph.y) < 12){ dragRef.current.type='boxRotPitch'; e.preventDefault(); return; }
        const rh = { x: pBox.x - 2.2*ringR, y: pBox.y };
        if (Math.hypot(x-rh.x, y-rh.y) < 12){ dragRef.current.type='boxRotRoll'; e.preventDefault(); return; }
      }

      if (wantMoveTarget){
        if (rectAllVisible){
          const minx=Math.min(...pc.map(p=>p.x)), maxx=Math.max(...pc.map(p=>p.x));
          const miny=Math.min(...pc.map(p=>p.y)), maxy=Math.max(...pc.map(p=>p.y));
          if (x>=minx && x<=maxx && y>=miny && y<=maxy){ dragRef.current.type='target'; e.preventDefault(); return; }
        } else if (pTarg.visible && Math.hypot(x-pTarg.x,y-pTarg.y)<40){ dragRef.current.type='target'; e.preventDefault(); return; }
      }
      if (wantMoveBox && boxBounds){
        if (x>=boxBounds.minx && x<=boxBounds.maxx && y>=boxBounds.miny && y<=boxBounds.maxy){ dragRef.current.type='box'; e.preventDefault(); return; }
        else if (pBox.visible && Math.hypot(x-pBox.x,y-pBox.y)<40){ dragRef.current.type='box'; e.preventDefault(); return; }
      }
      if (wantMoveBase){
        const pB = pBase; if (pB.visible && Math.hypot((x-pB.x),(y-pB.y)) < 20){ dragRef.current.type='base'; e.preventDefault(); return; }
      }
      if (wantOrbit){ dragRef.current.type='orbit'; }
    };

    const onMove = (e)=>{
      if (!dragRef.current.type) return;
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left; const y = e.clientY - r.top;

      if (dragRef.current.type==='orbit'){
        setOrbit((o)=>({ ...o, yaw: o.yaw - (e.movementX*0.005), pitch: clamp(o.pitch - (e.movementY*0.005), -1.2, 1.2) }));
        return;
      }
      if (dragRef.current.type==='rotYaw' && pTarg.visible){
        const angle = Math.atan2(y - pTarg.y, x - pTarg.x);
        const dAngle = angle - dragRef.current.lastAngle;
        dragRef.current.lastAngle = angle;
        onRotateTarget({ dyaw: rad2deg(dAngle), dpitch: 0, droll: 0 });
        return;
      }
      if (dragRef.current.type==='rotPitch'){
        const dy = y - dragRef.current.lastY; dragRef.current.lastY = y;
        onRotateTarget({ dyaw:0, dpitch: -dy*0.25, droll:0 });
        return;
      }
      if (dragRef.current.type==='rotRoll'){
        const dx = e.movementX;
        onRotateTarget({ dyaw:0, dpitch:0, droll: dx*0.25 });
        return;
      }
      if (dragRef.current.type==='boxRotYaw' && pBox.visible){
        const angle = Math.atan2(y - pBox.y, x - pBox.x);
        const dAngle = angle - dragRef.current.lastAngle;
        dragRef.current.lastAngle = angle;
        onRotateBox({ dyaw: rad2deg(dAngle), dpitch: 0, droll: 0 });
        return;
      }
      if (dragRef.current.type==='boxRotPitch'){
        const dy = y - dragRef.current.lastY; dragRef.current.lastY = y;
        onRotateBox({ dyaw:0, dpitch: -dy*0.25, droll:0 });
        return;
      }
      if (dragRef.current.type==='boxRotRoll'){
        const dx = e.movementX;
        onRotateBox({ dyaw:0, dpitch:0, droll: dx*0.25 });
        return;
      }

      const { origin, dir } = screenToRay(x,y, cam, vp);
      if (dragRef.current.type==='base'){
        const hit = intersectRayPlaneZ(origin,dir, base.z);
        if (hit){
          let nz=base.z;
          if (e.altKey){ const dy = y - dragRef.current.lastY; dragRef.current.lastY=y; nz = base.z - dy*(radius/400); }
          onDragBase({ x:hit[0], y:hit[1], z:nz });
        }
        return;
      }
      if (dragRef.current.type==='target'){
        const hit = intersectRayPlaneZ(origin,dir, target.z);
        if (hit){
          let nz=target.z;
          if (e.altKey){ const dy = y - dragRef.current.lastY; dragRef.current.lastY=y; nz = target.z - dy*(radius/400); }
          onDragTarget({ x:hit[0], y:hit[1], z:nz });
        }
        return;
      }
      if (dragRef.current.type==='box'){
        const hit = intersectRayPlaneZ(origin,dir, box.center.z);
        if (hit){
          let nz=box.center.z;
          if (e.altKey){ const dy = y - dragRef.current.lastY; dragRef.current.lastY=y; nz = box.center.z - dy*(radius/400); }
          onDragBox({ x:hit[0], y:hit[1], z:nz });
        }
        return;
      }
    };

    const onUp = ()=>{ dragRef.current.type=null; };
    const onWheel = (e)=>{ if (!(interaction==='orbit' || interaction==='free')) return; e.preventDefault(); setOrbit((o)=>({ ...o, radius: clamp(o.radius + e.deltaY*6, 500, 60000) })); };

    el.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    el.addEventListener('wheel', onWheel, { passive:false });
    return ()=>{
      el.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      el.removeEventListener('wheel', onWheel);
    };
  },[interaction, base, target, box, setOrbit, pTarg.visible, pTarg.x, pTarg.y, pBox.visible, pBox.x, pBox.y, pc, boxBounds]);

  // Peintre: dessine les faces triées par profondeur
  function drawBoxFaces(){
    const faces = BOX_FACES.map((idxs, iFace)=>{
      const pts = idxs.map(i=>boxProj[i]).filter(p=>p.visible);
      if (pts.length!==4) return null;
      const avgZ = pts.reduce((s,p)=>s+p.z,0)/4;
      return { iFace, pts, avgZ };
    }).filter(Boolean);
    faces.sort((a,b)=> b.avgZ - a.avgZ);
    const fills = ["#c7d2fe","#bfdbfe","#93c5fd","#a5b4fc","#60a5fa","#93c5fd"];
    return faces.map(({iFace, pts})=>{
      const poly = pts.map(p=>`${p.x},${p.y}`).join(' ');
      return <polygon key={`boxf${iFace}`} points={poly} fill={fills[iFace%fills.length]} fillOpacity={0.65} stroke={UI.blue} strokeWidth={1.5} />;
    });
  }

  // Grid sol
  const grid = (() => {
    const lines = [], L=6000, step=500;
    for(let x=-L; x<=L; x+=step){ lines.push(<Segment key={`gx${x}`} a={[x,-L,0]} b={[x,L,0]} cam={cam} vp={vp} stroke="#e5e7eb" />); }
    for(let y=-L; y<=L; y+=step){ lines.push(<Segment key={`gy${y}`} a={[-L,y,0]} b={[L,y,0]} cam={cam} vp={vp} stroke="#e5e7eb" />); }
    return lines;
  })();

  return (
    <svg ref={svgRef} width={width} height={height} style={{display:"block", background:"#fff", userSelect:"none"}}>
      {grid}
      {/* Axes */}
      <Segment a={[0,0,0]} b={[2000,0,0]} cam={cam} vp={vp} stroke="#ef4444" width={2} />
      <Segment a={[0,0,0]} b={[0,2000,0]} cam={cam} vp={vp} stroke="#10b981" width={2} />
      <Segment a={[0,0,0]} b={[0,0,2000]} cam={cam} vp={vp} stroke="#3b82f6" width={2} />

      {/* Base */}
      {pBase.visible && <circle cx={pBase.x} cy={pBase.y} r={Math.max(2, 60*pBase.scale)} fill={UI.green} />}

      {/* Boîte */}
      {drawBoxFaces()}
      {pBox.visible && (
        <>
          <circle cx={pBox.x} cy={pBox.y} r={Math.max(2, 48*pBox.scale)} fill={UI.blueLite} stroke={UI.blue} />
          {(interaction==='rotateBox' || interaction==='free') && (
            (() => {
              const r = Math.max(40, 150*pBox.scale);
              return (
                <g>
                  <circle cx={pBox.x} cy={pBox.y} r={r} fill="none" stroke={UI.blueLite} strokeWidth={4} strokeDasharray="6 6" />
                  <circle cx={pBox.x + 2.2*r} cy={pBox.y} r={10} fill={UI.red} />
                  <text x={pBox.x + 2.2*r} y={pBox.y-16} textAnchor="middle" fontSize={10} fill={UI.red}>Pitch</text>
                  <circle cx={pBox.x - 2.2*r} cy={pBox.y} r={10} fill={UI.green} />
                  <text x={pBox.x - 2.2*r} y={pBox.y-16} textAnchor="middle" fontSize={10} fill={UI.green}>Roll</text>
                  <text x={pBox.x} y={pBox.y - r - 10} textAnchor="middle" fontSize={10} fill={UI.blueLite}>Yaw</text>
                </g>
              );
            })()
          )}
        </>
      )}

      {/* Cible (rectangle) */}
      {(() => {
        const pc2 = corners.map(c=>projectPoint(c,cam,vp));
        if (pc2.every(p=>p.visible)){
          return (
            <polygon points={pc2.map(p=>`${p.x},${p.y}`).join(' ')} fill="#fde047" stroke="#eab308" strokeWidth={2} />
          );
        }
        return null;
      })()}

      {/* Centres + rayon visuel */}
      {pBase.visible && pTarg.visible && (
        <>
          <circle cx={pTarg.x} cy={pTarg.y} r={Math.max(2, 55*pTarg.scale)} fill="#facc15" stroke="#eab308" />
          <line x1={pBase.x} y1={pBase.y} x2={pTarg.x} y2={pTarg.y} stroke="#0284c7" strokeWidth={2} />
        </>
      )}

      {/* Poignées rotation cible */}
      {(interaction==='rotateTarget' || interaction==='free') && pTarg.visible && (
        <g>
          {(() => {
            const r = Math.max(40, 150*pTarg.scale);
            return (
              <>
                <circle cx={pTarg.x} cy={pTarg.y} r={r} fill="none" stroke={UI.blueLite} strokeWidth={4} strokeDasharray="6 6" />
                <circle cx={pTarg.x + 2.2*r} cy={pTarg.y} r={10} fill={UI.red} />
                <text x={pTarg.x + 2.2*r} y={pTarg.y-16} textAnchor="middle" fontSize={10} fill={UI.red}>Pitch</text>
                <circle cx={pTarg.x - 2.2*r} cy={pTarg.y} r={10} fill={UI.green} />
                <text x={pTarg.x - 2.2*r} y={pTarg.y-16} textAnchor="middle" fontSize={10} fill={UI.green}>Roll</text>
                <text x={pTarg.x} y={pTarg.y - r - 10} textAnchor="middle" fontSize={10} fill={UI.blueLite}>Yaw</text>
              </>
            );
          })()}
        </g>
      )}
    </svg>
  );
}

// --------- Physics helpers --------------------------------------------------
function computeBase(D1Lx, D1Ly, D1Rx, D1Ry, FLRx, FLRy, FLRz, betaDeg){
  const D1Cx = D1Lx + (D1Rx - D1Lx)/2;
  const D1Cy = D1Ly + (D1Ry - D1Ly)/2;
  const b = deg2rad(betaDeg);
  const cb = Math.cos(b), sb = Math.sin(b);
  const baseX = D1Cx + (FLRx * cb - FLRy * sb);
  const baseY = D1Cy + (FLRx * sb + FLRy * cb);
  const baseZ = FLRz;
  return { D1Cx, D1Cy, baseX, baseY, baseZ };
}

// Ray en repère sphérique classique : η = eps - alpha (azimut), θ = thetaDeg (polaire)
function computeRay(epsDeg, alphaDeg, thetaDeg){
  const eta = epsDeg - alphaDeg;                // azimut
  const etaRad = deg2rad(eta);
  const theta = deg2rad(thetaDeg);              // polaire (0° = +Z)
  const sθ = Math.sin(theta), cθ = Math.cos(theta);
  const cη = Math.cos(etaRad), sη = Math.sin(etaRad);
  return { rx: cη*sθ, ry: sη*sθ, rz: cθ, eta, etaRad };
}

function computeTarget(base, ray, V){
  return { Xt: base.baseX + V*ray.rx, Yt: base.baseY + V*ray.ry, Zt: base.baseZ + V*ray.rz };
}

function SelfTests({ base, target, V, useAngles, ray }){
  const ok1 = useAngles ? (Math.abs(Math.hypot(ray.rx,ray.ry,ray.rz)-1) < 1e-9) : true;
  const dx = target.Xt - base.baseX, dy = target.Yt - base.baseY, dz = target.Zt - base.baseZ;
  const dist = Math.hypot(dx,dy,dz);
  const ok2 = useAngles ? (Math.abs(dist - V) < 1e-6) : true;
  const rc = computeRay(0,0,90); // η=0°, θ=90° -> (1,0,0)
  const ok3 = Math.abs(rc.rx-1) < 1e-9 && Math.abs(rc.ry) < 1e-9 && Math.abs(rc.rz) < 1e-9;
  // nouveaux tests
  const rUp = computeRay(0,0,0);        // (0,0,1)
  const rDown = computeRay(0,0,180);    // (0,0,-1)
  const rY = computeRay(90,0,90);       // (0,1,0)
  const ok4 = Math.abs(rUp.rx) < 1e-9 && Math.abs(rUp.ry) < 1e-9 && Math.abs(rUp.rz-1) < 1e-9;
  const ok5 = Math.abs(rDown.rx) < 1e-9 && Math.abs(rDown.ry) < 1e-9 && Math.abs(rDown.rz+1) < 1e-9;
  const ok6 = Math.abs(rY.rx) < 1e-9 && Math.abs(rY.ry-1) < 1e-9 && Math.abs(rY.rz) < 1e-9;

  return (
    <div style={S.card}>
      <div style={{fontWeight:600, fontSize:12, marginBottom:6}}>Tests intégrés</div>
      <div style={{fontSize:12, color: ok1?"#065f46":"#991b1b"}}>‣ |r|≈1 (angles) : {ok1?"OK":"KO"}</div>
      <div style={{fontSize:12, color: ok2?"#065f46":"#991b1b"}}>‣ ||base→cible|| : {useAngles? (ok2?"V OK":"V KO") : dist.toFixed(3)}</div>
      <div style={{fontSize:12, color: ok3?"#065f46":"#991b1b"}}>‣ r(η=0°,θ=90°)≈(1,0,0) : {ok3?"OK":"KO"}</div>
      <div style={{fontSize:12, color: ok4?"#065f46":"#991b1b"}}>‣ r(θ=0°)≈(0,0,1) : {ok4?"OK":"KO"}</div>
      <div style={{fontSize:12, color: ok5?"#065f46":"#991b1b"}}>‣ r(θ=180°)≈(0,0,-1) : {ok5?"OK":"KO"}</div>
      <div style={{fontSize:12, color: ok6?"#065f46":"#991b1b"}}>‣ r(η=90°,θ=90°)≈(0,1,0) : {ok6?"OK":"KO"}</div>
    </div>
  );
}

// Angles sortants depuis base et cible (quel que soit le mode)
function computeOutputAngles(base, target, alphaDeg){
  const dx = target.z !== undefined ? (target.x - base.x) : (target.Xt - base.baseX);
  const dy = target.z !== undefined ? (target.y - base.y) : (target.Yt - base.baseY);
  const dz = target.z !== undefined ? (target.z - base.z) : (target.Zt - base.baseZ);
  const Vout = Math.hypot(dx,dy,dz);
  if (Vout < 1e-12) return { V:0, etaDeg:0, thetaDeg:0, elevDeg:0, epsDeg:alphaDeg, valid:false };
  const eta = Math.atan2(dy, dx);                 // [-π, π]
  const cosθ = clamp(dz / Vout, -1, 1);
  const theta = Math.acos(cosθ);                   // [0, π]
  const elev = (Math.PI/2) - theta;                // élévation (pitch) en rad
  const etaDeg = rad2deg(eta);
  const thetaDeg = rad2deg(theta);
  const elevDeg = rad2deg(elev);
  const epsDeg = etaDeg + alphaDeg;                // car η = ε - α
  return { V:Vout, etaDeg, thetaDeg, elevDeg, epsDeg, valid:true };
}

// --------- SplitPane (redimensionnable, sans dépendance) -------------------
function SplitPane({ left, right, initial=380, min=280, max=640 }){
  const [lw, setLw] = React.useState(()=> {
    const saved = localStorage.getItem("split:left");
    return saved ? Number(saved) : initial;
  });
  const dragging = React.useRef(false);

  React.useEffect(()=>{
    const onMove = (e)=>{
      if(!dragging.current) return;
      const w = Math.max(min, Math.min(max, e.clientX));
      setLw(w);
      localStorage.setItem("split:left", String(w));
    };
    const onUp = ()=>{
      if(dragging.current){ dragging.current=false; document.body.style.cursor=''; }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return ()=>{ window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  },[min,max]);

  return (
    <div style={S.splitWrap}>
      <div style={{...S.left, width: lw}}>
        {left}
      </div>
      <div
        style={S.splitter}
        onMouseDown={()=>{ dragging.current=true; document.body.style.cursor='col-resize'; }}
        title="Glisser pour redimensionner"
      />
      <div style={S.right}>
        {right()}
      </div>
    </div>
  );
}

// --------- Main component ---------------------------------------------------
export default function Simulation3D_UXClean(){
  // Angles phys.
  const [FLRx, setFLRx] = React.useState(5638);
  const [FLRy, setFLRy] = React.useState(0);
  const [FLRz, setFLRz] = React.useState(0);
  const [D1Lx, setD1Lx] = React.useState(-4300);
  const [D1Ly, setD1Ly] = React.useState(1245);
  const [D1Rx, setD1Rx] = React.useState(-4300);
  const [D1Ry, setD1Ry] = React.useState(-1255);
  const [alpha, setAlpha] = React.useState(0);   // minutes d'arc
  const [eps, setEps] = React.useState(0);       // degrés
  const [zeta, setZeta] = React.useState(90);    // θ (polaire) en degrés
  const [beta, setBeta] = React.useState(0);
  const [V, setV] = React.useState(1000);

  // Mode positions
  const [ctrl, setCtrl] = React.useState('manuel'); // 'angles' | 'manuel'

  const baseFromAngles = React.useMemo(()=>computeBase(D1Lx,D1Ly,D1Rx,D1Ry,FLRx,FLRy,FLRz,beta), [D1Lx,D1Ly,D1Rx,D1Ry,FLRx,FLRy,FLRz,beta]);
  const rayAngles = React.useMemo(()=>computeRay(eps, alpha/60, zeta), [eps, alpha, zeta]);
  const targFromAngles = React.useMemo(()=>computeTarget(baseFromAngles, rayAngles, V), [baseFromAngles, rayAngles, V]);

  const [baseM, setBaseM] = React.useState(()=>({ x: baseFromAngles.baseX, y: baseFromAngles.baseY, z: baseFromAngles.baseZ }));
  const [targM, setTargM] = React.useState(()=>({ x: targFromAngles.Xt, y: targFromAngles.Yt, z: targFromAngles.Zt }));

  const base = ctrl==='angles' ? { x: baseFromAngles.baseX, y: baseFromAngles.baseY, z: baseFromAngles.baseZ } : baseM;
  const targ = ctrl==='angles' ? { x: targFromAngles.Xt, y: targFromAngles.Yt, z: targFromAngles.Zt } : targM;

    // --- Yt en une ligne (formule) + comparaison
  const Yt_formula = React.useMemo(() =>
    (D1Ly + D1Ry)/2
    + FLRx*Math.sin(deg2rad(beta))
    + FLRy*Math.cos(deg2rad(beta))
    + V*Math.sin(deg2rad(eps - alpha/60))*Math.sin(deg2rad(zeta))
  , [D1Ly, D1Ry, FLRx, FLRy, beta, V, eps, alpha, zeta]);

  const Yt_sim = targ.y;              // valeur actuelle de la scène
  const dYt   = Yt_sim - Yt_formula;  // écart




  // Rectangle cible
  const [rectYaw, setRectYaw]     = React.useState(0);
  const [rectPitch, setRectPitch] = React.useState(0);
  const [rectRoll, setRectRoll]   = React.useState(0);
  const [rectW, setRectW]         = React.useState(800);
  const [rectH, setRectH]         = React.useState(300);

  const rect = React.useMemo(()=>({
    w: rectW, h: rectH,
    yaw: deg2rad(rectYaw), pitch: deg2rad(rectPitch), roll: deg2rad(rectRoll)
  }),[rectW,rectH,rectYaw,rectPitch,rectRoll]);

  // Boîte 3D
  const [boxPos, setBoxPos] = React.useState({ x: 1000, y: 0, z: 400 });
  const [boxYaw, setBoxYaw] = React.useState(0);
  const [boxPitch, setBoxPitch] = React.useState(0);
  const [boxRoll, setBoxRoll] = React.useState(0);
  const [boxSX, setBoxSX] = React.useState(1280);
  const [boxSY, setBoxSY] = React.useState(280);
  const [boxSZ, setBoxSZ] = React.useState(280);

  const box = React.useMemo(()=>({
    center: boxPos,
    geom: { sx: boxSX, sy: boxSY, sz: boxSZ, yaw: deg2rad(boxYaw), pitch: deg2rad(boxPitch), roll: deg2rad(boxRoll) }
  }),[boxPos,boxSX,boxSY,boxSZ,boxYaw,boxPitch,boxRoll]);

  // Vue auto mesurée
  const [viewW, setViewW] = React.useState(1200);
  const [viewH, setViewH] = React.useState(700);
  const [orbit, setOrbit] = React.useState({ yaw:0.6, pitch:0.45, radius:9000 });
  const simRef = React.useRef(null);
  React.useEffect(()=>{
    if (!simRef.current || typeof ResizeObserver==="undefined") return;
    const ro = new ResizeObserver(entries=>{
      const cr = entries[0].contentRect;
      setViewW(Math.max(300, cr.width));
      setViewH(Math.max(300, cr.height));
    });
    ro.observe(simRef.current);
    return ()=> ro.disconnect();
  },[]);

  const [interaction, setInteraction] = React.useState('free'); // 'free'|'orbit'|'moveBase'|'moveTarget'|'rotateTarget'|'moveBox'|'rotateBox'

  const onDragBase = React.useCallback((p)=>{ setCtrl('manuel'); setBaseM(p); },[]);
  const onDragTarget = React.useCallback((p)=>{ setCtrl('manuel'); setTargM(p); },[]);
  const onRotateTarget = React.useCallback(({dyaw=0,dpitch=0,droll=0})=>{
    setRectYaw(a=>a+dyaw); setRectPitch(a=>clamp(a+dpitch,-89,89)); setRectRoll(a=>a+droll);
  },[]);
  const onDragBox = React.useCallback((p)=>{ setBoxPos(p); },[]);
  const onRotateBox = React.useCallback(({dyaw=0,dpitch=0,droll=0})=>{
    setBoxYaw(a=>a+dyaw); setBoxPitch(a=>clamp(a+dpitch,-89,89)); setBoxRoll(a=>a+droll);
  },[]);

  const outputs = { Xt: targ.x, Yt: targ.y, Zt: targ.z };
  const baseForTest = { baseX: base.x, baseY: base.y, baseZ: base.z };
  const targetForTest = { Xt: targ.x, Yt: targ.y, Zt: targ.z };

  // Angles sortants (toujours calculés à partir des positions visibles)
  const outAngles = React.useMemo(()=>computeOutputAngles(base, targ, alpha/60), [base, targ, alpha]);

  



  // --- UI LEFT: panneau
  const LeftPanel = (
    <div style={S.pad}>
      <div style={{marginBottom:12}}>
        <div style={{fontSize:20, fontWeight:700, marginBottom:2}}>Settings</div>
        <div style={{fontSize:12, color:UI.subtext}}></div>
        <div style={S.card}>
  <div style={{fontWeight:600, fontSize:12, marginBottom:8}}>Yt — comparaison</div>
  <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, fontSize:12}}>
    <div>Yt (formule) = <span style={{fontFamily:"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"}}>{Yt_formula.toFixed(3)}</span></div>
    <div>Yt (simulation) = <span style={{fontFamily:"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"}}>{Yt_sim.toFixed(3)}</span></div>
    <div>ΔYt = <span style={{fontFamily:"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", color: Math.abs(dYt)<1e-6 ? "#065f46" : "#991b1b"}}>{dYt.toFixed(6)}</span></div>
  </div>
  <div style={{fontSize:11, color:UI.subtext, marginTop:6}}>
    {ctrl==='manuel'
      ? "Note : en mode Manuel, un écart est normal si la cible n'est pas pilotée par les angles."
      : "En mode Angles, ΔYt devrait être ~0."}
  </div>
</div>

      </div>

      <div style={S.card}>
        <div style={S.hGroup}>
          <span style={S.badge}>Positions :</span>
          <SegButton active={ctrl==='angles'} onClick={()=>setCtrl('angles')}>Angles</SegButton>
          <SegButton active={ctrl==='manuel'} onClick={()=>setCtrl('manuel')}>Manuel</SegButton>
        </div>
        <div style={S.hGroup}>
          <span style={S.badge}>Interaction :</span>
          <SegButton active={interaction==='free'} onClick={()=>setInteraction('free')}>Libre (Tout)</SegButton>
          <SegButton active={interaction==='orbit'} onClick={()=>setInteraction('orbit')}>Orbite</SegButton>
          <SegButton active={interaction==='moveBase'} onClick={()=>setInteraction('moveBase')}>Caméra</SegButton>
          <SegButton active={interaction==='moveTarget'} onClick={()=>setInteraction('moveTarget')}>Cible</SegButton>
          <SegButton active={interaction==='rotateTarget'} onClick={()=>setInteraction('rotateTarget')}>Rot. Cible</SegButton>
          <SegButton active={interaction==='moveBox'} onClick={()=>setInteraction('moveBox')}>Boîte</SegButton>
          <SegButton active={interaction==='rotateBox'} onClick={()=>setInteraction('rotateBox')}>Rot. Boîte</SegButton>
        </div>
      </div>

      <Section title="Paramètres – Mode Angles" defaultOpen>
        <div style={S.grid2}>
          <SliderRow label="FLRx" value={FLRx} onChange={setFLRx} min={-10000} max={10000} step={0.001} />
          <SliderRow label="FLRy" value={FLRy} onChange={setFLRy} min={-10000} max={10000} step={0.001} />
          <SliderRow label="FLRz" value={FLRz} onChange={setFLRz} min={-5000} max={5000} step={0.001} />

          <SliderRow label="D1Lx" value={D1Lx} onChange={setD1Lx} min={-10000} max={10000} step={0.001} />
          <SliderRow label="D1Ly" value={D1Ly} onChange={setD1Ly} min={-10000} max={10000} step={0.001} />
          <SliderRow label="D1Rx" value={D1Rx} onChange={setD1Rx} min={-10000} max={10000} step={0.001} />
          <SliderRow label="D1Ry" value={D1Ry} onChange={setD1Ry} min={-10000} max={10000} step={0.001} />

          <SliderRow label="β (sym) [°]" value={beta} onChange={setBeta} min={-180} max={180} step={0.01} />
          <SliderRow label="α drive [′] (minutes)" value={alpha} onChange={setAlpha} min={-10800} max={10800} step={0.01} />
          <SliderRow label="ε (zr) [°]" value={eps} onChange={setEps} min={-180} max={180} step={0.01} />
          <SliderRow label="θ (polaire) [°]" value={zeta} onChange={setZeta} min={0} max={180} step={0.01} />
          <SliderRow label="V" value={V} onChange={setV} min={0} max={20000} step={0.001} />
        </div>
      </Section>

      <Section title="Positions – Mode Manuel" defaultOpen={false}>
        <div style={S.grid2}>
          <SliderRow label="Base X" value={baseM.x} onChange={(v)=>{ setCtrl('manuel'); setBaseM({...baseM,x:v}); }} min={-20000} max={20000} step={0.01} />
          <SliderRow label="Base Y" value={baseM.y} onChange={(v)=>{ setCtrl('manuel'); setBaseM({...baseM,y:v}); }} min={-20000} max={20000} step={0.01} />
          <SliderRow label="Base Z" value={baseM.z} onChange={(v)=>{ setCtrl('manuel'); setBaseM({...baseM,z:v}); }} min={-5000} max={5000} step={0.01} />

          <SliderRow label="Cible X" value={targM.x} onChange={(v)=>{ setCtrl('manuel'); setTargM({...targM,x:v}); }} min={-20000} max={20000} step={0.01} />
          <SliderRow label="Cible Y" value={targM.y} onChange={(v)=>{ setCtrl('manuel'); setTargM({...targM,y:v}); }} min={-20000} max={20000} step={0.01} />
          <SliderRow label="Cible Z" value={targM.z} onChange={(v)=>{ setCtrl('manuel'); setTargM({...targM,z:v}); }} min={-5000} max={5000} step={0.01} />
        </div>
      </Section>

      <SelfTests base={baseForTest} target={targetForTest} V={V} useAngles={ctrl==='angles'} ray={rayAngles} />

      <div style={S.card}>
        <div style={{fontWeight:600, fontSize:12, marginBottom:8, color:"#92400e"}}>Sorties (monde)</div>
        <div style={{display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, fontSize:12}}>
          <div>Xt = <span style={{fontFamily:"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"}}>{outputs.Xt.toFixed(3)}</span></div>
          <div>Yt = <span style={{fontFamily:"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"}}>{outputs.Yt.toFixed(3)}</span></div>
          <div>Zt = <span style={{fontFamily:"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"}}>{outputs.Zt.toFixed(3)}</span></div>
        </div>
      </div>

      <div style={S.card}>
        <div style={{fontWeight:600, fontSize:12, marginBottom:8, color:"#1f2937"}}>Angles (sortie)</div>
        <div style={{display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8, fontSize:12}}>
          <div>η (azimut) = <span style={{fontFamily:"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"}}>{outAngles.etaDeg.toFixed(2)}°</span></div>
          <div>θ (polaire) = <span style={{fontFamily:"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"}}>{outAngles.thetaDeg.toFixed(2)}°</span></div>
          <div>Élév. = <span style={{fontFamily:"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"}}>{outAngles.elevDeg.toFixed(2)}°</span></div>
          <div>α (drive) = <span style={{fontFamily:"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"}}>{alpha.toFixed(2)}′</span> <span style={{color:UI.subtext}}>({(alpha/60).toFixed(4)}°)</span></div>
          <div>ε (calc) = <span style={{fontFamily:"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"}}>{outAngles.epsDeg.toFixed(2)}°</span></div>
        </div>
        <div style={{fontSize:11, color:UI.subtext, marginTop:6}}>V (mesuré) = {outAngles.V.toFixed(3)}</div>
      </div>

      <div style={{display:"flex", gap:10}}>
        <button
          style={S.resetBtn}
          onClick={()=>{
            setFLRx(5638); setFLRy(0); setFLRz(0);
            setD1Lx(-4300); setD1Ly(1245); setD1Rx(-4300); setD1Ry(-1255);
            setBeta(0); setAlpha(0); setEps(0); setZeta(90); setV(1000);
            const b=computeBase(-4300,1245,-4300,-1255,5638,0,0,0);
            const r=computeRay(0,0,90);
            const t=computeTarget(b,r,1000);
            setBaseM({ x:b.baseX, y:b.baseY, z:b.baseZ });
            setTargM({ x:t.Xt, y:t.Yt, z:t.Zt });
            setCtrl('manuel');
            setRectYaw(0); setRectPitch(0); setRectRoll(0); setRectW(800); setRectH(300);
            setBoxPos({ x: 1000, y: 0, z: 400 });
            setBoxYaw(15); setBoxPitch(-5); setBoxRoll(10);
            setBoxSX(900); setBoxSY(600); setBoxSZ(500);
            setOrbit({ yaw:0.6, pitch:0.45, radius:9000 });
            setInteraction('free');
          }}
        >Réinitialiser</button>
      </div>
    </div>



  );

  // --- UI RIGHT: simulation
  const RightSim = () => (
    <div ref={simRef} style={{ width:"100%", height:"100%" }}>
      <SceneSVG
        width={viewW}
        height={viewH}
        orbit={orbit}
        setOrbit={setOrbit}
        base={base}
        target={targ}
        rect={rect}
        box={box}
        interaction={interaction}
        onDragBase={onDragBase}
        onDragTarget={onDragTarget}
        onRotateTarget={onRotateTarget}
        onDragBox={onDragBox}
        onRotateBox={onRotateBox}
      />
      <div style={S.help}>
        Drag XY • <b>ALT+Drag</b> = Z • Anneau = Yaw, Rouge = Pitch, Vert = Roll •
        Modes : Libre / Orbite / Caméra / Cible / Boîte / Rotations
      </div>
    </div>
  );

  return (
    <div style={S.app}>
      <div style={S.container}>
        <h1 style={S.title}> 3D Simulation for Target Placement</h1>
        <p style={S.subtitle}>For now, the tool is a prototype.
Questions / recommendation : Hoffmann Mathias</p>

        <SplitPane left={LeftPanel} right={RightSim} />
>>>>>>> 6bbee61 (Ajout de la simulation 3D commentée)
      </div>
    </div>
  );
}
