// ════════════════════════════════════════════════════════════════════════════
// PLANET DOSSIER — cinematic per-world briefing
//
// A self-contained Three.js stage that runs on its own canvas above the main
// map. Four phases play out against a black void:
//
//   title    letterspaced name + headline mass, planet drifting at distance
//   stats    planet swings right, full data sheet reads in from the left
//   ring     eight subject nodes orbit the planet on a hairline dial
//   layers   the planet opens along a 90° wedge to reveal its interior
//
// The cutaway is real geometry, not a diagram: each layer is a nested sphere
// with a wedge removed, capped by half-annuli on the two cut planes. Layer
// labels are projected from those caps into screen space every frame.
// ════════════════════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { getDossier } from './dossierData.js';

const TEXTURE_ROOT = './assets/textures/';
const PHASES = ['title', 'stats', 'ring', 'layers'];

// Wedge cut: remove the azimuthal quarter between phi 0 and phi π/2, which
// carves out the (−x, +z) quadrant facing the camera.
const WEDGE_START = Math.PI * 0.5;
const WEDGE_LENGTH = Math.PI * 1.5;

const easeInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

export class PlanetDossier {
  constructor({ onClose, onExplore } = {}) {
    this.onClose = onClose;
    this.onExplore = onExplore;

    this.root = document.getElementById('dossier');
    this.canvas = document.getElementById('dossier-canvas');
    if (!this.root || !this.canvas) return;

    this.open = false;
    this.phase = 'title';
    this.dossier = null;
    this.introMode = false;
    this.layerLabels = [];
    this.textureCache = new Map();

    this._buildRenderer();
    this._buildScene();
    this._cacheDom();
    this._bindEvents();

    this.clock = new THREE.Clock();
    this._tick = this._tick.bind(this);
  }

