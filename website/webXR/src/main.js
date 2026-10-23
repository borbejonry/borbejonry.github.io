import * as THREE from 'three';

const ui = {
  status: document.querySelector('#status'),
  start: document.querySelector('#start-ar'),
  place: document.querySelector('#place-cube'),
  reset: document.querySelector('#reset-scene'),
  unsupported: document.querySelector('#unsupported'),
  unsupportedMessage: document.querySelector('#unsupported-message'),
  retry: document.querySelector('#retry-support')
};

const state = {
  renderer: null, scene: null, camera: null, session: null,
  referenceSpace: null, referenceSpaceType: null, viewerSpace: null, hitTestSource: null,
  hitPose: null, reticle: null, placed: [], latestSurface: 'unknown',
  frameCount: 0
};

function status(message) { ui.status.textContent = message; }

function createScene() {
  state.scene = new THREE.Scene();
  state.camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.01, 30);
  state.scene.add(new THREE.HemisphereLight(0xe4f5ff, 0x37304d, 1.8));
  const key = new THREE.DirectionalLight(0xffffff, 2.3);
  key.position.set(2, 4, 3);
  state.scene.add(key);

  state.reticle = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.055, 0.073, 40),
    new THREE.MeshBasicMaterial({ color: 0x5eead4, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  state.reticle.add(ring);
  const center = new THREE.Mesh(
    new THREE.CircleGeometry(0.008, 20),
    new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
  );
  center.rotation.x = -Math.PI / 2;
  center.position.y = 0.0005;
  state.reticle.add(center);
  state.reticle.visible = false;
  state.scene.add(state.reticle);

  state.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
  // AR camera passthrough is visible only where the WebGL canvas is transparent.
  state.renderer.setClearColor(0x000000, 0);
  state.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  state.renderer.setSize(innerWidth, innerHeight);
  state.renderer.xr.enabled = true;
  state.renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.querySelector('#scene-root').replaceChildren(state.renderer.domElement);
  state.renderer.setAnimationLoop(render);
  addEventListener('resize', resize, { passive: true });
}

function resize() {
  if (!state.renderer) return;
  state.renderer.setSize(innerWidth, innerHeight);
  if (state.camera) {
    state.camera.aspect = innerWidth / innerHeight;
    state.camera.updateProjectionMatrix();
  }
}

function makeStrawberry() {
  // Rounded shoulders and a single tapered tip create a recognizable berry shape.
  const group = new THREE.Group();
  const radius = 0.075;
  const height = 0.17;
  const rings = 24;
  const segments = 40;
  const vertices = [];
  const indices = [];

  // Rounded shoulders taper into the strawberry's pointed bottom.
  for (let ring = 0; ring <= rings; ring++) {
    const t = ring / rings;
    const y = height * (0.5 - t);
    const profile = Math.pow(1 - t, 0.62) * (0.74 + 0.26 * Math.sin(Math.PI * Math.min(t / 0.42, 1) / 2));
    const r = radius * profile;
    for (let segment = 0; segment <= segments; segment++) {
      const angle = (segment / segments) * Math.PI * 2;
      vertices.push(Math.cos(angle) * r, y, Math.sin(angle) * r);
    }
  }
  for (let ring = 0; ring < rings; ring++) {
    for (let segment = 0; segment < segments; segment++) {
      const a = ring * (segments + 1) + segment;
      const b = a + segments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const berry = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: 0xe9233a, roughness: 0.62, metalness: 0 })
  );
  group.add(berry);

  // Small golden seeds sit on the berry's surface in staggered rows.
  const seedGeometry = new THREE.SphereGeometry(0.0032, 8, 6);
  const seedMaterial = new THREE.MeshStandardMaterial({ color: 0xffd66b, roughness: 0.7 });
  for (let row = 0; row < 7; row++) {
    const t = 0.13 + row * 0.105;
    const y = height * (0.5 - t);
    const profile = Math.pow(1 - t, 0.62) * (0.74 + 0.26 * Math.sin(Math.PI * Math.min(t / 0.42, 1) / 2));
    const r = radius * profile;
    const count = Math.max(5, Math.round(8 * Math.sin(Math.PI * t)));
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (row % 2) * 0.22;
      const seed = new THREE.Mesh(seedGeometry, seedMaterial);
      seed.position.set(Math.cos(angle) * (r + 0.001), y, Math.sin(angle) * (r + 0.001));
      seed.scale.set(0.7, 1.25, 0.7);
      seed.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(Math.cos(angle), 0.15, Math.sin(angle)).normalize()
      );
      group.add(seed);
    }
  }

  // Five pointed green leaves form a leafy crown at the top.
  const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x38a34a, roughness: 0.68, side: THREE.DoubleSide });
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, 0);
    leafShape.quadraticCurveTo(0.025, 0.006, 0.037, 0.014);
    leafShape.quadraticCurveTo(0.016, 0.016, 0, 0);
    const leafGeometry = new THREE.ShapeGeometry(leafShape);
    const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
    leaf.position.set(0, height * 0.48, 0);
    leaf.rotation.set(-Math.PI / 2, 0, angle);
    leaf.scale.set(0.8, 0.8, 0.8);
    group.add(leaf);
  }
  return group;
}

