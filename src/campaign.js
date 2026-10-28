import * as THREE from "three";
import { createSoldier } from "./soldier.js";
import { createEnvironmentTextures } from "./environmentTextures.js";
import {
  MISSIONS,
  missionWalls,
  interactMission,
  blocked,
} from "../shared/campaign.js";
export function createCampaign({
  scene,
  obstacles,
  player,
  onDamage,
  onReset,
  message,
  tracer,
}) {
  const textures=createEnvironmentTextures();
  const baseColliders=[...obstacles];
  const baseWorld=scene.children.filter(o=>!o.isLight && o!==player);
  const group = new THREE.Group();
  scene.add(group);
  group.visible = false;
  let state = { index: 0, status: "inactive", intel: false },
    enemies = [],
    colliders = [],
    time = 0,
    exit = () => {},
    beacon;
  const ray = new THREE.Raycaster(),
    panel = document.createElement("section");
  panel.id = "missionPanel";
  panel.hidden = true;
  panel.innerHTML =
    '<small>SHADOWSTRIKE / FIELD OPERATIONS</small><h2></h2><p class="brief"></p><p class="objective"></p><canvas class="radar" width="280" height="150" aria-label="Tactical map: blue player, red guards, green terminal, cyan extraction"></canvas><p>E interact • V camera • Esc release cursor</p><button class="next" hidden>NEXT OPERATION</button><button class="retry">RESTART MISSION</button><button class="exit">RETURN TO MENU</button>';
  document.body.append(panel);
  const failure = document.createElement("section");
  failure.id = "missionFailure";
  failure.hidden = true;
  failure.setAttribute("role", "dialog");
  failure.setAttribute("aria-modal", "true");
  failure.setAttribute("aria-labelledby", "missionFailureTitle");
  failure.innerHTML = '<div class="failure-card"><h1 id="missionFailureTitle">MISSION FAILED</h1><p>Your health reached zero. Regroup and try again.</p><button class="restart">RESTART MISSION</button><button class="menu">BACK TO MAIN MENU</button></div>';
  document.body.append(failure);
  failure.querySelector(".restart").onclick = () => start(state.index);
  failure.querySelector(".menu").onclick = () => exit();
  const q = (s) => panel.querySelector(s);
  q(".retry").onclick = () => start(state.index);
  q(".next").onclick = () => start((state.index + 1) % 3);
  q(".exit").onclick = () => exit();
  function mesh(geo, color, x, y, z) {
    const o = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color, roughness: 0.8 }),
    );
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    group.add(o);
    return o;
  }
  function cleanup() {
    for (const o of colliders) {
      const i = obstacles.indexOf(o);
      if (i >= 0) obstacles.splice(i, 1);
    }
    colliders = [];
    enemies = [];
    const gs = new Set(),
      ms = new Set();
    group.traverse((o) => {
      if (o.geometry) gs.add(o.geometry);
      if (o.material) ms.add(o.material);
    });
    gs.forEach((g) => g.dispose());
    ms.forEach((m) => {if(m.map?.isCanvasTexture && !Object.values(textures).includes(m.map))m.map.dispose();m.dispose();});
    group.clear();
  }
  function start(index = 0) {
    cleanup();
    obstacles.length=0;
    for(const o of baseWorld)o.visible=false;
    failure.hidden = true;
    state = { index, status: "active", intel: false, step:0 };
    time = 0;
    group.visible = true;
    panel.hidden = false;
    const m = MISSIONS[index];
    const floor=mesh(new THREE.PlaneGeometry(230,230),index===1?0x5a655a:0x8a8061,0,-.02,0);floor.rotation.x=-Math.PI/2;floor.material.map=textures.ground;floor.material.color.set(0xffffff);
    const treeGeometry=new THREE.ConeGeometry(2.7,9,7),treeMaterial=new THREE.MeshStandardMaterial({color:0x42533c});
    const trees=new THREE.InstancedMesh(treeGeometry,treeMaterial,100),dummy=new THREE.Object3D();
    for(let n=0;n<100;n++){const angle=n/100*Math.PI*2,r=118+(n%7)*2;dummy.position.set(Math.cos(angle)*r,4.5,Math.sin(angle)*r);dummy.scale.setScalar(1+(n%4)*.18);dummy.updateMatrix();trees.setMatrixAt(n,dummy.matrix);}group.add(trees);
    for(let n=0;n<m.sites.length-1;n++){
      const [ax,az]=m.sites[n],[bx,bz]=m.sites[n+1],length=Math.hypot(bx-ax,bz-az);
      const road=mesh(new THREE.PlaneGeometry(5,length),0x727366,(ax+bx)/2,.005,(az+bz)/2);road.rotation.x=-Math.PI/2;road.rotation.z=-Math.atan2(bx-ax,bz-az);
    }
    for(let i=0;i<m.sites.length;i++){
    const [x,z]=m.sites[i], objective=m.steps[i].position;
    // Every installation is entered through a real doorway and interior passage.

    for (const [a, b, w, h, d] of missionWalls([x,z])) {
      const o = {
        x: a,
        z: b,
        w,
        h,
        d,
        mesh: mesh(new THREE.BoxGeometry(w, h, d), 0x8c927d, a, h / 2, b),
      };
      o.mesh.material.map=textures.concrete;
      obstacles.push(o);
      colliders.push(o);
    }
    mesh(new THREE.BoxGeometry(10, 0.08, 8), 0x55594f, x, 0.04, z);
    mesh(new THREE.BoxGeometry(10.4, 0.16, 8.4), 0x343c35, x, 3.6, z);
    mesh(
      new THREE.BoxGeometry(1.3, 0.9, 0.65),
      0x394a40,
      objective[0],
      0.5,
      objective[1],
    );
    const terminal = mesh(
      new THREE.BoxGeometry(0.8, 0.5, 0.1),
      0x38e9ad,
      objective[0],
      1.2,
      objective[1],
    );
    terminal.material.emissive.set(0x1f926a);
    const light = new THREE.PointLight(0xc6dec9, 18, 11);
    light.position.set(x, 2.8, z);
    group.add(light);
    const labelCanvas=document.createElement('canvas');labelCanvas.width=512;labelCanvas.height=64;
    const ctx=labelCanvas.getContext('2d');ctx.fillStyle='#14251d';ctx.fillRect(0,0,512,64);ctx.fillStyle='#d9e5ca';ctx.font='bold 24px monospace';ctx.textAlign='center';ctx.fillText(`${i+1} / ${m.actions[i]}`,256,42);
    const texture=new THREE.CanvasTexture(labelCanvas);texture.colorSpace=THREE.SRGBColorSpace;
    const sign=mesh(new THREE.PlaneGeometry(7,.8),0xffffff,x,2.7,z+4.2);sign.material.map=texture;
    // Interior desks and equipment establish scale without closing the passage.
    mesh(new THREE.BoxGeometry(1.8,.75,.7),0x485348,x-2,.4,z-2.6);
    mesh(new THREE.BoxGeometry(.7,1.8,.5),0x303c35,x+3,1,z-2.8);
    }
    // Long lanes, cargo cover and a marked extraction landing pad.
    for(let n=0;n<6;n++){
      const x=-5,z=55-n*22,w=5,h=3,d=12;
      const item={x,z,w,h,d,mesh:mesh(new THREE.BoxGeometry(w,h,d),0x4d594c,x,h/2,z)};obstacles.push(item);colliders.push(item);
    }
    beacon = mesh(
      new THREE.TorusGeometry(2, 0.09, 8, 48),
      0x57d7ff,
      m.extract[0],
      0.15,
      m.extract[1],
    );
    beacon.rotation.x = Math.PI / 2;
    enemies = m.guards.map(([a, b], i) => {
      const model = createSoldier(0x75664a);
      model.position.set(a, 0, b);
      if (blocked(a, b, obstacles.map(o=>[o.x,o.z,o.w,o.h,o.d]))) model.position.z += 1;
      group.add(model);
      return {
        model,
        hp: 100,
        home: model.position.clone(),
        phase: i * 2,
        lastFire: 0,
      };
    });
    onReset({ x:m.building[0], z:m.building[1]+15 });
    paint();
    message(m.brief);
  }
  function paint() {
    const m = MISSIONS[state.index],
      left = enemies.filter((e) => e.hp > 0).length;
    q("h2").textContent = m.name;
    q(".brief").textContent = m.brief;
    const step=state.step||0, current=m.steps[step];
    q('.objective').textContent=state.status==='failed'?'MISSION FAILED':state.status==='complete'?'OPERATION COMPLETE':current?`OBJECTIVE ${step+1}/5: ${current.action} • E near terminal • ${left} guards alive`:'REACH EXTRACTION • Clear nearby guards and press E';
    q(".next").hidden = state.status !== "complete";
    q(".next").textContent =
      state.index === 2 ? "REPLAY CAMPAIGN" : "NEXT OPERATION";
    const ctx = q(".radar").getContext("2d");
    ctx.fillStyle = "#101e20";
    ctx.fillRect(0, 0, 280, 150);
    const center = [0,0],
      scale = .64;
    const px = (x) => 140 + (x - center[0]) * scale,
      pz = (z) => 65 + (z - center[1]) * scale;
    ctx.fillStyle = "#637367";
    for (const o of obstacles)
      ctx.fillRect(
        px(o.x - o.w / 2),
        pz(o.z - o.d / 2),
        o.w * scale,
        o.d * scale,
      );
    ctx.fillStyle = "#84efb6";
    for(const s of m.steps.slice(state.step||0))ctx.fillRect(px(s.position[0])-3,pz(s.position[1])-3,6,6);
    ctx.strokeStyle = "#57d7ff";
    ctx.beginPath();
    ctx.arc(px(m.extract[0]), pz(m.extract[1]), 5, 0, Math.PI * 2);
    ctx.stroke();
    for (const e of enemies)
      if (e.hp > 0) {
        ctx.fillStyle = "#fa8767";
        ctx.beginPath();
        ctx.arc(
          px(e.model.position.x),
          pz(e.model.position.z),
          2.5,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    ctx.save();
    ctx.translate(px(player.position.x), pz(player.position.z));
    ctx.rotate(-player.rotation.y);
    ctx.fillStyle = "#61d4ff";
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(4, 4);
    ctx.lineTo(-4, 4);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#acbdba";
    ctx.font = "10px monospace";
    const point = state.intel ? m.extract : m.steps[state.step||0].position;
    ctx.fillText(
      `${state.intel ? "EXTRACTION" : "TERMINAL"} ${Math.round(Math.hypot(player.position.x - point[0], player.position.z - point[1]))}m | N ↑`,
      8,
      142,
    );
  }
  function lineClear(from, to) {
    const dir = to.clone().sub(from);
    ray.far = dir.length();
    ray.set(from, dir.normalize());
    return !ray.intersectObjects(
      obstacles.map((o) => o.mesh),
      false,
    ).length;
  }
  function update(dt, running) {
    if (state.status !== "active" || !running) return;
    time += dt;
    const boxes = obstacles.map((o) => [o.x, o.z, o.w, o.h, o.d]);
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      const eye = e.model.position.clone().add(new THREE.Vector3(0, 1.7, 0)),
        target = player.position.clone().add(new THREE.Vector3(0, 1.7, 0));
      const distance = eye.distanceTo(target),
        visible = distance < 23 && lineClear(eye, target);
      const dest = visible
        ? player.position
        : e.home
            .clone()
            .add(
              new THREE.Vector3(
                Math.sin(time * 0.35 + e.phase) * 2,
                0,
                Math.cos(time * 0.35 + e.phase) * 2,
              ),
            );
      const dir = dest.clone().sub(e.model.position);
      dir.y = 0;
      const moving = dir.length() > (visible ? 6 : 0.3);
      if (moving) {
        dir.normalize();
        const speed = (visible ? 2.2 : 1) * dt,
          nx = e.model.position.x + dir.x * speed,
          nz = e.model.position.z + dir.z * speed;
        if (!blocked(nx, e.model.position.z, boxes)) e.model.position.x = nx;
        if (!blocked(e.model.position.x, nz, boxes)) e.model.position.z = nz;
      }
      if (dir.lengthSq() > 0) e.model.rotation.y = Math.atan2(-dir.x, -dir.z);
      e.model.userData.updateAnimation?.(dt, moving, false);
      if (visible && time - e.lastFire > 1.35) {
        e.lastFire = time;
        e.model.userData.playRecoil?.();
        tracer(eye, target.clone().sub(eye).normalize(), distance);
        onDamage(MISSIONS[state.index].damage);
        if (state.status !== "active") break;
      }
    }
    beacon.material.emissive.set(state.intel ? 0x168b99 : 0x000000);
    paint();
  }
  function aimMeshes() {
    const list = [];
    for (const e of enemies)
      if (e.hp > 0)
        e.model.traverse((o) => {
          if (o.isMesh) {
            o.userData.guard = e;
            list.push(o);
          }
        });
    return list;
  }
  function hit(origin, direction, damage, wallDistance) {
    if (state.status !== "active") return false;
    ray.set(origin, direction);
    ray.far = Math.min(80, wallDistance);
    const hit = ray.intersectObjects(aimMeshes(), false)[0];
    if (!hit) return false;
    const e = hit.object.userData.guard;
    e.hp = Math.max(0, e.hp - damage);
    if (!e.hp) {
      e.model.visible = false;
      message("GUARD NEUTRALIZED");
    }
    paint();
    return true;
  }
  function interact() {
    const before = state;
    state = interactMission(
      state,
      player.position,
      enemies.filter((e) => e.hp > 0 && e.model.position.distanceTo(player.position)<12).length,
    );
    if (state !== before) {
      message(
        state.status === "complete"
          ? "OPERATION COMPLETE"
          : state.intel ? "ALL OBJECTIVES SECURED — PROCEED TO EXTRACTION" : "OBJECTIVE COMPLETE — NEXT INSTALLATION MARKED",
      );
      if (state.status === "complete") document.exitPointerLock?.();
    } else if (state.status === "active")
      message(
        "Follow the numbered objective. Clear guards within 12m, then press E within 2.4m of its terminal.",
      );
    paint();
  }
  return {
    start,
    update,
    hit,
    interact,
    aimMeshes,
    get bounds(){return 105;},
    get active() {
      return state.status !== "inactive";
    },
    get running() {
      return state.status === "active";
    },
    fail() {
      state.status = "failed";
      paint();
      panel.hidden = true;
      failure.hidden = false;
      failure.querySelector(".restart").focus({preventScroll:true});
      document.exitPointerLock?.();
    },
    stop() {
      cleanup();
      state.status = "inactive";
      panel.hidden = true;
      failure.hidden = true;
      group.visible = false;
      obstacles.splice(0,obstacles.length,...baseColliders);
      for(const o of baseWorld)o.visible=true;
    },
    setExit(fn) {
      exit = fn;
    },
  };
}