  // ── Renderer ──────────────────────────────────────────────────────────────
  _buildRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
  }

  _buildScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.01, 2000);
    this.camera.position.set(0, 0, 9);

    // Key light rakes across the globe so the terminator falls near the middle
    // of the disc, which is what gives the reference its half-lit silhouette.
    this.keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    this.keyLight.position.set(-4, 1.4, 3.2);
    this.scene.add(this.keyLight);
    this.scene.add(new THREE.AmbientLight(0x6688aa, 0.12));

    this.planetGroup = new THREE.Group();
    this.scene.add(this.planetGroup);

    this.globe = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshBasicMaterial());
    this.planetGroup.add(this.globe);

    this.atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.028, 64, 48),
      new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uColor: { value: new THREE.Color(0x4fc3f7) }, uPower: { value: 3.0 }, uStrength: { value: 0.9 } },
        vertexShader: `
          varying vec3 vNormal; varying vec3 vView;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vView = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform vec3 uColor; uniform float uPower; uniform float uStrength;
          varying vec3 vNormal; varying vec3 vView;
          void main() {
            float rim = pow(1.0 - abs(dot(vNormal, vView)), uPower);
            gl_FragColor = vec4(uColor, rim * uStrength);
          }`
      })
    );
    this.planetGroup.add(this.atmosphere);

    this.layerGroup = new THREE.Group();
    this.layerGroup.visible = false;
    this.planetGroup.add(this.layerGroup);

    this.stars = this._buildStars();
    this.scene.add(this.stars);
  }

  _buildStars() {
    const count = 2600;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // Shell distribution keeps every star well behind the planet.
      const r = 120 + Math.random() * 320;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      sizes[i] = Math.random() < 0.06 ? 2.6 : 0.5 + Math.random() * 1.1;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    return new THREE.Points(geo, new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) } },
      vertexShader: `
        attribute float aSize; varying float vSize; uniform float uPixelRatio;
        void main() {
          vSize = aSize;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uPixelRatio * (170.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying float vSize;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vec3(0.82, 0.89, 1.0), a * 0.85);
        }`
    }));
  }

  // ── Materials ─────────────────────────────────────────────────────────────
  _texture(file) {
    if (!file) return null;
    if (this.textureCache.has(file)) return this.textureCache.get(file);
    const tex = new THREE.TextureLoader().load(`${TEXTURE_ROOT}${file}`);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    this.textureCache.set(file, tex);
    return tex;
  }

  /**
   * Day/night terminator shader. Bodies with a night map (Earth) reveal city
   * lights on the dark limb; everything else simply falls to near-black.
   */
  _surfaceMaterial(data) {
    const dayMap = this._texture(data.texture);
    const nightMap = data.nightTexture ? this._texture(data.nightTexture) : dayMap;
    return new THREE.ShaderMaterial({
      uniforms: {
        uDay: { value: dayMap },
        uNight: { value: nightMap },
        uHasNight: { value: data.nightTexture ? 1 : 0 },
        uEmissive: { value: data.emissive ? 1 : 0 },
        uTint: { value: new THREE.Color(data.tint ?? 0xffffff) },
        uLightDir: { value: new THREE.Vector3(-4, 1.4, 3.2).normalize() }
      },
      vertexShader: `
        varying vec2 vUv; varying vec3 vWorldNormal;
        void main() {
          vUv = uv;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform sampler2D uDay; uniform sampler2D uNight;
        uniform float uHasNight; uniform float uEmissive;
        uniform vec3 uTint; uniform vec3 uLightDir;
        varying vec2 vUv; varying vec3 vWorldNormal;
        void main() {
          vec3 day = texture2D(uDay, vUv).rgb * uTint;
          if (uEmissive > 0.5) { gl_FragColor = vec4(day * 1.35, 1.0); return; }
          float d = dot(normalize(vWorldNormal), normalize(uLightDir));
          float lit = smoothstep(-0.18, 0.30, d);
          vec3 nightSide = uHasNight > 0.5
            ? texture2D(uNight, vUv).rgb * 1.55
            : day * 0.035;
          vec3 col = mix(nightSide, day * (0.10 + 0.98 * lit), lit);
          gl_FragColor = vec4(col, 1.0);
        }`
    });
  }

  // ── Interior cutaway ──────────────────────────────────────────────────────
  _buildLayers(data) {
    // Dispose the previous world's shells before replacing them.
    this.layerGroup.clear();
    this.layerAnchors = [];

    const layers = data.layers || [];
    layers.forEach((layer, i) => {
      const outer = layer.outer;
      const inner = layers[i + 1]?.outer ?? 0;

      // Outer shell with the wedge carved away. The crust reuses the real
      // surface texture so the cutaway still reads as the planet itself.
      const shellMat = i === 0
        ? this._surfaceMaterial(data)
        : new THREE.MeshStandardMaterial({
            color: layer.color, roughness: 0.85, metalness: 0.05,
            emissive: new THREE.Color(layer.color).multiplyScalar(0.22)
          });
      if (i === 0) shellMat.side = THREE.FrontSide;

      const shell = new THREE.Mesh(
        new THREE.SphereGeometry(outer, 96, 64, WEDGE_START, WEDGE_LENGTH),
        shellMat
      );
      this.layerGroup.add(shell);

      const capMat = new THREE.MeshStandardMaterial({
        color: layer.color,
        roughness: 0.7,
        metalness: 0.05,
        emissive: new THREE.Color(layer.color).multiplyScalar(0.3),
        side: THREE.DoubleSide
      });

      // Cap A lies on the z = 0 plane covering x ≤ 0.
      const capA = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 96, 1, Math.PI / 2, Math.PI), capMat);
      this.layerGroup.add(capA);

      // Cap B is the same half-annulus rotated onto the x = 0 plane at z ≥ 0.
      const capB = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 96, 1, -Math.PI / 2, Math.PI), capMat);
      capB.rotation.y = -Math.PI / 2;
      this.layerGroup.add(capB);

      // Label anchor sits mid-thickness on cap A so callouts line up with the
      // band they describe.
      this.layerAnchors.push({
        point: new THREE.Vector3(-(outer + inner) / 2, 0, 0.001),
        layer
      });
    });
  }

  // ── DOM ───────────────────────────────────────────────────────────────────
  _cacheDom() {
    const q = sel => this.root.querySelector(sel);
    this.dom = {
      stage: q('.dsr-stage'),
      name: q('#dsr-name'),
      classification: q('#dsr-classification'),
      headline: q('#dsr-headline'),
      headlineLabel: q('#dsr-headline-label'),
      blurb: q('#dsr-blurb'),
      statBody: q('#dsr-stat-body'),
      ring: q('#dsr-ring'),
      readout: q('#dsr-readout'),
      readoutTitle: q('#dsr-readout-title'),
      readoutText: q('#dsr-readout-text'),
      layerList: q('#dsr-layer-list'),
      steps: q('#dsr-steps'),
      explore: q('#dsr-explore'),
      exploreLabel: q('#dsr-explore .dsr-explore-label')
    };
  }

  _bindEvents() {
    this.root.querySelectorAll('[data-dsr-phase]').forEach(btn => {
      btn.addEventListener('click', () => this.setPhase(btn.dataset.dsrPhase));
    });
    this.root.querySelector('#dsr-close')?.addEventListener('click', () => this.close());
    this.dom.explore?.addEventListener('click', () => {
      if (this.introMode) { this.close(); this.onExplore?.(); }
      else this.setPhase('ring');
    });

    this._onKey = e => {
      if (!this.open) return;
      if (e.key === 'Escape') { this.close(); return; }
      const i = PHASES.indexOf(this.phase);
      if (e.key === 'ArrowRight' && i < PHASES.length - 1) this.setPhase(PHASES[i + 1]);
      if (e.key === 'ArrowLeft' && i > 0) this.setPhase(PHASES[i - 1]);
    };
    window.addEventListener('keydown', this._onKey);
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    if (!this.open) return;
    const w = this.root.clientWidth;
    const h = this.root.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  // ── Public API ────────────────────────────────────────────────────────────
  show(bodyId, { intro = false } = {}) {
    const data = getDossier(bodyId);
    if (!data) return false;

    this.dossier = data;
    this.introMode = intro;
    this.open = true;

    this.globe.material?.dispose?.();
    this.globe.material = this._surfaceMaterial(data);
    this.atmosphere.material.uniforms.uColor.value.set(data.atmosphere ?? 0x4fc3f7);
    this.atmosphere.visible = !data.emissive;
    this._buildLayers(data);
    this._fillDom(data);

    this.root.hidden = false;
    this.root.classList.remove('is-closing');
    document.body.classList.add('dossier-open');
    requestAnimationFrame(() => this.root.classList.add('is-open'));

    this._resize();
    this.entryT = 0;
    this.setPhase('title', { immediate: true });
    this.clock.start();
    this.renderer.setAnimationLoop(this._tick);
    return true;
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.renderer.setAnimationLoop(null);
    this.root.classList.remove('is-open');
    this.root.classList.add('is-closing');
    document.body.classList.remove('dossier-open');
    setTimeout(() => { this.root.hidden = true; this.root.classList.remove('is-closing'); }, 620);
    this.onClose?.();
  }

  _fillDom(data) {
    const { dom } = this;
    // Letterspacing is applied in CSS; the characters stay unbroken for a11y.
    dom.name.textContent = data.name;
    dom.classification.textContent = data.classification;
    dom.headline.textContent = data.headline;
    dom.headlineLabel.textContent = data.headlineLabel;
    dom.blurb.textContent = data.blurb;

    dom.statBody.innerHTML = '';
    Object.entries(data.stats).forEach(([k, v], i) => {
      const row = document.createElement('div');
      row.className = 'dsr-stat-row';
      row.style.setProperty('--i', String(i));
      row.innerHTML = `<span class="dsr-stat-key">${k}</span><span class="dsr-stat-rule" aria-hidden="true"></span><span class="dsr-stat-val">${v}</span>`;
      dom.statBody.appendChild(row);
    });

    // Eight nodes on a dial. Angles are laid out in CSS custom properties so
    // the ring stays crisp vector text rather than projected 3D sprites.
    dom.ring.innerHTML = '';
    const n = data.hotspots.length;
    data.hotspots.forEach((spot, i) => {
      const angle = (i / n) * 360 - 90;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dsr-node';
      btn.style.setProperty('--angle', `${angle}deg`);
      btn.style.setProperty('--i', String(i));
      btn.innerHTML = `<span class="dsr-node-dot" aria-hidden="true"></span><span class="dsr-node-label">${spot.title}</span>`;
      btn.addEventListener('click', () => this._selectHotspot(i));
      btn.addEventListener('mouseenter', () => this._selectHotspot(i));
      dom.ring.appendChild(btn);
    });
    this._selectHotspot(0);

    dom.layerList.innerHTML = '';
    this.layerLabels = (data.layers || []).map((layer, i) => {
      const el = document.createElement('div');
      el.className = 'dsr-layer-label';
      el.style.setProperty('--i', String(i));
      el.innerHTML = `<span class="dsr-layer-name">${layer.name}</span><span class="dsr-layer-detail">${layer.detail}</span>`;
      dom.layerList.appendChild(el);
      return el;
    });

    dom.exploreLabel.textContent = this.introMode ? 'ENTER THE MAP' : 'EXPLORE';
    this.root.classList.toggle('is-intro', this.introMode);
  }

  _selectHotspot(index) {
    const spot = this.dossier?.hotspots?.[index];
    if (!spot) return;
    this.activeHotspot = index;
    this.dom.ring.querySelectorAll('.dsr-node').forEach((n, i) => n.classList.toggle('is-active', i === index));
    this.dom.readoutTitle.textContent = spot.title;
    this.dom.readoutText.textContent = spot.text;
    this.dom.readout.classList.remove('is-swap');
    void this.dom.readout.offsetWidth; // restart the swap transition
    this.dom.readout.classList.add('is-swap');
  }

  setPhase(phase, { immediate = false } = {}) {
    if (!PHASES.includes(phase)) return;
    this.phase = phase;
    this.root.dataset.phase = phase;

    this.dom.steps.querySelectorAll('[data-dsr-phase]').forEach(btn => {
      const active = btn.dataset.dsrPhase === phase;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-current', active ? 'step' : 'false');
    });

    this.layerGroup.visible = phase === 'layers';
    this.globe.visible = phase !== 'layers';
    this.atmosphere.visible = phase !== 'layers' && !this.dossier?.emissive;

    // Camera / planet choreography per phase.
    const targets = {
      title:  { camZ: 11.5, x: 0.0,  y: 0.0,  scale: 1.00, tiltX: 0.06,  tiltY: 0.0 },
      stats:  { camZ: 8.6,  x: 1.45, y: 0.0,  scale: 1.22, tiltX: 0.10,  tiltY: 0.0 },
      ring:   { camZ: 9.2,  x: 0.0,  y: 0.0,  scale: 0.92, tiltX: 0.08,  tiltY: 0.0 },
      layers: { camZ: 7.8,  x: 0.62, y: 0.0,  scale: 1.30, tiltX: 0.16,  tiltY: 0.30 }
    };
    this.target = targets[phase];
    if (immediate) {
      this.camera.position.z = this.target.camZ;
      this.planetGroup.position.set(this.target.x, this.target.y, 0);
      this.planetGroup.scale.setScalar(this.target.scale);
      this.planetGroup.rotation.x = this.target.tiltX;
    }
  }

  // ── Frame ─────────────────────────────────────────────────────────────────
  _tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.target;
    if (!t) return;

    // Slow approach on first open, mirroring the reference's drift-in.
    this.entryT = Math.min(1, this.entryT + dt / 2.6);
    const entry = easeOutCubic(this.entryT);

    const k = 1 - Math.pow(0.0012, dt); // frame-rate independent damping
    this.camera.position.z += ((t.camZ + (1 - entry) * 6.5) - this.camera.position.z) * k;
    this.planetGroup.position.x += (t.x - this.planetGroup.position.x) * k;
    this.planetGroup.position.y += (t.y - this.planetGroup.position.y) * k;

    const s = this.planetGroup.scale.x + (t.scale - this.planetGroup.scale.x) * k;
    this.planetGroup.scale.setScalar(s);
    this.planetGroup.rotation.x += (t.tiltX - this.planetGroup.rotation.x) * k;

    // The globe spins; the cutaway holds still so its callouts stay readable.
    if (this.phase === 'layers') {
      this.layerGroup.rotation.y += (t.tiltY - this.layerGroup.rotation.y) * k;
    } else {
      this.globe.rotation.y += dt * 0.045;
      this.atmosphere.rotation.y = this.globe.rotation.y;
    }
    this.stars.rotation.y += dt * 0.004;

    this._positionLayerLabels();
    this.renderer.render(this.scene, this.camera);
  }

  /** Project each cap anchor into screen space so callouts track the geometry. */
  _positionLayerLabels() {
    if (this.phase !== 'layers' || !this.layerAnchors) return;
    const w = this.root.clientWidth;
    const h = this.root.clientHeight;
    const v = new THREE.Vector3();
    this.layerAnchors.forEach((anchor, i) => {
      const el = this.layerLabels[i];
      if (!el) return;
      v.copy(anchor.point);
      this.layerGroup.localToWorld(v);
      v.project(this.camera);
      el.style.setProperty('--x', `${(v.x * 0.5 + 0.5) * w}px`);
      el.style.setProperty('--y', `${(-v.y * 0.5 + 0.5) * h}px`);
    });
  }
}
