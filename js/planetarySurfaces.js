import * as THREE from 'three';

const TEXTURE_ROOT = './assets/textures/';
const ANCHOR = new THREE.Vector3(12000, 0, 12000);
const SURFACES = {
  earth: {
    name: 'Earth', texture: '8k_earth_daymap.jpg', tint: 0xffffff,
    sky: 0x07152b, fog: 0x335b78, sun: 0xfff1d2, roughness: 0.78,
    source: '8K NASA imagery · adaptive procedural terrain', elevation: 7.5
  },
  moon: {
    name: 'Moon', texture: '8k_moon.jpg', tint: 0xd8d5cc,
    sky: 0x000008, fog: 0x08080c, sun: 0xf8f5e8, roughness: 1,
    source: '8K NASA lunar imagery · adaptive procedural terrain', elevation: 10
  },
  mars: {
    name: 'Mars', texture: '8k_mars.jpg', tint: 0xd98962,
    sky: 0x170b08, fog: 0x7d3e2b, sun: 0xffd5b5, roughness: 0.96,
    source: '8K NASA Mars imagery · adaptive procedural terrain', elevation: 12
  }
};

function fract(value) { return value - Math.floor(value); }
function noise(x, z) {
  const a = fract(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453);
  const b = fract(Math.sin(x * 4.731 + z * 31.173) * 19341.131);
  const ridges = Math.abs(Math.sin(x * .19) * Math.cos(z * .16));
  return (a * .42 + b * .28 + ridges * .3) - .5;
}

function disposeObject(root) {
  root.traverse(object => {
    object.geometry?.dispose?.();
    if (Array.isArray(object.material)) object.material.forEach(material => material.dispose?.());
    else object.material?.dispose?.();
  });
}

export class PlanetarySurfaces {
  constructor({ scene, camera, controls, renderer, onStateChange }) {
    this.scene = scene;
    this.camera = camera;
    this.controls = controls;
    this.renderer = renderer;
    this.onStateChange = onStateChange || (() => {});
    this.group = null;
    this.tiles = null;
    this.body = null;
    this.saved = null;
    this.transition = null;
    this.clock = 0;
    this.quality = this.detectQuality();
  }

  detectQuality() {
    const maxTexture = this.renderer.capabilities.maxTextureSize || 4096;
    const memory = navigator.deviceMemory || 8;
    if (memory >= 8 && maxTexture >= 8192 && window.devicePixelRatio >= 1.5) return 'Ultra · 8K source';
    if (memory >= 4 && maxTexture >= 4096) return 'High · 4K–8K adaptive';
    return 'Balanced · adaptive LOD';
  }

  supports(value) {
    const id = String(value?.userData?.id || value?.userData?.name || value || '').toLowerCase();
    return id === 'earth' || id === 'mars' || id === 'moon';
  }

  isActive() { return !!this.body; }

  emit(detail) {
    this.onStateChange({ active: this.isActive(), body: this.body, quality: this.quality, ...detail });
  }

  async land(mesh) {
    const id = String(mesh?.userData?.id || mesh?.userData?.name || '').toLowerCase();
    if (!SURFACES[id] || this.transition) return;
    if (this.body) this.returnToOrbit(true);

    const profile = SURFACES[id];
    this.saved = {
      position: this.camera.position.clone(),
      quaternion: this.camera.quaternion.clone(),
      target: this.controls.target.clone(),
      minDistance: this.controls.minDistance,
      maxDistance: this.controls.maxDistance,
      fog: this.scene.fog,
      background: this.scene.background
    };
    this.body = id;
    this.emit({ phase: 'loading', progress: 0.08, message: `Preparing ${profile.name} surface…` });

    this.group = this.buildSurface(id, profile);
    this.scene.add(this.group);
    await new Promise(resolve => setTimeout(resolve, 240));
    this.emit({ phase: 'loading', progress: 0.48, message: 'Calibrating terrain detail…' });
    await this.tryTiles(id);

    this.scene.fog = new THREE.FogExp2(profile.fog, id === 'earth' ? .004 : .0025);
    this.controls.minDistance = 2;
    this.controls.maxDistance = 90;
    this.controls.target.copy(ANCHOR).add(new THREE.Vector3(0, 2, -18));
    this.transition = {
      from: this.camera.position.clone(),
      to: ANCHOR.clone().add(new THREE.Vector3(0, 7, 16)),
      elapsed: 0,
      duration: 2.4,
      mode: 'landing'
    };
    document.body.classList.add('surface-active');
    this.emit({ phase: 'landing', progress: 0.82, message: `Descending to ${profile.name}…`, source: this.tiles ? 'NASA AMMOS 3D Tiles' : profile.source });
  }

