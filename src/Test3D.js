import * as React from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Line } from "@react-three/drei";

/*****
 * Version MINIMALE & STABLE (pas d'Excel, pas de drag) ✅
 * - Monde: XY = sol, Z = vertical
 * - β : rotation du repère FLR autour de Z au point D1c (position de la base)
 * - η = ε − α (yaw autour de Z)
 * - ζ(xr) : rotation autour de l'axe local x_r (Rx), 
 * - V : distance base→cible
 *
 * Direction du rayon (rigoureuse): r = Rz(η)·Rx(ζ)·[0,0,1]
 *   ⇒ r = [ sinζ·sinη ,  -sinζ·cosη ,  cosζ ]
 *   ⇒ Xt = X0 + V * sinζ * sinη
 *      Yt = Y0 + V * ( - sinζ * cosη )
 *      Zt = Z0 + V * cosζ
 *
 * Rendu three: on mappe (X,Y,Z)_monde → (x,z,y)_three pour avoir Z monde vertical.
 *****/

function deg2rad(d){ return (d*Math.PI)/180; }
function rad2deg(r){ return (r*180)/Math.PI; }

// mapping monde (X,Y,Z) -> three (x,z,y)
const w2t = (x,y,z) => new THREE.Vector3(x, z, y);

function SliderRow({ label, value, min=-5000, max=5000, step=1, onChange, unit='' }){
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums">{Number(value).toFixed(3)} {unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e)=>onChange(parseFloat(e.target.value))} className="w-full accent-blue-600" />
      <input type="number" value={value} onChange={(e)=>onChange(parseFloat(e.target.value))} className="w-full border rounded-md px-2 py-1 text-xs" />
    </div>
  );
}

function Scene3D({ D1Cx, D1Cy, baseX, baseY, baseZ, Xt, Yt, Zt }){
  // positions three
  const basePos = w2t(baseX, baseY, baseZ);
  const targPos = w2t(Xt, Yt, Zt);

  // rayon (un gizmo simple)
  const points = React.useMemo(()=>[basePos.clone(), targPos.clone()], [basePos, targPos]);

  // billboard: plan orienté selon la direction base→cible
  const billboardQuat = React.useMemo(()=>{
    const dirWorld = new THREE.Vector3(Xt-baseX, Yt-baseY, Zt-baseZ);
    if(dirWorld.lengthSq() === 0) return new THREE.Quaternion();
    const dirThree = w2t(dirWorld.x, dirWorld.y, dirWorld.z).normalize();
    // aligner la normale (0,0,1) three vers dirThree
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0,0,1), dirThree);
    return q;
  },[Xt,Yt,Zt,baseX,baseY,baseZ]);

  return (
    <>
      <Grid args={[40, 40]} cellSize={0.5} cellThickness={0.3} sectionThickness={1} sectionColor="#94a3b8" cellColor="#e2e8f0" fadeDistance={60} infiniteGrid position={[0,0,0]} />
      <axesHelper args={[2]} />

      {/* D1c */}
      <mesh position={w2t(D1Cx, D1Cy, baseZ)}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial color="#334155" />
      </mesh>

      {/* Base (caméra) */}
      <mesh position={basePos}>
        <sphereGeometry args={[0.08, 24, 24]} />
        <meshStandardMaterial color="#10b981" />
      </mesh>

      {/* Cible */}
      <group position={targPos}>
        <mesh quaternion={billboardQuat}>
          <planeGeometry args={[0.9, 0.16]} />
          <meshStandardMaterial color="#facc15" />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshStandardMaterial color="#eab308" />
        </mesh>
      </group>

      {/* Rayon */}
      <Line points={points} color="#0284c7" lineWidth={2} />
    </>
  );
}

