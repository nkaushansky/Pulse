/* ---------------- three.js scene ---------------- */
const R = CONFIG.tunnelRadius;
let SPEED = CONFIG.speed;        // per-song override via meta.overrides.speed
const HIT_Z = CONFIG.hitZ;
const LANE_X = [-1.6, 0, 1.6];
const WALL_W = 4.8;

let renderer, scene, camera, tunnelGroup;
const wallRender = [];   // per-wall render data, indexed by wall id
const gemGeo = new THREE.OctahedronGeometry(0.34);
const gemMats = { bright:[], dim:[], miss:null };

function initScene(){
  renderer = new THREE.WebGLRenderer({ antialias:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById('scene').appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000004);
  scene.fog = new THREE.Fog(0x000004, 28, 140);

  camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 300);
  camera.position.set(0, 0, 0);
  camera.lookAt(0, -2.2, -30);

  tunnelGroup = new THREE.Group();
  scene.add(tunnelGroup);

  // gem materials: 3 lane colors x bright/dim, plus miss-grey
  for (let l = 0; l < 3; l++){
    gemMats.bright.push(new THREE.MeshBasicMaterial({
      color: LANE_COLORS[l], transparent:true, opacity:0.95,
      blending: THREE.AdditiveBlending, depthWrite:false }));
    gemMats.dim.push(new THREE.MeshBasicMaterial({
      color: LANE_COLORS[l], transparent:true, opacity:0.22,
      blending: THREE.AdditiveBlending, depthWrite:false }));
  }
  gemMats.miss = new THREE.MeshBasicMaterial({
    color: 0x39394a, transparent:true, opacity:0.35, depthWrite:false });

  buildRings();                  // walls are per-song: built by selectSong()
  window.addEventListener('resize', onResize);
}