function classifySurface(matrix) {
  const q = new THREE.Quaternion().setFromRotationMatrix(matrix);
  const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(q).normalize();
  const vertical = Math.abs(normal.y);
  if (vertical > 0.78) return { type: 'floor-like', normal, color: 0x5eead4 };
  if (vertical < 0.28) return { type: 'wall-like', normal, color: 0xc4b5fd };
  return { type: 'angled / unknown', normal, color: 0xfbbf24 };
}

async function checkSupport() {
  try {
    const supported = !!navigator.xr && await navigator.xr.isSessionSupported('immersive-ar');
    ui.start.disabled = !supported;
    ui.unsupported.classList.toggle('hidden', supported);
    if (supported) status('Compatible immersive AR detected. Start AR, scan slowly, then place a strawberry.');
    else status('Immersive AR is not supported by this browser/device.');
    return supported;
  } catch (error) {
    ui.start.disabled = true;
    ui.unsupportedMessage.textContent = 'WebXR support check failed. Use a current compatible Android browser over HTTPS.';
    ui.unsupported.classList.remove('hidden');
    status('Could not check WebXR support.');
    return false;
  }
}

function getRendererReferenceSpace() {
  // Use the same reference space as Three.js's XR camera. Requesting a
  // separate space can fail on some runtimes, and viewer space is not a
  // valid substitute for stable world placement.
  const space = state.renderer?.xr.getReferenceSpace();
  if (!space) {
    throw new Error('The XR renderer did not provide a local reference space. Update Chrome and Google Play Services for AR, then retry.');
  }
  return space;
}

async function startAR() {
  ui.start.disabled = true;
  status('Requesting AR session…');
  try {
    const session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['dom-overlay', 'plane-detection'],
      domOverlay: { root: document.body }
    });
    state.session = session;
    createScene();
    // Set this before setSession: Three.js otherwise defaults to
    // local-floor, which may be rejected by a runtime that only exposes local.
    state.renderer.xr.setReferenceSpaceType('local');
    await state.renderer.xr.setSession(session);
    document.body.classList.add('ar-active');

    // WebXR normally composites the camera passthrough in the browser/runtime.
    // The page cannot manufacture that feed with CSS if the runtime reports opaque.
    const blendMode = session.environmentBlendMode || 'unknown';
    document.body.classList.remove('ar-passthrough');
    const featureList = Array.from(session.enabledFeatures || []).join(', ') || 'not reported';
    status('XR SESSION STARTED | blend=' + blendMode + ' | features=' + featureList + ' | checking reference space…');

    state.referenceSpace = getRendererReferenceSpace();
    state.referenceSpaceType = 'local';
    state.viewerSpace = await session.requestReferenceSpace('viewer');
    state.hitTestSource = await session.requestHitTestSource({ space: state.viewerSpace });
    session.addEventListener('end', onSessionEnd, { once: true });
    state.renderer.domElement.addEventListener('pointerdown', onCanvasTap);
    ui.place.disabled = false;
    ui.reset.disabled = false;
    status('XR SESSION OK | blend=' + blendMode + ' | ref=local | hit-test=ready. ' +
      ((blendMode === 'alpha-blend' || blendMode === 'additive')
        ? 'If no real-world view appears, the AR runtime/compositor is not showing passthrough.'
        : 'This session is opaque; real-world passthrough is unavailable.'));
  } catch (error) {
    console.error(error);
    if (state.session) {
      const failedSession = state.session;
      state.session = null;
      try { await failedSession.end(); } catch (_) { /* session may already be ended */ }
    }
    document.body.classList.remove('ar-active', 'ar-passthrough');
    if (state.renderer) {
      state.renderer.setAnimationLoop(null);
      state.renderer.dispose();
      state.renderer.domElement.remove();
    }
    state.renderer = state.scene = state.camera = state.reticle = null;
    state.hitTestSource = state.referenceSpace = state.viewerSpace = state.hitPose = null;
    state.referenceSpaceType = null;
    ui.start.disabled = false;
    ui.place.disabled = true;
    ui.reset.disabled = true;
    status('XR START FAILED | ' + (error?.name || 'Error') + ': ' + (error?.message || String(error)) +
      ' | Check Chrome WebXR + Google Play Services for AR.');
  }
}