  buildSurface(id, profile) {
    const group = new THREE.Group();
    group.name = `surface-${id}`;
    group.position.copy(ANCHOR);

    const segments = this.quality.startsWith('Ultra') ? 256 : this.quality.startsWith('High') ? 160 : 96;
    const geometry = new THREE.PlaneGeometry(260, 260, segments, segments);
    geometry.rotateX(-Math.PI / 2);
    const positions = geometry.attributes.position;
    for (let index = 0; index < positions.count; index++) {
      const x = positions.getX(index);
      const z = positions.getZ(index);
      const radial = Math.max(0, 1 - Math.hypot(x, z) / 190);
      const height = noise(x * .18, z * .18) * profile.elevation * radial;
      positions.setY(index, height - 1.5);
    }
    geometry.computeVertexNormals();

    const texture = new THREE.TextureLoader().load(`${TEXTURE_ROOT}${profile.texture}`);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(5, 5);
    texture.anisotropy = Math.min(16, this.renderer.capabilities.getMaxAnisotropy());
    const material = new THREE.MeshStandardMaterial({ map: texture, color: profile.tint, roughness: profile.roughness, metalness: 0 });
    const ground = new THREE.Mesh(geometry, material);
    ground.receiveShadow = true;
    ground.userData.surfaceGround = true;
    group.add(ground);

    const hemi = new THREE.HemisphereLight(profile.sun, profile.fog, id === 'moon' ? .42 : .78);
    const sun = new THREE.DirectionalLight(profile.sun, id === 'moon' ? 3.4 : 2.5);
    sun.position.set(-45, 65, 25);
    group.add(hemi, sun);

    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(180, 48, 24),
      new THREE.MeshBasicMaterial({ color: profile.sky, side: THREE.BackSide, fog: false })
    );
    dome.position.y = 10;
    group.add(dome);

    if (id === 'earth') {
      const cloud = new THREE.Mesh(
        new THREE.PlaneGeometry(230, 90),
        new THREE.MeshBasicMaterial({ color: 0xbcd9eb, transparent: true, opacity: .055, depthWrite: false })
      );
      cloud.position.set(0, 34, -60);
      cloud.rotation.x = Math.PI / 2;
      cloud.userData.cloudLayer = true;
      group.add(cloud);
    }
    return group;
  }

  async tryTiles(id) {
    const url = window.PLANETARY_TILESETS?.[id];
    if (!url) return;
    try {
      const { TilesRenderer } = await import('3d-tiles-renderer/three');
      const tiles = new TilesRenderer(url);
      tiles.setCamera(this.camera);
      tiles.setResolutionFromRenderer(this.camera, this.renderer);
      tiles.errorTarget = this.quality.startsWith('Ultra') ? 4 : 8;
      tiles.group.position.copy(ANCHOR);
      this.scene.add(tiles.group);
      this.tiles = tiles;
    } catch (error) {
      console.warn('NASA AMMOS tiles unavailable; using the local 8K surface fallback.', error);
      this.emit({ phase: 'loading', progress: .64, message: 'Tile stream unavailable · activating 8K fallback' });
    }
  }

  returnToOrbit(immediate = false) {
    if (!this.body || !this.saved) return;
    if (immediate) return this.finishReturn();
    this.transition = {
      from: this.camera.position.clone(),
      to: this.saved.position.clone(),
      elapsed: 0,
      duration: 2.2,
      mode: 'returning'
    };
    this.emit({ phase: 'returning', progress: .25, message: 'Ascending to orbital view…' });
  }

  finishReturn() {
    if (!this.saved) return;
    this.camera.position.copy(this.saved.position);
    this.camera.quaternion.copy(this.saved.quaternion);
    this.controls.target.copy(this.saved.target);
    this.controls.minDistance = this.saved.minDistance;
    this.controls.maxDistance = this.saved.maxDistance;
    this.scene.fog = this.saved.fog;
    this.scene.background = this.saved.background;
    if (this.group) {
      this.scene.remove(this.group);
      disposeObject(this.group);
    }
    if (this.tiles) {
      this.scene.remove(this.tiles.group);
      this.tiles.dispose?.();
    }
    this.group = null;
    this.tiles = null;
    this.body = null;
    this.saved = null;
    this.transition = null;
    document.body.classList.remove('surface-active');
    this.controls.update();
    this.emit({ active: false, phase: 'orbit', progress: 0, message: 'Orbital navigation restored' });
  }

  update(delta) {
    if (!this.body) return;
    this.clock += delta;
    if (this.tiles) {
      this.tiles.setResolutionFromRenderer(this.camera, this.renderer);
      this.tiles.update();
    }
    const cloud = this.group?.children.find(child => child.userData.cloudLayer);
    if (cloud) cloud.position.x = Math.sin(this.clock * .015) * 26;

    if (this.transition) {
      this.transition.elapsed += delta;
      const linear = Math.min(1, this.transition.elapsed / this.transition.duration);
      const eased = linear < .5 ? 4 * linear ** 3 : 1 - Math.pow(-2 * linear + 2, 3) / 2;
      this.camera.position.lerpVectors(this.transition.from, this.transition.to, eased);
      if (this.transition.mode === 'landing') this.camera.lookAt(this.controls.target);
      if (linear >= 1) {
        if (this.transition.mode === 'returning') return this.finishReturn();
        this.transition = null;
        this.emit({ phase: 'surface', progress: 1, message: `${SURFACES[this.body].name} surface online`, source: this.tiles ? 'NASA AMMOS 3D Tiles' : SURFACES[this.body].source });
      }
    }

    const floor = ANCHOR.y + 2.2;
    if (this.camera.position.y < floor) this.camera.position.y = floor;
    const dx = THREE.MathUtils.clamp(this.camera.position.x - ANCHOR.x, -115, 115);
    const dz = THREE.MathUtils.clamp(this.camera.position.z - ANCHOR.z, -115, 115);
    this.camera.position.x = ANCHOR.x + dx;
    this.camera.position.z = ANCHOR.z + dz;
  }
}
