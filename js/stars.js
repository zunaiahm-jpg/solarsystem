import * as THREE from 'three';
import { FAMOUS_STARS_DATA, CONSTELLATIONS_DATA } from './data.js';

export let starObjects = [];
let starEnvironment = null;
let constellationLines = null;
let famousStarGroup = null;
let skyMaterial = null;
let skyDome = null;
let proceduralStarGroup = null;
let stellarSprites = [];

// Slow enough to read as a living celestial field without creating vection in VR.
// Rates are radians per second and derive from elapsed time, so Quest refresh rate
// changes (72/80/90 Hz) never alter the perceived motion speed.
const SKY_ROTATION_RATE = 0.000018;
const STAR_DRIFT_RATE = 0.000026;

const SKY_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const SKY_FRAG = `
  uniform sampler2D uSky;
  uniform float uExposure;
  varying vec2 vUv;
  void main() {
    vec3 photographed = texture2D(uSky, vUv).rgb;
    vec3 linearColor = pow(max(photographed, vec3(0.0)), vec3(2.2));
    float luminance = dot(linearColor, vec3(0.2126, 0.7152, 0.0722));

    // Suppress the long-exposure magenta cast while retaining subtle stellar color.
    vec3 neutralSky = vec3(luminance * 0.86, luminance * 0.92, luminance);
    vec3 color = mix(neutralSky, linearColor, 0.46);
    color = max(color - vec3(0.0018), vec3(0.0));
    color *= uExposure;

    // Human vision sees most of space as black, with the Milky Way only faintly visible.
    color = pow(color, vec3(0.88));
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function randomStellarColor() {
  const sample = Math.random();
  if (sample < 0.06) return new THREE.Color(0x9fc8ff);
  if (sample < 0.22) return new THREE.Color(0xd3e6ff);
  if (sample < 0.72) return new THREE.Color(0xfff7e8);
  if (sample < 0.91) return new THREE.Color(0xffd39a);
  return new THREE.Color(0xffa06f);
}

function makeStarSpriteTexture() {
  const size = 128;
  const center = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.08, 'rgba(255,255,255,0.85)');
  gradient.addColorStop(0.25, 'rgba(255,255,255,0.32)');
  gradient.addColorStop(0.55, 'rgba(255,255,255,0.07)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function createHumanEyeStars() {
  // Sparse round sprites never collapse into square box pixels the way tiny
  // gl_PointSize points can on some drivers, and they keep a soft photographic
  // halo that matches the ESO sky panorama.
  stellarSprites = [];
  const count = 1800;
  const sharedTexture = makeStarSpriteTexture();
  const baseMaterial = new THREE.SpriteMaterial({
    map: sharedTexture,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });

  for (let index = 0; index < count; index++) {
    const theta = Math.random() * Math.PI * 2;
    const cosine = Math.random() * 2 - 1;
    const sine = Math.sqrt(1 - cosine * cosine);
    const radius = 16000;

    const intensity = 0.62 + Math.random() * 0.38;
    const color = randomStellarColor();
    const material = baseMaterial.clone();
    material.color = color.clone().multiplyScalar(intensity);

    const bright = Math.random();
    const scale = bright > 0.985 ? 80 + Math.random() * 40 : bright > 0.9 ? 55 : 28 + Math.random() * 12;

    const sprite = new THREE.Sprite(material);
    sprite.position.set(
      radius * sine * Math.cos(theta),
      radius * cosine,
      radius * sine * Math.sin(theta)
    );
    sprite.scale.setScalar(scale);
    sprite.userData.baseScale = scale;
    sprite.userData.phase = Math.random() * Math.PI * 2;
    stellarSprites.push(sprite);
  }

  const group = new THREE.Group();
  group.add(...stellarSprites);
  group.renderOrder = -998;
  return group;
}

function makeNamedStarTexture(color) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  const stellarColor = new THREE.Color(color);
  const red = Math.round(stellarColor.r * 255);
  const green = Math.round(stellarColor.g * 255);
  const blue = Math.round(stellarColor.b * 255);
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(.025, `rgba(${red},${green},${blue},.96)`);
  gradient.addColorStop(.09, `rgba(${red},${green},${blue},.22)`);
  gradient.addColorStop(.35, `rgba(${red},${green},${blue},.025)`);
  gradient.addColorStop(1, `rgba(${red},${green},${blue},0)`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

export function createStarField(scene, renderer) {
  starEnvironment = new THREE.Group();
  scene.add(starEnvironment);

  const geometry = new THREE.SphereGeometry(20000, 160, 96);
  const placeholder = new THREE.DataTexture(new Uint8Array([0, 0, 4, 255]), 1, 1);
  placeholder.needsUpdate = true;
  skyMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uSky: { value: placeholder },
      uExposure: { value: 0.42 }
    },
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    toneMapped: true
  });
  skyDome = new THREE.Mesh(geometry, skyMaterial);
  skyDome.frustumCulled = false;
  skyDome.renderOrder = -1000;
  starEnvironment.add(skyDome);
  proceduralStarGroup = createHumanEyeStars();
  starEnvironment.add(proceduralStarGroup);

  new THREE.TextureLoader().load(
    './assets/sky/starmap-nasa-8k.jpg',
    texture => {
      texture.colorSpace = THREE.NoColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = true;
      // Conservative anisotropy preserves detail without overspending Quest GPU time.
      if (renderer) texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      skyMaterial.uniforms.uSky.value = texture;
      window._spaceSkyResolution = '8192×4096';
      window._spaceSkyReady = true;
      window.dispatchEvent(new Event('space-sky-ready'));
    },
    undefined,
    error => {
      console.warn('The photographic all-sky panorama could not be loaded.', error);
      window._spaceSkyReady = true;
      window.dispatchEvent(new Event('space-sky-ready'));
    }
  );

  return starEnvironment;
}

export function createFamousStars(scene) {
  starObjects = [];
  famousStarGroup = new THREE.Group();
  scene.add(famousStarGroup);

  FAMOUS_STARS_DATA.forEach(starData => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeNamedStarTexture(starData.color),
      color: starData.color,
      transparent: true,
      opacity: .58,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    }));
    sprite.position.set(starData.x, starData.y, starData.z);
    sprite.scale.setScalar(starData.size * 4.2);
    sprite.userData.phase = Math.random() * Math.PI * 2;
    famousStarGroup.add(sprite);

    const hitMesh = new THREE.Mesh(
      new THREE.SphereGeometry(starData.size * 3, 12, 12),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitMesh.position.copy(sprite.position);
    hitMesh.userData = { ...starData, objectType: 'star', visualSprite: sprite };
    famousStarGroup.add(hitMesh);
    starObjects.push(hitMesh);
  });
  return famousStarGroup;
}

export function createConstellations(scene) {
  constellationLines = new THREE.Group();
  const material = new THREE.LineBasicMaterial({ color: 0x4d87a8, transparent: true, opacity: .2, depthWrite: false });
  CONSTELLATIONS_DATA.forEach(constellation => {
    const points = constellation.stars.map(point => new THREE.Vector3(...point));
    for (let index = 0; index < points.length - 1; index++) {
      constellationLines.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([points[index], points[index + 1]]),
        material
      ));
    }
  });
  constellationLines.visible = false;
  scene.add(constellationLines);
  return constellationLines;
}

export function updateStars(time) {
  // Independent, extremely slow rotations prevent the background reading as a
  // frozen image. Rotation only (never translation) keeps the sky at infinity
  // and avoids artificial parallax or discomfort in a tracked headset.
  if (skyDome) skyDome.rotation.y = time * SKY_ROTATION_RATE;
  if (proceduralStarGroup) {
    proceduralStarGroup.rotation.y = -time * STAR_DRIFT_RATE;
    proceduralStarGroup.rotation.z = Math.sin(time * 0.00007) * 0.0015;
  }

  if (famousStarGroup) {
    famousStarGroup.children.forEach(child => {
      if (child.isSprite) child.material.opacity = .54 + Math.sin(time * 1.1 + child.userData.phase) * .035;
    });
  }
  stellarSprites.forEach(sprite => {
    sprite.material.opacity = 0.78 + Math.sin(time * 0.8 + sprite.userData.phase) * 0.08;
  });
}

export function updateStarResolution() {
  // Sprites are resolution-independent; nothing to adjust here.
}

export function setStarsVisible(visible) {
  if (starEnvironment) starEnvironment.visible = visible;
  if (famousStarGroup) famousStarGroup.visible = visible;
}

export function setConstellationsVisible(visible) {
  if (constellationLines) constellationLines.visible = visible;
}