function onResize(){
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function wallAngle(w){ return w * Math.PI / 4; }

/* Tear down the current song's walls (depth rings persist). Gem meshes
   use the shared geometry/materials, which must survive; everything
   else here was created per-build and is disposed for real. */
function disposeWalls(){
  for (const wr of wallRender){
    if (!wr) continue;
    wr.group.traverse(o => {
      if (o.geometry && o.geometry !== gemGeo) o.geometry.dispose();
      if (o.material && o.material !== gemMats.miss &&
          gemMats.bright.indexOf(o.material) < 0 &&
          gemMats.dim.indexOf(o.material) < 0){
        o.material.dispose();
      }
    });
    tunnelGroup.remove(wr.group);
  }
  wallRender.length = 0;
}

function rebuildWalls(song){
  if (!tunnelGroup) return;      // boot order guard: scene not up yet
  disposeWalls();
  buildWalls(song);
}

function buildWalls(song){
  const trackByWall = {};
  for (const tr of song.tracks) trackByWall[tr.wall] = tr;

  for (let w = 0; w < WALL_COUNT; w++){
    const grp = new THREE.Group();
    grp.rotation.z = wallAngle(w);
    tunnelGroup.add(grp);
    const tr = trackByWall[w] || null;
    const wr = { group:grp, track:tr, plane:null, hitLine:null, flashes:[], laneLines:[],
                 zoneBand:null, perfectBand:null, receptors:[] };
    wallRender[w] = wr;
    if (tr) tr._wr = wr;

    if (!tr){
      // empty wall: faint edge hints only
      const m = new THREE.LineBasicMaterial({ color:0x141a28, transparent:true, opacity:0.6 });
      for (const x of [-WALL_W/2, WALL_W/2]){
        const geo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x, -R, 3), new THREE.Vector3(x, -R, -140)]);
        grp.add(new THREE.Line(geo, m));
      }
      continue;
    }

    // backing plane (lies in XZ at y=-R, facing inward)
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(WALL_W, 150),
      new THREE.MeshBasicMaterial({ color: tr.color, transparent:true,
        opacity:0.05, depthWrite:false, side:THREE.DoubleSide }));
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(0, -R - 0.02, -68);
    grp.add(plane);
    wr.plane = plane;

    // lane grid lines
    const lineMat = new THREE.LineBasicMaterial({ color: tr.color, transparent:true, opacity:0.3 });
    for (const x of [-2.4, -0.8, 0.8, 2.4]){
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x, -R, 3), new THREE.Vector3(x, -R, -140)]);
      const ln = new THREE.Line(geo, lineMat.clone());
      grp.add(ln);
      wr.laneLines.push(ln);
    }

    // now-line at the hit zone
    const hl = new THREE.Mesh(
      new THREE.PlaneGeometry(WALL_W, 0.18),
      new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true,
        opacity:0.35, blending:THREE.AdditiveBlending, depthWrite:false,
        side:THREE.DoubleSide }));
    hl.rotation.x = -Math.PI / 2;
    hl.position.set(0, -R + 0.02, HIT_Z);
    grp.add(hl);
    wr.hitLine = hl;

    // hit-zone band: physical depth of the ±HIT_WINDOW timing window
    const zb = new THREE.Mesh(
      new THREE.PlaneGeometry(WALL_W, HIT_WINDOW * 2 * SPEED),
      new THREE.MeshBasicMaterial({ color: tr.color, transparent:true,
        opacity:0.10, blending:THREE.AdditiveBlending, depthWrite:false,
        side:THREE.DoubleSide }));
    zb.rotation.x = -Math.PI / 2;
    zb.position.set(0, -R + 0.012, HIT_Z);
    grp.add(zb);
    wr.zoneBand = zb;

    // brighter inner strip: the ±PERFECT_WINDOW
    const pb = new THREE.Mesh(
      new THREE.PlaneGeometry(WALL_W, PERFECT_WINDOW * 2 * SPEED),
      new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true,
        opacity:0.08, blending:THREE.AdditiveBlending, depthWrite:false,
        side:THREE.DoubleSide }));
    pb.rotation.x = -Math.PI / 2;
    pb.position.set(0, -R + 0.016, HIT_Z);
    grp.add(pb);
    wr.perfectBand = pb;

    // lane target circles at gem height: gem is hittable when inside,
    // perfect when centered
    for (let l = 0; l < 3; l++){
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.50, 0.68, 40),
        new THREE.MeshBasicMaterial({ color: LANE_COLORS[l], transparent:true,
          opacity:0.9, blending:THREE.AdditiveBlending, depthWrite:false,
          side:THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(LANE_X[l], -R + 0.4, HIT_Z);
      grp.add(ring);
      const fill = new THREE.Mesh(
        new THREE.CircleGeometry(0.50, 40),
        new THREE.MeshBasicMaterial({ color: LANE_COLORS[l], transparent:true,
          opacity:0.06, blending:THREE.AdditiveBlending, depthWrite:false,
          side:THREE.DoubleSide }));
      fill.rotation.x = -Math.PI / 2;
      fill.position.set(LANE_X[l], -R + 0.37, HIT_Z);
      grp.add(fill);
      const dot = new THREE.Mesh(
        new THREE.CircleGeometry(0.07, 16),
        new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true,
          opacity:0.7, blending:THREE.AdditiveBlending, depthWrite:false,
          side:THREE.DoubleSide }));
      dot.rotation.x = -Math.PI / 2;
      dot.position.set(LANE_X[l], -R + 0.38, HIT_Z);
      grp.add(dot);
      wr.receptors.push({ ring, fill, dot, pop:0 });
    }

    // per-lane hit flashes
    for (let l = 0; l < 3; l++){
      const fl = new THREE.Mesh(
        new THREE.PlaneGeometry(1.45, 3.2),
        new THREE.MeshBasicMaterial({ color: LANE_COLORS[l], transparent:true,
          opacity:0, blending:THREE.AdditiveBlending, depthWrite:false,
          side:THREE.DoubleSide }));
      fl.rotation.x = -Math.PI / 2;
      fl.position.set(LANE_X[l], -R + 0.03, HIT_Z);
      grp.add(fl);
      wr.flashes.push(fl);
    }

    // gem pool + live set live on the track; meshes from a previous
    // selection of this song died with their wall group — drop the refs
    tr._pool = [];
    tr._live = new Set();
    tr._spawnPtr = 0;
    for (const gem of tr._gems) gem.mesh = null;
  }
}

