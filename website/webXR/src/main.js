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

function makeCube() {
  const size = 0.16;
  const geometry = new THREE.BoxGeometry(size, size, size);
  const materials = [
    0xf97316, 0x8b5cf6, 0x22d3ee, 0xfacc15, 0x34d399, 0xfb7185
  ].map(color => new THREE.MeshStandardMaterial({ color, roughness: 0.48, metalness: 0.04 }));
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geometry, materials));
  group.add(new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 })
  ));
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
    if (supported) status('Compatible immersive AR detected. Start AR, scan slowly, then place a cube.');
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

    // WebXR provides the real-world camera as compositor passthrough, not as
    // a normal HTML video. Report the blend mode so a black view is diagnosable.
    const blendMode = session.environmentBlendMode || 'unknown';
    status('AR session active · camera blend mode: ' + blendMode);

    state.referenceSpace = getRendererReferenceSpace();
    state.referenceSpaceType = 'local';
    state.viewerSpace = await session.requestReferenceSpace('viewer');
    state.hitTestSource = await session.requestHitTestSource({ space: state.viewerSpace });
    session.addEventListener('end', onSessionEnd, { once: true });
    state.renderer.domElement.addEventListener('pointerdown', onCanvasTap);
    ui.place.disabled = false;
    ui.reset.disabled = false;
    status('AR active · blend mode: ' + blendMode + '. Scan slowly for surfaces.');
  } catch (error) {
    console.error(error);
    if (state.session) {
      const failedSession = state.session;
      state.session = null;
      try { await failedSession.end(); } catch (_) { /* session may already be ended */ }
    }
    document.body.classList.remove('ar-active');
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
    status('AR failed to start: ' + (error?.message || String(error)) + ' If all reference spaces fail, update Chrome/Google Play Services for AR and retry.');
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
  const cube = makeCube();
  cube.position.copy(hitPosition);
  cube.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), surface.normal);
  cube.position.addScaledVector(surface.normal, 0.085);
  state.scene.add(cube);
  state.placed.push(cube);
  state.latestSurface = surface.type;
  status('Cube placed on a ' + surface.type + ' surface. Total: ' + state.placed.length + '.');
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
  status('Scene cleared. Scan a surface and place a new cube.');
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
        if (++state.frameCount % 45 === 0) status('Surface found: ' + surface.type + '. Tap Place cube.');
      }
    } else {
      state.hitPose = null;
      state.reticle.visible = false;
    }
  }
  state.renderer.render(state.scene, state.camera);
}

function onSessionEnd() {
  document.body.classList.remove('ar-active');
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