function onCanvasTap(event) {
  if (event.target.closest?.('.hud')) return;
  placeCube();
}

function placeCube() {
  if (!state.hitPose || !state.scene) {
    status('No hit yet. Move slowly and aim at a well-lit, textured wall or floor.');
    return;
  }
  const matrix = new THREE.Matrix4().fromArray(state.hitPose.transform.matrix);
  const hitPosition = new THREE.Vector3().setFromMatrixPosition(matrix);
  const surface = classifySurface(matrix);
  const strawberry = makeStrawberry();
  strawberry.position.copy(hitPosition);
  strawberry.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), surface.normal);
  strawberry.position.addScaledVector(surface.normal, 0.085);
  state.scene.add(strawberry);
  state.placed.push(strawberry);
  state.latestSurface = surface.type;
  status('Strawberry placed on a ' + surface.type + ' surface. Total: ' + state.placed.length + '.');
}

function resetScene() {
  for (const object of state.placed) {
    state.scene?.remove(object);
    object.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        for (const material of (Array.isArray(child.material) ? child.material : [child.material])) material.dispose();
      }
    });
  }
  state.placed.length = 0;
  status('Scene cleared. Scan a surface and place a new strawberry.');
}

function render(_time, frame) {
  if (!state.renderer || !state.scene || !state.camera) return;
  if (frame && state.hitTestSource && state.referenceSpace) {
    const hits = frame.getHitTestResults(state.hitTestSource);
    const hit = hits[0];
    if (hit) {
      const pose = hit.getPose(state.referenceSpace);
      if (pose) {
        state.hitPose = pose;
        const matrix = new THREE.Matrix4().fromArray(pose.transform.matrix);
        const surface = classifySurface(matrix);
        state.reticle.position.setFromMatrixPosition(matrix);
        state.reticle.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), surface.normal);
        state.reticle.traverse(child => {
          if (child.material?.color) child.material.color.setHex(surface.color);
        });
        state.reticle.visible = true;
        if (++state.frameCount % 45 === 0) {
          const mode = state.session?.environmentBlendMode || 'unknown';
          status('XR active | blend=' + mode + ' | surface=' + surface.type + ' | hit-test working');
        }
      }
    } else {
      state.hitPose = null;
      state.reticle.visible = false;
    }
  }
  state.renderer.render(state.scene, state.camera);
}

function onSessionEnd() {
  document.body.classList.remove('ar-active', 'ar-passthrough');
  state.session = null;
  state.hitTestSource = null;
  state.hitPose = null;
  state.referenceSpace = null;
  state.referenceSpaceType = null;
  state.viewerSpace = null;
  if (state.renderer) {
    state.renderer.setAnimationLoop(null);
    state.renderer.dispose();
    state.renderer.domElement.removeEventListener('pointerdown', onCanvasTap);
    state.renderer.domElement.remove();
  }
  state.renderer = state.scene = state.camera = state.reticle = null;
  state.placed.length = 0;
  ui.start.disabled = false;
  ui.place.disabled = true;
  ui.reset.disabled = true;
  status('AR session ended. Start AR to try again.');
}

ui.start.addEventListener('click', startAR);
ui.place.addEventListener('click', placeCube);
ui.reset.addEventListener('click', resetScene);
ui.retry.addEventListener('click', checkSupport);
checkSupport();