function buildRings(){
  // octagon depth rings (flat-bottom orientation: vertices at 22.5° + k*45°)
  const Rv = R / Math.cos(Math.PI / 8);
  const pts = [];
  for (let k = 0; k < 8; k++){
    const a = Math.PI / 8 + k * Math.PI / 4;
    pts.push(new THREE.Vector3(Rv * Math.cos(a), Rv * Math.sin(a), 0));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  for (let i = 0; i < 14; i++){
    const ring = new THREE.LineLoop(geo,
      new THREE.LineBasicMaterial({ color:0x1b2840, transparent:true, opacity:0.8 }));
    ring.position.z = -4 - i * 10;
    tunnelGroup.add(ring);
  }
}

function getGemMesh(tr){
  let m = tr._pool.pop();
  if (!m){
    m = new THREE.Mesh(gemGeo, gemMats.bright[0]);
    tr._wr.group.add(m);
  }
  m.visible = true;
  return m;
}
function releaseGemMesh(tr, gem){
  if (!gem.mesh) return;
  gem.mesh.visible = false;
  tr._pool.push(gem.mesh);
  tr._live.delete(gem);
  gem.mesh = null;
}

function gemMaterial(tr, gem){
  if (gem.missed) return gemMats.miss;
  const active = SONG.tracks[G.activeIdx] === tr;
  return (active ? gemMats.bright : gemMats.dim)[gem.lane];
}

function isCaptured(tr, phrase){
  return tr.capturedUntilPhrase !== null && phrase <= tr.capturedUntilPhrase;
}

/* spawn / cull / position gems for one track */
function updateTrackGems(tr, now){
  // spawn
  while (tr._spawnPtr < tr._gems.length){
    const gem = tr._gems[tr._spawnPtr];
    if (gem.time - now > CONFIG.spawnAhead) break;
    tr._spawnPtr++;
    if (gem.hit || isCaptured(tr, gem.phrase)) continue;
    const mesh = getGemMesh(tr);
    mesh.material = gemMaterial(tr, gem);
    mesh.position.set(LANE_X[gem.lane], -R + 0.4, HIT_Z - (gem.time - now) * SPEED);
    gem.mesh = mesh;
    tr._live.add(gem);
  }
  // position / cull
  for (const gem of tr._live){
    if (gem.hit || isCaptured(tr, gem.phrase)){ releaseGemMesh(tr, gem); continue; }
    const z = HIT_Z - (gem.time - now) * SPEED;
    if (z > -0.6){ releaseGemMesh(tr, gem); continue; }
    gem.mesh.position.z = z;
    gem.mesh.rotation.y += 0.05;
    gem.mesh.rotation.z += 0.02;
  }
}

function refreshGemMaterials(){
  for (const tr of SONG.tracks){
    for (const gem of tr._live){
      if (gem.mesh) gem.mesh.material = gemMaterial(tr, gem);
    }
  }
}

/* tunnel rotation tween */
const rotAnim = { active:false, from:0, to:0, t0:0 };
function rotateTunnelTo(wall){
  let to = -wallAngle(wall);
  const cur = tunnelGroup.rotation.z;
  while (to - cur > Math.PI)  to -= Math.PI * 2;
  while (to - cur < -Math.PI) to += Math.PI * 2;
  rotAnim.active = true;
  rotAnim.from = cur;
  rotAnim.to = to;
  rotAnim.t0 = performance.now();
}

function updateWallVisuals(now, pulse){
  const phrase = Math.max(0, Math.floor(now / PHRASE_SEC));
  for (let w = 0; w < WALL_COUNT; w++){
    const wr = wallRender[w];
    if (!wr.track) continue;
    const tr = wr.track;
    const active = SONG.tracks[G.activeIdx] === tr;
    const captured = isCaptured(tr, phrase);
    wr.plane.material.opacity = captured ? 0.18 + 0.16 * pulse : (active ? 0.11 : 0.05);
    wr.hitLine.material.opacity = active ? 0.7 + 0.3 * pulse : 0.18;
    wr.zoneBand.material.opacity = captured ? 0 : (active ? 0.10 + 0.08 * pulse : 0.03);
    wr.perfectBand.material.opacity = captured ? 0 : (active ? 0.10 + 0.10 * pulse : 0.02);
    const recScale = active ? 1 + 0.10 * pulse : 0.92;
    for (let l = 0; l < wr.receptors.length; l++){
      const rec = wr.receptors[l];
      const vis = !captured;
      rec.ring.visible = vis; rec.fill.visible = vis; rec.dot.visible = vis;
      const prevPop = rec.pop;
      rec.pop = Math.max(0, rec.pop - 0.07);
      if (prevPop > 0 && rec.pop === 0){
        rec.fill.material.color.setHex(LANE_COLORS[l]);
        rec.ring.material.color.setHex(LANE_COLORS[l]);
      }
      const s = recScale + 0.35 * rec.pop;
      rec.ring.scale.setScalar(s);
      rec.fill.scale.setScalar(s);
      rec.ring.material.opacity = active ? 0.85 + 0.15 * pulse : 0.18;
      rec.fill.material.opacity = (active ? 0.05 + 0.07 * pulse : 0.02) + 0.45 * rec.pop;
      rec.dot.material.opacity = active ? 0.6 : 0.12;
    }
    const lineOp = captured ? 0.55 + 0.3 * pulse : (active ? 0.5 : 0.22);
    for (const ln of wr.laneLines) ln.material.opacity = lineOp;
    for (const fl of wr.flashes){
      if (fl.material.opacity > 0) fl.material.opacity = Math.max(0, fl.material.opacity - 0.06);
    }
  }
}