export default function Simulation3D(){
  const [control, setControl] = React.useState('angles'); // simple: pas de drag

  // Offsets FLR et D1L/D1R (monde)
  const [FLRx, setFLRx] = React.useState(5638);
  const [FLRy, setFLRy] = React.useState(0);
  const [FLRz, setFLRz] = React.useState(0);

  const [D1Lx, setD1Lx] = React.useState(-4300);
  const [D1Ly, setD1Ly] = React.useState(1245);
  const [D1Rx, setD1Rx] = React.useState(-4300);
  const [D1Ry, setD1Ry] = React.useState(-1255);

  const [alpha, setAlpha] = React.useState(0);
  const [eps, setEps] = React.useState(0);
  const [zeta, setZeta] = React.useState(90); // ζ(xr)
  const [beta, setBeta] = React.useState(0);
  const [V, setV] = React.useState(1000);

  // Cible directe si besoin (non utilisée ici mais conservée pour évolution)
  const [XtM] = React.useState(0);
  const [YtM] = React.useState(0);
  const [ZtM] = React.useState(0);

  // Intermédiaires géométrie
  const D1Cx = D1Lx + (D1Rx - D1Lx)/2;
  const D1Cy = D1Ly + (D1Ry - D1Ly)/2;

  const betaRad = deg2rad(beta);
  const cosb = Math.cos(betaRad), sinb = Math.sin(betaRad);

  // Position base (caméra) : rotation de (FLRx,FLRy) autour de Z, centrée en D1c
  const baseX = D1Cx + (FLRx * cosb - FLRy * sinb);
  const baseY = D1Cy + (FLRx * sinb + FLRy * cosb);
  const baseZ = FLRz;

  // Angles du rayon
  const eta = eps - alpha; // yaw
  const etaRad = deg2rad(eta);
  const zetaRad = deg2rad(zeta); // Rx(ζ)

  // Direction r = [sζ·sη, -sζ·cη, cζ]
  const cη = Math.cos(etaRad), sη = Math.sin(etaRad);
  const cζ = Math.cos(zetaRad), sζ = Math.sin(zetaRad);
  const rx = sζ * sη;
  const ry = -sζ * cη;
  const rz = cζ;

  // Cible (mode angles uniquement pour cette version simple)
  const Xt = baseX + V*rx;
  const Yt = baseY + V*ry;
  const Zt = baseZ + V*rz;

  // Petites vérifications runtime (console)
  React.useEffect(()=>{
    const n = Math.hypot(rx, ry, rz);
    console.assert(Math.abs(n-1) < 1e-6, '[TEST] |r|-1 ≈ 0 échoué', n);
    const dx = Xt-baseX, dy = Yt-baseY, dz = Zt-baseZ;
    const Vdir = Math.hypot(dx,dy,dz);
    console.assert(Math.abs(Vdir - V) < 1e-6, '[TEST] ||base→cible|| - V ≈ 0 échoué');
  },[rx,ry,rz,V,Xt,Yt,Zt,baseX,baseY,baseZ]);

  return (
    <div className="w-full min-h-screen bg-slate-100 py-4">
      <div className="max-w-[2200px] mx-auto px-4">
        <h1 className="text-2xl font-semibold mb-3">Simulation 3D – Caméra & Cible (version minimale)</h1>
        <p className="text-sm text-slate-600 mb-4">Modèle: r = Rz(η)·Rx(ζ)·[0,0,1], η = ε − α. Pas d'import, pas de drag pour l'instant.</p>

        <div className="flex gap-4 items-start">
          {/* Panneau de contrôle */}
          <div className="bg-white rounded-2xl shadow p-4 space-y-3 w-[360px] shrink-0 text-xs">
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span>Contrôle :</span>
              <button className={`px-3 py-1.5 rounded-xl text-xs shadow ${control==='angles'?"bg-slate-900 text-white":"bg-slate-100"}`} onClick={()=>setControl('angles')}>Angles</button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <SliderRow label="FLRx" value={FLRx} onChange={setFLRx} min={-10000} max={10000} step={0.001} />
              <SliderRow label="FLRy" value={FLRy} onChange={setFLRy} min={-10000} max={10000} step={0.001} />
              <SliderRow label="FLRz" value={FLRz} onChange={setFLRz} min={-5000} max={5000} step={0.001} />

              <SliderRow label="D1Lx" value={D1Lx} onChange={setD1Lx} min={-10000} max={10000} step={0.001} />
              <SliderRow label="D1Ly" value={D1Ly} onChange={setD1Ly} min={-10000} max={10000} step={0.001} />
              <SliderRow label="D1Rx" value={D1Rx} onChange={setD1Rx} min={-10000} max={10000} step={0.001} />
              <SliderRow label="D1Ry" value={D1Ry} onChange={setD1Ry} min={-10000} max={10000} step={0.001} />

              <SliderRow label="β (sym) [°]" value={beta} onChange={setBeta} min={-180} max={180} step={0.01} />
              <SliderRow label="α drive [°]" value={alpha} onChange={setAlpha} min={-180} max={180} step={0.01} />
              <SliderRow label="ε(zr) [°]" value={eps} onChange={setEps} min={-180} max={180} step={0.01} />
              <SliderRow label="ζ(xr) [°]" value={zeta} onChange={setZeta} min={0} max={180} step={0.01} />
              <SliderRow label="V" value={V} onChange={setV} min={0} max={5000} step={0.001} />
            </div>

            {/* Intermédiaires */}
            <div className="grid grid-cols-1 gap-2 text-[11px] mt-1">
              <div className="bg-slate-50 rounded-xl p-2">
                <div>D1c = (<span className="tabular-nums">{D1Cx.toFixed(3)}</span>, <span className="tabular-nums">{D1Cy.toFixed(3)}</span>)</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-2">
                <div>Base = (<span className="tabular-nums">{baseX.toFixed(3)}</span>, <span className="tabular-nums">{baseY.toFixed(3)}</span>, <span className="tabular-nums">{baseZ.toFixed(3)}</span>)</div>
              </div>
              <div className="bg-indigo-50 rounded-xl p-2">
                <div>η = ε − α = <span className="tabular-nums">{(eps-alpha).toFixed(3)}</span>° · ζ = <span className="tabular-nums">{zeta.toFixed(3)}</span>° · V = <span className="tabular-nums">{V.toFixed(3)}</span></div>
              </div>
            </div>

            {/* Sorties */}
            <div className="bg-amber-50 rounded-xl p-3 text-[11px] flex flex-col gap-2">
              <div className="font-medium text-amber-900">Sorties (monde):</div>
              <div className="grid grid-cols-3 gap-2">
                <div>Xt = <span className="tabular-nums font-mono">{Xt.toFixed(3)}</span></div>
                <div>Yt = <span className="tabular-nums font-mono">{Yt.toFixed(3)}</span></div>
                <div>Zt = <span className="tabular-nums font-mono">{Zt.toFixed(3)}</span></div>
              </div>
            </div>

            {/* Réinit */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <button className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs shadow" onClick={()=>{
                setFLRx(5638); setFLRy(0); setFLRz(0);
                setD1Lx(-4300); setD1Ly(1245); setD1Rx(-4300); setD1Ry(-1255);
                setBeta(0); setAlpha(0); setEps(0); setZeta(90); setV(1000);
              }}>Réinitialiser</button>
            </div>
          </div>

          {/* Vue 3D */}
          <div className="bg-white rounded-2xl shadow overflow-hidden flex-1">
            <div className="relative" style={{ width: '100%', height: 700 }}>
              <Canvas camera={{ position: [6, 4, 6], fov: 45 }} dpr={[1, 2]}>
                <ambientLight intensity={0.6} />
                <directionalLight position={[5, 8, 4]} intensity={0.8} />

                <Scene3D D1Cx={D1Cx} D1Cy={D1Cy} baseX={baseX} baseY={baseY} baseZ={baseZ} Xt={Xt} Yt={Yt} Zt={Zt} />

                <OrbitControls makeDefault />
              </Canvas>
            </div>
            <div className="p-3 text-[11px] text-slate-600 flex flex-wrap gap-4">
              <div>Axes monde : X (→), Y (sol), Z (vertical).</div>
              <div>Conversion interne : three(x,z,y) = monde(X,Y,Z).</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
