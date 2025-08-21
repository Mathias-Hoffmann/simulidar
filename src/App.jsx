import * as React from "react";
import * as XLSX from "xlsx";

// Mini simulation interactive (React + Tailwind)
// VERSION: arcs d'angles + rotation de la cible
// - Charge un fichier Excel (CLCT.xlsx) et permet de mapper les colonnes aux variables
// - Calcule Xt, Yt, Zt en direct (mode ANGLES)
// - OU contrôle la cible directement au drag (mode CIBLE) et recalcule ε, ζ, V en temps réel
// - Contrôle de la CAMÉRA en drag (mode CAMÉRA). La cible reste fixe et les angles s'ajustent.
// - Affiche tous les angles (entrées + dérivés) en temps réel, + ARCS visuels α, ε, η, β
// - Fond ajustable (cover/contain/étirement/zoom)
// - NOUVEAU : Rotation de la cible (slider + poignée de rotation)

function deg2rad(d) { return (d * Math.PI) / 180; }
function rad2deg(r) { return (r * 180) / Math.PI; }
function safeNum(v, fallback=0) {
  const n = typeof v === "string" ? Number(v.toString().replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function SliderRow({ label, value, min= -5000, max=5000, step=1, onChange, unit="" }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-sm">
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
        className="w-full border rounded-md px-2 py-1 text-sm"
      />
    </div>
  );
}

function SelectRow({ label, value, options, onChange }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <select value={value ?? ""} onChange={(e)=>onChange(e.target.value || null)} className="border rounded-md px-2 py-1">
        <option value="">— (ignorer) —</option>
        {options.map((opt)=> (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </label>
  );
}

function guessMapping(columns) {
  // essaie d'auto-mapper noms de colonnes fréquents
  const by = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const find = (cands) => columns.find((c)=> cands.map(by).includes(by(c)) ) || null;
  return {
    FLRx: find(["FLRx", "FLR_x", "FrontLeftX", "FLX"]),
    FLRy: find(["FLRy", "FLR_y", "FrontLeftY", "FLY"]),
    D1Lx: find(["D1L.x", "D1Lx", "D1L", "D1LeftX"]),
    D1Rx: find(["D1R.x", "D1Rx", "D1R", "D1RightX"]),
    D1Cy: find(["D1c.y", "D1Cy", "D1cY", "D1CenterY", "D1Y"]),
    D1Cz: find(["D1c.z", "D1Cz", "D1cZ", "D1CenterZ", "D1Z"]),
    beta: find(["beta", "symmetry", "symetrie", "β"]),
    alpha: find(["alpha", "drive", "α"]),
    eps: find(["eps", "epsilon", "ε", "eps(zr)"]),
    zeta: find(["zeta", "theta", "ζ", "ζ(xr)", "thetaXR"]),
    piYr: find(["pi", "π", "pi(yr)", "yr"]),
    V: find(["V", "speed", "distance"]),
  };
}

// --- helpers angles/arcs (monde XY ➜ écran SVG) ---
function norm180(a){ // [-180,180)
  let x = ((a + 180) % 360 + 360) % 360 - 180; // robust modulo
  return x;
}
function angleWorldToScreen(a){ return -a; } // Y haut ➜ écran Y bas
function polarPointScreen(cx, cy, r, worldDeg){
  const a = deg2rad(angleWorldToScreen(worldDeg));
  return { x: cx + r*Math.cos(a), y: cy + r*Math.sin(a) };
}
function arcPathShortest(cx, cy, r, startWorldDeg, endWorldDeg){
  const d = norm180(endWorldDeg - startWorldDeg); // [-180,180)
  const endW = startWorldDeg + d; // fin ramenée sur l'arc le plus court
  const a0s = angleWorldToScreen(startWorldDeg);
  const a1s = angleWorldToScreen(endW);
  const p0 = { x: cx + r*Math.cos(deg2rad(a0s)), y: cy + r*Math.sin(deg2rad(a0s)) };
  const p1 = { x: cx + r*Math.cos(deg2rad(a1s)), y: cy + r*Math.sin(deg2rad(a1s)) };
  const deltaScreen = a1s - a0s; // peut être négatif
  const largeArc = Math.abs(deltaScreen) > 180 ? 1 : 0; // ici false car |d|<=180
  const sweep = deltaScreen >= 0 ? 1 : 0; // direction écran
  return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${largeArc} ${sweep} ${p1.x} ${p1.y}`;
}
function arcMidPointWorld(cx, cy, r, a0, a1){
  const mid = a0 + norm180(a1 - a0)/2;
  return polarPointScreen(cx, cy, r, mid);
}

export default function MiniSimulation() {
  // Mode global de données (manuel/fichier)
  const [mode, setMode] = React.useState("manuel"); // "manuel" | "fichier"

  // Mode de contrôle :
  const [control, setControl] = React.useState("angles"); // "angles" | "cible" | "camera"

  // Données fichier
  const [rows, setRows] = React.useState([]); // objets {col:value}
  const [columns, setColumns] = React.useState([]);
  const [mapping, setMapping] = React.useState({});
  const [rowIndex, setRowIndex] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const [fps, setFps] = React.useState(4);

  // Entrées principales (mode manuel ou valeurs calculées depuis la ligne)
  const [FLRx, setFLRx] = React.useState(0);
  const [FLRy, setFLRy] = React.useState(0);

  const [D1Lx, setD1Lx] = React.useState(-4309.481443);
  const [D1Rx, setD1Rx] = React.useState(-4296.361317);

  const [D1Cy, setD1Cy] = React.useState(0);
  const [D1Cz, setD1Cz] = React.useState(0);

  const [alpha, setAlpha] = React.useState(-21.11);   // α (drive angle) [deg]
  const [eps, setEps] = React.useState(0);            // ε(zr) [deg]
  const [zeta, setZeta] = React.useState(90);         // ζ(xr) [deg]
  const [beta, setBeta] = React.useState(0);          // Symmetry angle β [deg]
  const [piYr, setPiYr] = React.useState(0);          // π(yr) [deg] (info)
  const [V, setV] = React.useState(1000);             // V

  // Variables de contrôle direct de la cible (mode "cible"/"camera")
  const [XtM, setXtM] = React.useState(0);
  const [YtM, setYtM] = React.useState(0);
  const [ZtM, setZtM] = React.useState(0);

  // Rotation de la cible (supplémentaire par rapport à la normale au rayon)
  const [targetYaw, setTargetYaw] = React.useState(0); // [deg]

  // Affichage
  const [scale, setScale] = React.useState(0.05);     // pixels par unité
  const [bgUrl, setBgUrl] = React.useState("camion.png"); // fond par défaut
  const [bgMode, setBgMode] = React.useState("cover");    // 'cover' | 'contain' | 'stretch' | 'custom'
  const [bgZoom, setBgZoom] = React.useState(100);        // % (si custom)
  const [bgPosX, setBgPosX] = React.useState(50);         // % position X
  const [bgPosY, setBgPosY] = React.useState(50);         // % position Y
  const [viewW, setViewW] = React.useState(980);
  const [viewH, setViewH] = React.useState(600);

  // référence pour les coordonnées du SVG (drag)
  const svgRef = React.useRef(null);
  const [draggingTarget, setDraggingTarget] = React.useState(false);
  const [draggingCam, setDraggingCam] = React.useState(false);
  const [draggingRotate, setDraggingRotate] = React.useState(false);

  // Lecture fichier → lignes/colonnes
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

  // Défilement automatique des lignes
  React.useEffect(() => {
    if (!playing || rows.length === 0) return;
    const interval = setInterval(() => {
      setRowIndex((i) => (i + 1) % rows.length);
    }, 1000 / Math.max(1, fps));
    return () => clearInterval(interval);
  }, [playing, rows.length, fps]);

  // Appliquer ligne courante aux variables si mode fichier
  React.useEffect(() => {
    if (mode !== "fichier" || rows.length === 0) return;
    const r = rows[Math.max(0, Math.min(rowIndex, rows.length-1))] || {};
    const m = mapping || {};
    setFLRx(safeNum(r[m.FLRx], FLRx));
    setFLRy(safeNum(r[m.FLRy], FLRy));
    setD1Lx(safeNum(r[m.D1Lx], D1Lx));
    setD1Rx(safeNum(r[m.D1Rx], D1Rx));
    setD1Cy(safeNum(r[m.D1Cy], D1Cy));
    setD1Cz(safeNum(r[m.D1Cz], D1Cz));
    setBeta(safeNum(r[m.beta], beta));
    setAlpha(safeNum(r[m.alpha], alpha));
    setEps(safeNum(r[m.eps], eps));
    setZeta(safeNum(r[m.zeta], zeta));
    setPiYr(safeNum(r[m.piYr], piYr));
    setV(safeNum(r[m.V], V));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, rowIndex, rows, mapping]);

  // Calculs intermédiaires (toujours en direct)
  const D1Cx = D1Lx + (D1Rx - D1Lx)/2;               // D1c.x
  const betaRad = deg2rad(beta);
  const cosb = Math.cos(betaRad), sinb = Math.sin(betaRad);
  // Rotation dans le plan XY par β
  const SLR_FL_X = D1Cx + (FLRx * cosb - FLRy * sinb);
  const SLR_FL_Y = D1Cy + (FLRx * sinb + FLRy * cosb);
  const SLR_FL_Z = D1Cz;

  const B = Math.hypot(FLRx, FLRy);
  const delta1 = rad2deg(Math.atan2(FLRy, FLRx));     // Δ'
  const delta2 = delta1 + beta;                        // Δ''

  const eta = eps - alpha;                             // η = ε(zr) − α
  const etaRad = deg2rad(eta);
  const thetaRad = deg2rad(zeta);

  // --- POSITION CIBLE ---
  let Xt, Yt, Zt;
  if (control === "angles") {
    // depuis angles
    Xt = SLR_FL_X + Math.cos(etaRad) * Math.sin(thetaRad) * V;
    Yt = SLR_FL_Y + Math.sin(etaRad) * Math.sin(thetaRad) * V;
    Zt = SLR_FL_Z + Math.cos(thetaRad) * V;
  } else {
    // contrôle absolu (cible fixe) – utilisé en modes "cible" et "camera"
    Xt = XtM; Yt = YtM; Zt = ZtM;
  }

  // Angles/valeurs géométriques par rapport à la base SLR.FL
  const dx = Xt - SLR_FL_X, dy = Yt - SLR_FL_Y, dz = Zt - SLR_FL_Z;
  const rxy = Math.hypot(dx, dy);
  const V_now = Math.hypot(rxy, dz);
  const eta_now = rad2deg(Math.atan2(dy, dx)); // = ε − α
  const zeta_now = rad2deg(Math.atan2(rxy, dz));
  const eps_now = eta_now + alpha;

  // Mettre à jour les angles/valeurs si on ne pilote pas par "angles"
  React.useEffect(() => {
    if (control === "angles") return;
    setV(V_now);
    setZeta(zeta_now);
    setEps(eps_now);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [control, Xt, Yt, Zt, SLR_FL_X, SLR_FL_Y, SLR_FL_Z, alpha]);

  // Quand on bascule en mode "cible" OU "camera", figer la position actuelle de la cible
  React.useEffect(() => {
    if (control === "cible" || control === "camera") {
      setXtM(Xt);
      setYtM(Yt);
      setZtM(Zt);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [control]);

  // Projection 2D simple (plan XY), Y vers le haut
  const sx = viewW/2 + Xt * scale;
  const sy = viewH/2 - Yt * scale;

  // Taille de la cible (pixels)
  const targetPxW = 80; // largeur fixe visuelle
  const targetPxH = 14;

  // Fond: chargeur d'image → data URL
  function onBgFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setBgUrl(String(ev.target?.result || ""));
    reader.readAsDataURL(file);
  }

  // Calcul taille/position du fond
  const bgSize =
    bgMode === "cover" ? "cover" :
    bgMode === "contain" ? "contain" :
    bgMode === "stretch" ? `${viewW}px ${viewH}px` :
    `${bgZoom}% auto`;
  const bgPos = `${bgPosX}% ${bgPosY}%`;

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

  // --- DRAG CIBLE ---
  function onPointerDownTarget(e) {
    if (!(control === "cible" || control === "camera")) return;
    setDraggingTarget(true);
    const p = screenToWorld(e.clientX, e.clientY);
    setXtM(p.x); setYtM(p.y);
  }
  // --- DRAG CAMERA ---
  function onPointerDownCam(e) {
    if (control !== "camera") return;
    setDraggingCam(true);
  }
  // --- ROTATION HANDLE ---
  function onPointerDownRotate(e){
    e.stopPropagation();
    setDraggingRotate(true);
  }

  function onPointerMove(e) {
    const p = screenToWorld(e.clientX, e.clientY);
    if (draggingTarget && (control === "cible" || control === "camera")) {
      setXtM(p.x); setYtM(p.y);
    }
    if (draggingCam && control === "camera") {
      // On impose SLR.FL = p, et on en déduit FLRx/FLRy (rotation inverse de β)
      const dx = p.x - D1Cx;
      const dy = p.y - D1Cy;
      const FLRx_new = dx * cosb + dy * sinb;      // R(-β)[dx,dy]
      const FLRy_new = -dx * sinb + dy * cosb;
      setFLRx(FLRx_new);
      setFLRy(FLRy_new);
    }
    if (draggingRotate) {
      // angle monde du pointeur depuis le centre cible
      const cx = Xt; const cy = Yt;
      const vx = p.x - cx; const vy = p.y - cy;
      const pointerAngleW = rad2deg(Math.atan2(vy, vx)); // monde
      // base du rectangle = perpendiculaire au rayon (azimut monde + 90°)
      const baseRectW = (eta_now + 90);
      const yaw = norm180(pointerAngleW - baseRectW);
      setTargetYaw(yaw);
    }
  }
  function onPointerUp() {
    setDraggingTarget(false);
    setDraggingCam(false);
    setDraggingRotate(false);
  }

  // Azimut/élévation pour affichage
  const azimuth = eta_now; // même définition (Y vers le haut)
  const elevation = rad2deg(Math.atan2(dz, rxy));
  // angle écran (Y vers le bas) :
  const screenAngle = -azimuth; // en degrés
  const rectAngle = screenAngle + 90 + targetYaw; // rectangle jaune perpendiculaire + rotation utilisateur

  // --- Overlays: positions & panels for angle labels ---
  const camScreenX = viewW/2 + SLR_FL_X*scale;
  const camScreenY = viewH/2 - SLR_FL_Y*scale;
  const tgtScreenX = sx;
  const tgtScreenY = sy;

  const linesCam = [
    `α = ${alpha.toFixed(2)}°`,
    `β = ${beta.toFixed(2)}°`,
    `ε = ${(control!=="angles"?eps_now:eps).toFixed(2)}°`,
    `ζ = ${(control!=="angles"?zeta_now:zeta).toFixed(2)}°`,
    `π = ${piYr.toFixed(2)}°`,
    `η = ${eta_now.toFixed(2)}°`,
  ];
  const panelCamW = 190;
  const panelCamH = 18*linesCam.length + 12;

  const linesTgt = [
    `φ = ${azimuth.toFixed(2)}°`,
    `ψ = ${elevation.toFixed(2)}°`,
    `V = ${(control!=="angles"?V_now:V).toFixed(2)}`,
  ];
  const panelTgtW = 160;
  const panelTgtH = 18*linesTgt.length + 12;

  // valeurs affichage arcs
  const epsDisp = (control!=="angles"?eps_now:eps);
  const Rarc = 85; // rayon principal pour arcs α/ε/η
  const Rlab = 100; // rayon pour texte

  // pour β : centre D1c
  const d1cX = viewW/2 + D1Cx*scale;
  const d1cY = viewH/2 - D1Cy*scale;
  const Rbeta = 40;

  return (
    <div className="w-full min-h-screen bg-slate-100 py-4">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-2xl font-semibold mb-3">Mini simulation 3D – Cible & Caméra glissables (avec Excel)</h1>
        <p className="text-sm text-slate-600 mb-4">
          Trois modes : <b>Angles</b> (ε, ζ, V ⟶ position), <b>Cible</b> (drag du rectangle jaune ⟶ recalcul des angles) et <b>Caméra</b> (drag du point vert ⟶ recalcul des angles, cible fixe).<br/>
          NOUVEAU : arcs d'angles (α, ε, η, β) et rotation de la cible (poignée circulaire + curseur).
        </p>

        <div className="grid lg:grid-cols-2 gap-4 items-start">
          {/* Panneau de contrôle */}
          <div className="bg-white rounded-2xl shadow p-4 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm">Données :</span>
              <button
                className={`px-3 py-1.5 rounded-xl text-sm shadow ${mode==="manuel"?"bg-slate-900 text-white":"bg-slate-100"}`}
                onClick={()=>setMode("manuel")}>
                Manuel
              </button>
              <button
                className={`px-3 py-1.5 rounded-xl text-sm shadow ${mode==="fichier"?"bg-slate-900 text-white":"bg-slate-100"}`}
                onClick={()=>setMode("fichier")}>
                Fichier (Excel)
              </button>
              <div className="h-6 w-px bg-slate-300 mx-1"/>
              <span className="text-sm">Contrôle :</span>
              <button
                className={`px-3 py-1.5 rounded-xl text-sm shadow ${control==="angles"?"bg-indigo-600 text-white":"bg-slate-100"}`}
                onClick={()=>setControl("angles")}>
                Angles
              </button>
              <button
                className={`px-3 py-1.5 rounded-xl text-sm shadow ${control==="cible"?"bg-indigo-600 text-white":"bg-slate-100"}`}
                onClick={()=>setControl("cible")}>
                Cible (drag)
              </button>
              <button
                className={`px-3 py-1.5 rounded-xl text-sm shadow ${control==="camera"?"bg-indigo-600 text-white":"bg-slate-100"}`}
                onClick={()=>setControl("camera")}>
                Caméra (drag)
              </button>
            </div>

            {/* Import fichier */}
            <div className="space-y-2">
              <label className="flex flex-col text-sm">
                <span className="mb-1 font-medium">Charger CLCT.xlsx</span>
                <input type="file" accept=".xlsx,.xls" onChange={onFile} className="border rounded-md px-2 py-1" />
              </label>
              {rows.length>0 && (
                <div className="text-xs text-slate-600">{rows.length} lignes chargées · Colonnes: {columns.join(", ")}</div>
              )}
            </div>

            {/* Mapping colonnes → variables */}
            {columns.length>0 && (
              <div className="bg-slate-50 rounded-xl p-3 grid grid-cols-2 gap-3 text-sm">
                <h3 className="col-span-2 font-medium mb-1">Mapping colonnes</h3>
                <SelectRow label="FLRx" value={mapping.FLRx} options={columns} onChange={(v)=>setMapping((m)=>({...m, FLRx:v}))} />
                <SelectRow label="FLRy" value={mapping.FLRy} options={columns} onChange={(v)=>setMapping((m)=>({...m, FLRy:v}))} />
                <SelectRow label="D1L.x" value={mapping.D1Lx} options={columns} onChange={(v)=>setMapping((m)=>({...m, D1Lx:v}))} />
                <SelectRow label="D1R.x" value={mapping.D1Rx} options={columns} onChange={(v)=>setMapping((m)=>({...m, D1Rx:v}))} />
                <SelectRow label="D1c.y" value={mapping.D1Cy} options={columns} onChange={(v)=>setMapping((m)=>({...m, D1Cy:v}))} />
                <SelectRow label="D1c.z" value={mapping.D1Cz} options={columns} onChange={(v)=>setMapping((m)=>({...m, D1Cz:v}))} />
                <SelectRow label="β (symétrie) [°]" value={mapping.beta} options={columns} onChange={(v)=>setMapping((m)=>({...m, beta:v}))} />
                <SelectRow label="α drive [°]" value={mapping.alpha} options={columns} onChange={(v)=>setMapping((m)=>({...m, alpha:v}))} />
                <SelectRow label="ε(zr) [°]" value={mapping.eps} options={columns} onChange={(v)=>setMapping((m)=>({...m, eps:v}))} />
                <SelectRow label="ζ(xr) [°]" value={mapping.zeta} options={columns} onChange={(v)=>setMapping((m)=>({...m, zeta:v}))} />
                <SelectRow label="π(yr) [°]" value={mapping.piYr} options={columns} onChange={(v)=>setMapping((m)=>({...m, piYr:v}))} />
                <SelectRow label="V" value={mapping.V} options={columns} onChange={(v)=>setMapping((m)=>({...m, V:v}))} />
              </div>
            )}

            {/* Contrôle ligne et lecture */}
            {mode === "fichier" && rows.length>0 && (
              <div className="bg-slate-50 rounded-xl p-3 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <button className={`px-3 py-1.5 rounded-xl text-sm shadow ${playing?"bg-rose-600 text-white":"bg-emerald-600 text-white"}`} onClick={()=>setPlaying((p)=>!p)}>
                    {playing?"Pause":"Lecture"}
                  </button>
                  <div className="flex items-center gap-2">
                    <span>Vitesse:</span>
                    <input type="number" className="border rounded px-2 py-1 w-20" value={fps} onChange={(e)=>setFps(safeNum(e.target.value,4))} />
                    <span className="text-xs text-slate-500">images/s</span>
                  </div>
                </div>
                <div>
                  <input type="range" min={0} max={rows.length-1} step={1} value={rowIndex} onChange={(e)=>setRowIndex(Number(e.target.value))} className="w-full accent-blue-600" />
                  <div className="flex justify-between text-xs mt-1">
                    <span>0</span>
                    <span className="tabular-nums">{rowIndex}</span>
                    <span>{rows.length-1}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Paramètres manuels (toujours visibles pour ajustements fins) */}
            <div className="grid grid-cols-2 gap-3">
              <SliderRow label="FLRx" value={FLRx} onChange={setFLRx} min={-5000} max={5000} step={1} />
              <SliderRow label="FLRy" value={FLRy} onChange={setFLRy} min={-5000} max={5000} step={1} />
              <SliderRow label="D1L.x" value={D1Lx} onChange={setD1Lx} min={-10000} max={10000} step={0.001} />
              <SliderRow label="D1R.x" value={D1Rx} onChange={setD1Rx} min={-10000} max={10000} step={0.001} />
              <SliderRow label="D1c.y" value={D1Cy} onChange={setD1Cy} min={-5000} max={5000} step={1} />
              <SliderRow label="D1c.z" value={D1Cz} onChange={setD1Cz} min={-5000} max={5000} step={1} />
              <SliderRow label="β (symétrie) [°]" value={beta} onChange={setBeta} min={-180} max={180} step={0.01} />
              <SliderRow label="α drive [°]" value={alpha} onChange={setAlpha} min={-180} max={180} step={0.01} />
              <SliderRow label="ε(zr) [°]" value={eps} onChange={(v)=>{ setEps(v); if(control!=="angles"){ setControl("angles"); }}} min={-180} max={180} step={0.01} />
              <SliderRow label="ζ(xr) [°]" value={zeta} onChange={(v)=>{ setZeta(v); if(control!=="angles"){ setControl("angles"); }}} min={0} max={180} step={0.01} />
              <SliderRow label="π(yr) [°]" value={piYr} onChange={setPiYr} min={-180} max={180} step={0.01} />
              <SliderRow label="V" value={V} onChange={(v)=>{ setV(v); if(control!=="angles"){ setControl("angles"); }}} min={0} max={5000} step={1} />
              <SliderRow label="Échelle (px/unité)" value={scale} onChange={setScale} min={0.001} max={0.5} step={0.001} />
            </div>

            {(control === "cible" || control === "camera") && (
              <div className="bg-amber-50 rounded-xl p-3 text-sm mt-2">
                <h3 className="font-medium mb-1">Contrôle direct de la cible</h3>
                <div className="grid grid-cols-3 gap-2">
                  <div>Xt = <span className="tabular-nums font-semibold">{XtM.toFixed(3)}</span></div>
                  <div>Yt = <span className="tabular-nums font-semibold">{YtM.toFixed(3)}</span></div>
                  <div>Zt = <span className="tabular-nums font-semibold">{ZtM.toFixed(3)}</span></div>
                </div>
                <div className="mt-2">
                  <SliderRow label="Zt (glissière)" value={ZtM} onChange={setZtM} min={-5000} max={5000} step={1} />
                  <SliderRow label="Rotation cible [°]" value={targetYaw} onChange={setTargetYaw} min={-180} max={180} step={0.1} />
                  <div className="text-xs text-slate-600">Astuce : faites glisser le rectangle jaune dans le plan XY. La glissière règle Z. Utilisez la <b>poignée circulaire</b> au-dessus de la cible pour la faire pivoter finement.</div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm mt-2">
              <div className="bg-slate-50 rounded-xl p-3">
                <h3 className="font-medium mb-1">Intermédiaires</h3>
                <div className="space-y-1">
                  <div>D1c.x = <span className="tabular-nums">{D1Cx.toFixed(6)}</span></div>
                  <div>B = <span className="tabular-nums">{B.toFixed(3)}</span></div>
                  <div>Δ' = <span className="tabular-nums">{delta1.toFixed(3)}</span>°</div>
                  <div>Δ'' = <span className="tabular-nums">{delta2.toFixed(3)}</span>°</div>
                  <div>η = ε − α = <span className="tabular-nums">{eta_now.toFixed(3)}</span>°</div>
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <h3 className="font-medium mb-1">SLR.FL (base / Caméra)</h3>
                <div className="space-y-1">
                  <div>X = <span className="tabular-nums">{SLR_FL_X.toFixed(3)}</span></div>
                  <div>Y = <span className="tabular-nums">{SLR_FL_Y.toFixed(3)}</span></div>
                  <div>Z = <span className="tabular-nums">{SLR_FL_Z.toFixed(3)}</span></div>
                  <div className="text-xs text-slate-500">En mode « Caméra », glissez le point vert sur le plan XY. Z caméra via « D1c.z ».</div>
                </div>
              </div>
            </div>

            <div className="bg-emerald-50 rounded-xl p-3 text-sm mt-2">
              <h3 className="font-medium mb-1">Sorties (cible)</h3>
              <div className="grid grid-cols-3 gap-2">
                <div>Xt = <span className="tabular-nums font-semibold">{Xt.toFixed(3)}</span></div>
                <div>Yt = <span className="tabular-nums font-semibold">{Yt.toFixed(3)}</span></div>
                <div>Zt = <span className="tabular-nums font-semibold">{Zt.toFixed(3)}</span></div>
              </div>
            </div>

            <div className="bg-indigo-50 rounded-xl p-3 text-sm mt-2">
              <h3 className="font-medium mb-1">Angles (en direct)</h3>
              <div className="grid grid-cols-3 gap-2">
                <div>α (drive) = <span className="tabular-nums">{alpha.toFixed(3)}</span>°</div>
                <div>β (sym) = <span className="tabular-nums">{beta.toFixed(3)}</span>°</div>
                <div>ε(zr) = <span className="tabular-nums">{(control!=="angles"?eps_now:eps).toFixed(3)}</span>°</div>
                <div>ζ(xr) = <span className="tabular-nums">{(control!=="angles"?zeta_now:zeta).toFixed(3)}</span>°</div>
                <div>π(yr) = <span className="tabular-nums">{piYr.toFixed(3)}</span>°</div>
                <div>η = <span className="tabular-nums">{eta_now.toFixed(3)}</span>°</div>
                <div>φ (azimut cible) = <span className="tabular-nums">{azimuth.toFixed(3)}</span>°</div>
                <div>ψ (élévation cible) = <span className="tabular-nums">{elevation.toFixed(3)}</span>°</div>
                <div>V = <span className="tabular-nums">{(control!=="angles"?V_now:V).toFixed(3)}</span></div>
              </div>
            </div>

            <div className="flex gap-2 mt-2">
              <button
                className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-sm shadow"
                onClick={() => {
                  setFLRx(0); setFLRy(0);
                  setD1Lx(-4309.481443); setD1Rx(-4296.361317);
                  setD1Cy(0); setD1Cz(0);
                  setBeta(0); setAlpha(-21.11); setEps(0); setZeta(90); setPiYr(0);
                  setV(1000); setScale(0.05);
                  setViewW(980); setViewH(600);
                  setBgMode('cover'); setBgZoom(100); setBgPosX(50); setBgPosY(50);
                  setControl('angles'); setXtM(0); setYtM(0); setZtM(0); setTargetYaw(0);
                }}
              >
                Réinitialiser
              </button>
            </div>

            {/* Fond */}
            <div className="grid grid-cols-1 gap-2 text-sm mt-2">
              <label className="flex flex-col">
                <span className="mb-1 font-medium">URL du fond (image)</span>
                <input type="text" value={bgUrl} onChange={(e)=>setBgUrl(e.target.value)} placeholder="camion.png ou data:image/png;base64,..." className="border rounded-md px-2 py-1" />
              </label>
              <label className="flex flex-col">
                <span className="mb-1 font-medium">… ou choisir une image</span>
                <input type="file" accept="image/*" onChange={onBgFile} className="border rounded-md px-2 py-1" />
              </label>
              <div className="text-xs text-slate-500">
                Astuce : collez un <code>data:URI</code> (base64) pour intégrer directement l'image. Par défaut : <code>camion.png</code>.
              </div>

              {/* Contrôles d'ajustement du fond et de la vue */}
              <div className="h-px bg-slate-200 my-1" />
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col text-sm">
                  <span className="mb-1 font-medium">Mode d'ajustement</span>
                  <select value={bgMode} onChange={(e)=>setBgMode(e.target.value)} className="border rounded-md px-2 py-1">
                    <option value="cover">Remplir (cover)</option>
                    <option value="contain">Tout visible (contain)</option>
                    <option value="stretch">Étirement</option>
                    <option value="custom">Zoom (%)</option>
                  </select>
                </label>
                <div className="flex gap-2">
                  <label className="flex flex-col text-sm flex-1">
                    <span className="mb-1 font-medium">Largeur vue (px)</span>
                    <input type="number" value={viewW} onChange={(e)=>setViewW(safeNum(e.target.value, viewW))} className="border rounded-md px-2 py-1" />
                  </label>
                  <label className="flex flex-col text-sm flex-1">
                    <span className="mb-1 font-medium">Hauteur vue (px)</span>
                    <input type="number" value={viewH} onChange={(e)=>setViewH(safeNum(e.target.value, viewH))} className="border rounded-md px-2 py-1" />
                  </label>
                </div>
                {bgMode==="custom" && (
                  <div className="col-span-2">
                    <SliderRow label="Zoom fond (%)" value={bgZoom} min={10} max={300} step={1} onChange={setBgZoom} />
                  </div>
                )}
                <div className="col-span-2 grid grid-cols-2 gap-3">
                  <SliderRow label="Position X (%)" value={bgPosX} min={0} max={100} step={1} onChange={setBgPosX} />
                  <SliderRow label="Position Y (%)" value={bgPosY} min={0} max={100} step={1} onChange={setBgPosY} />
                </div>
              </div>
            </div>
          </div>

          {/* Zone de visualisation */}
          <div className="bg-white rounded-2xl shadow overflow-hidden">
            <div
              className="relative"
              style={{ width: viewW + 'px', height: viewH + 'px', backgroundImage: `url(${bgUrl})`, backgroundSize: bgSize, backgroundPosition: bgPos }}
            >
              <svg ref={svgRef} width={viewW} height={viewH} className="absolute inset-0"
                   onPointerMove={onPointerMove}
                   onPointerUp={onPointerUp}
                   onPointerCancel={onPointerUp}
                   onPointerLeave={onPointerUp}
              >
                {/* quadrillage */}
                <defs>
                  <pattern id="grid" width={50} height={50} patternUnits="userSpaceOnUse">
                    <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="1"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
                {/* Axes */}
                <line x1={viewW/2} y1="0" x2={viewW/2} y2={viewH} stroke="rgba(30,30,30,0.4)" strokeWidth="1.5"/>
                <line x1="0" y1={viewH/2} x2={viewW} y2={viewH/2} stroke="rgba(30,30,30,0.4)" strokeWidth="1.5"/>

                {/* Base SLR.FL / Caméra */}
                <g transform={`translate(${camScreenX}, ${camScreenY})`}>
                  <circle r={7} fill="rgba(16,185,129,0.95)"
                          style={{ cursor: control==="camera" ? (draggingCam?"grabbing":"grab") : "default" }}
                          onPointerDown={onPointerDownCam}
                  />
                  <text x={10} y={-10} fontSize="12" fill="black">Camera</text>

                  {/* RAYONS α et ε */}
                  {(() => {
                    const r = Rarc + 20;
                    const pAlpha = polarPointScreen(0, 0, r, alpha);
                    const pEps = polarPointScreen(0, 0, r, epsDisp);
                    return (
                      <g>
                        {/* rayon α */}
                        <line x1={0} y1={0} x2={pAlpha.x} y2={pAlpha.y} stroke="rgba(99,102,241,0.9)" strokeWidth="2" />
                        <text x={pAlpha.x} y={pAlpha.y} fontSize="12" fill="black" dx={6} dy={-6}>α</text>
                        {/* rayon ε */}
                        <line x1={0} y1={0} x2={pEps.x} y2={pEps.y} stroke="rgba(2,132,199,0.9)" strokeWidth="2" />
                        <text x={pEps.x} y={pEps.y} fontSize="12" fill="black" dx={6} dy={-6}>ε</text>
                        {/* arc η = ε - α */}
                        <path d={arcPathShortest(0, 0, Rarc, alpha, epsDisp)} fill="none" stroke="rgba(234,179,8,0.95)" strokeWidth="3" />
                        {(() => { const m = arcMidPointWorld(0,0,Rlab, alpha, epsDisp); return <text x={m.x} y={m.y} fontSize="12" fill="black">η</text>; })()}
                      </g>
                    );
                  })()}
                </g>

                {/* Vecteur base→cible */}
                <line x1={camScreenX} y1={camScreenY} x2={sx} y2={sy} stroke="rgba(2,132,199,0.7)" strokeWidth="2" />

                {/* Arc β autour de D1c */}
                <g transform={`translate(${d1cX}, ${d1cY})`}>
                  {/* rayon 0° */}
                  <line x1={0} y1={0} x2={Rbeta} y2={0} stroke="rgba(30,41,59,0.6)" strokeWidth="1.5" />
                  {/* rayon β */}
                  {(() => {
                    const pB = polarPointScreen(0,0,Rbeta, beta);
                    return (
                      <>
                        <line x1={0} y1={0} x2={pB.x} y2={pB.y} stroke="rgba(30,41,59,0.9)" strokeWidth="2" />
                        <path d={arcPathShortest(0,0,Rbeta-8, 0, beta)} fill="none" stroke="rgba(30,41,59,0.9)" strokeWidth="2" />
                        {(() => { const m = arcMidPointWorld(0,0,Rbeta+10, 0, beta); return <text x={m.x} y={m.y} fontSize="12" fill="black">β</text>; })()}
                      </>
                    );
                  })()}
                </g>

                {/* Cible : rectangle jaune glissable + poignée de rotation */}
                <g transform={`translate(${sx},${sy}) rotate(${rectAngle})`}>
                  <rect x={-targetPxW/2} y={-targetPxH/2} width={targetPxW} height={targetPxH}
                        fill="#facc15" stroke="none"
                        onPointerDown={onPointerDownTarget}
                        style={{ cursor: (control==="cible"||control==="camera") ? (draggingTarget?"grabbing":"grab") : "default" }}
                  />
                  {/* poignée de rotation */}
                  <line x1={0} y1={-targetPxH/2} x2={0} y2={-(targetPxH/2+18)} stroke="rgba(0,0,0,0.5)" strokeWidth="2" />
                  <circle cx={0} cy={-(targetPxH/2+26)} r={6} fill="white" stroke="rgba(0,0,0,0.7)" strokeWidth="2"
                          onPointerDown={onPointerDownRotate}
                          style={{ cursor: "grab" }}
                  />
                </g>

                {/* Panneaux d'angles (live) */}
                <g transform={`translate(${camScreenX + 12}, ${camScreenY - panelCamH - 12})`} pointerEvents="none">
                  <rect x="0" y="0" width={panelCamW} height={panelCamH} rx="8" fill="rgba(255,255,255,0.8)" />
                  {linesCam.map((t,i)=> (<text key={i} x={10} y={20 + i*18} fontSize="12" fill="black">{t}</text>))}
                </g>

                <g transform={`translate(${tgtScreenX + 12}, ${tgtScreenY + 12})`} pointerEvents="none">
                  <rect x="0" y="0" width={panelTgtW} height={panelTgtH} rx="8" fill="rgba(255,255,255,0.8)" />
                  {linesTgt.map((t,i)=> (<text key={i} x={10} y={20 + i*18} fontSize="12" fill="black">{t}</text>))}
                </g>
              </svg>
            </div>
            <div className="p-3 text-xs text-slate-600 flex flex-col sm:flex-row sm:justify-between gap-2">
              <div>Plan : XY (Y vers le haut) – Z cible via glissière, Z caméra via « D1c.z ».</div>
              <div>Échelle : <span className="tabular-nums">{scale}</span> px/unité</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
