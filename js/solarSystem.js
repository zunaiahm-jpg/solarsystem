import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { PLANETS_DATA, SUN_DATA } from './data.js';

const TEXTURE_ROOT = './assets/textures/';
const LIVE_EARTH_CLOUDS = 'https://clouds.matteason.co.uk/images/8192x4096/clouds-alpha.png';
const J2000 = Date.UTC(2000, 0, 1, 12, 0, 0);
const J2000_LONGITUDE = {
  mercury: 252.251, venus: 181.980, earth: 100.464, mars: 355.453,
  jupiter: 34.404, saturn: 49.944, uranus: 313.232, neptune: 304.880
};
const TEXTURES = {
  mercury: '8k_mercury.jpg', venus: '8k_venus_surface.jpg', earth: '8k_earth_daymap.jpg',
  mars: '8k_mars.jpg', jupiter: '8k_jupiter.jpg', saturn: '8k_saturn.jpg',
  uranus: '2k_uranus.jpg', neptune: '2k_neptune.jpg'
};

const ATMO_VERT = `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  void main() {
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;
const ATMO_FRAG = `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uPower;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;
  void main() {
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float fresnel = pow(1.0 - abs(dot(viewDirection, vWorldNormal)), uPower);
    float alpha = fresnel * uIntensity;
    gl_FragColor = vec4(uColor * (0.45 + fresnel), alpha);
  }
`;

export let solarSystemObjects = [];
let planets = [];
let sunMesh = null;
let sunGlowSprites = [];
let asteroidBelt = null;
let orbitsGroup = null;
let planetsGroup = null;
let selectionRing = null;

let earthClouds = null;
let lastElapsed = 0;
let maxAnisotropy = 8;
let sphereSegments = 96;
const orbitMaterials = [];

const loadingManager = new THREE.LoadingManager();
loadingManager.onProgress = (_url, loaded, total) => {
  window.dispatchEvent(new CustomEvent('space-texture-progress', { detail: { loaded, total } }));
};
loadingManager.onLoad = () => {
  window._spaceTexturesReady = true;
  window.dispatchEvent(new Event('space-textures-ready'));
};
const textureLoader = new THREE.TextureLoader(loadingManager);
textureLoader.setCrossOrigin('anonymous');

function configureTexture(texture, color = true) {
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.wrapS = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function loadTexture(file, color = true, onLoad, onError) {
  return textureLoader.load(
    file.startsWith('http') ? file : TEXTURE_ROOT + file,
    texture => {
      configureTexture(texture, color);
      if (onLoad) onLoad(texture);
    },
    undefined,
    error => {
      console.warn(`Texture could not be loaded: ${file}`, error);
      if (onError) onError(error);
    }
  );
}

function currentOrbitalAngle(data) {
  const daysSinceJ2000 = (Date.now() - J2000) / 86400000;
  const longitude = J2000_LONGITUDE[data.id] ?? 0;
  return THREE.MathUtils.degToRad(longitude) + (daysSinceJ2000 / data.period) * Math.PI * 2;
}

function createAtmosphere(radius, color, intensity, power = 2.2) {
  const geometry = new THREE.SphereGeometry(radius * 1.08, 64, 64);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: intensity },
      uPower: { value: power }
    },
    vertexShader: ATMO_VERT,
    fragmentShader: ATMO_FRAG,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  return new THREE.Mesh(geometry, material);
}

function makeCoronaTexture(core, middle) {
  const size = 2048;
  const center = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, core);
  gradient.addColorStop(0.08, 'rgba(255,250,220,.96)');
  gradient.addColorStop(0.22, middle);
  gradient.addColorStop(0.55, 'rgba(255,125,20,.16)');
  gradient.addColorStop(1, 'rgba(255,70,0,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  return configureTexture(new THREE.CanvasTexture(canvas));
}

function makeSunFlareTexture() {
  const size = 2048;
  const center = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  context.translate(center, center);
  const gradient = context.createRadialGradient(0, 0, 0, 0, 0, center - 8);
  gradient.addColorStop(0, 'rgba(255,255,255,.95)');
  gradient.addColorStop(.025, 'rgba(255,225,140,.75)');
  gradient.addColorStop(.12, 'rgba(255,150,35,.16)');
  gradient.addColorStop(1, 'rgba(255,90,0,0)');
  context.fillStyle = gradient;
  context.fillRect(-center, -center, size, size);
  context.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 96; i++) {
    context.rotate(Math.PI / 48);
    const length = size * .25 + Math.random() * size * .23;
    const ray = context.createLinearGradient(0, 0, length, 0);
    ray.addColorStop(0, 'rgba(255,210,110,.09)');
    ray.addColorStop(1, 'rgba(255,120,20,0)');
    context.fillStyle = ray;
    context.fillRect(0, -2.4, length, 4.8);
  }
  return configureTexture(new THREE.CanvasTexture(canvas));
}

function createSun(scene) {
  const texture = loadTexture('8k_sun.jpg');
  const geometry = new THREE.SphereGeometry(SUN_DATA.radius, 128, 128);
  const material = new THREE.MeshBasicMaterial({ map: texture, color: 0xfff1c2 });
  sunMesh = new THREE.Mesh(geometry, material);
  sunMesh.userData = { ...SUN_DATA, objectType: 'sun' };
  planetsGroup.add(sunMesh);
  solarSystemObjects.push(sunMesh);

  // Scaled-space illumination: preserves the visual falloff of sunlight while
  // keeping the distant ice giants visible after camera exposure adjustment.
  const sunlight = new THREE.PointLight(0xfff3d0, 800, 0, 1.35);
  sunlight.position.set(0, 0, 0);
  planetsGroup.add(sunlight);
  scene.add(new THREE.AmbientLight(0x06091a, 0.32));

  const coronaTexture = makeCoronaTexture('rgba(255,255,255,1)', 'rgba(255,190,65,.58)');
  const flareTexture = makeSunFlareTexture();
  const layers = [
    { scale: 8.5, opacity: .78, texture: coronaTexture },
    { scale: 15, opacity: .32, texture: coronaTexture },
    { scale: 28, opacity: .12, texture: flareTexture },
    { scale: 48, opacity: .055, texture: flareTexture }
  ];
  sunGlowSprites = layers.map((layer, index) => {
    const material = new THREE.SpriteMaterial({
      map: layer.texture, transparent: true, opacity: layer.opacity,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.setScalar(SUN_DATA.radius * layer.scale);
    sprite.userData.baseScale = SUN_DATA.radius * layer.scale;
    sprite.userData.phase = index * 1.7;
    planetsGroup.add(sprite);
    return sprite;
  });
}

function makePlanetMaterial(data) {
  const map = loadTexture(TEXTURES[data.id]);
  const parameters = {
    map,
    roughness: data.id === 'earth' ? 0.72 : data.roughness,
    metalness: 0,
    color: 0xffffff
  };

  if (data.id === 'earth') {
    parameters.emissiveMap = loadTexture('8k_earth_nightmap.jpg');
    parameters.emissive = new THREE.Color(0xffbd70);
    parameters.emissiveIntensity = 1.15;
  }

  const material = new THREE.MeshStandardMaterial(parameters);

  // Ice giants have only 2K base maps from NASA; layer subtle procedural
  // banding and atmospheric turbulence on top so close-up views still feel
  // detailed (matching what JWST/Keck imagery reveals).
  if (data.id === 'uranus' || data.id === 'neptune') {
    const tint = data.id === 'uranus' ? new THREE.Color(0x88e0e0) : new THREE.Color(0x4470ff);
    material.onBeforeCompile = shader => {
      shader.uniforms.uIceTint = { value: tint };
      shader.uniforms.uIceSeed = { value: data.id === 'uranus' ? 11.2 : 27.7 };
      shader.uniforms.uTime = { value: 0 };
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vIceLocalPos;'
      ).replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvIceLocalPos = position;'
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
         varying vec3 vIceLocalPos;
         uniform vec3 uIceTint;
         uniform float uIceSeed;
         uniform float uTime;
         float iceHash(vec3 p){p=fract(p*0.3183099+vec3(0.1,0.2,0.3));p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
         float iceNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
           return mix(mix(mix(iceHash(i),iceHash(i+vec3(1,0,0)),f.x),
                          mix(iceHash(i+vec3(0,1,0)),iceHash(i+vec3(1,1,0)),f.x),f.y),
                      mix(mix(iceHash(i+vec3(0,0,1)),iceHash(i+vec3(1,0,1)),f.x),
                          mix(iceHash(i+vec3(0,1,1)),iceHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
         float iceFbm(vec3 p){float v=0.0,a=0.5;for(int i=0;i<5;i++){v+=iceNoise(p)*a;p=p*2.07+vec3(7.3,3.1,5.2);a*=0.5;}return v;}`
      ).replace(
        '#include <map_fragment>',
        `#include <map_fragment>
         vec3 npos = normalize(vIceLocalPos);
         float bands = sin(npos.y * 22.0 + iceFbm(npos*3.0)*3.5) * 0.5 + 0.5;
         float storms = iceFbm(npos * 6.0 + uIceSeed);
         vec3 detail = mix(uIceTint * 0.6, uIceTint * 1.4, smoothstep(0.35, 0.85, bands * 0.6 + storms * 0.4));
         diffuseColor.rgb = mix(diffuseColor.rgb, mix(diffuseColor.rgb, detail, 0.42), 0.55);`
      );
    };
    // Stash a time uniform on the material so updateSolarSystem can animate it
    material.userData.iceTime = { value: 0 };
  }

  return material;
}

function createEarthCloudLayer(radius) {
  const geometry = new THREE.SphereGeometry(radius * 1.012, sphereSegments, sphereSegments);
  const material = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide
  });
  earthClouds = new THREE.Mesh(geometry, material);
  loadTexture(
    LIVE_EARTH_CLOUDS,
    true,
    texture => {
      material.map = texture;
      material.alphaMap = texture;
      material.opacity = 0.82;
      material.needsUpdate = true;
    },
    () => { earthClouds.visible = false; }
  );
  return earthClouds;
}

function createSaturnRings(radius) {
  const inner = radius * 1.25;
  const outer = radius * 2.55;
  const geometry = new THREE.RingGeometry(inner, outer, 256, 1);
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const vector = new THREE.Vector3();
  for (let index = 0; index < position.count; index++) {
    vector.fromBufferAttribute(position, index);
    uv.setXY(index, (vector.length() - inner) / (outer - inner), 0.5);
  }
  const texture = loadTexture('8k_saturn_ring_alpha.png');
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    alphaMap: texture,
    color: 0xd7c49a,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
    depthWrite: false,
    roughness: 0.86,
    metalness: 0
  });
  const ring = new THREE.Mesh(geometry, material);
  ring.rotation.x = Math.PI / 2;
  return ring;
}

function makeOrbitLine(radius, inclination = 0) {
  const positions = [];
  const inclinationRadians = THREE.MathUtils.degToRad(inclination);
  for (let index = 0; index <= 512; index++) {
    const angle = index / 512 * Math.PI * 2;
    positions.push(
      Math.cos(angle) * radius,
      Math.sin(angle) * Math.sin(inclinationRadians) * radius,
      Math.sin(angle) * Math.cos(inclinationRadians) * radius
    );
  }
  const geometry = new LineGeometry();
  geometry.setPositions(positions);
  const material = new LineMaterial({
    color: 0x287aa5,
    linewidth: 1.1,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    worldUnits: false,
    alphaToCoverage: true
  });
  material.resolution.set(window.innerWidth, window.innerHeight);
  orbitMaterials.push(material);
  const line = new Line2(geometry, material);
  line.computeLineDistances();
  return line;
}

function makeSelectionRing(radius) {
  const group = new THREE.Group();
  [1.75, 2.05].forEach((scale, layer) => {
    const points = [];
    for (let index = 0; index <= 128; index++) {
      const angle = index / 128 * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(angle) * radius * scale, 0, Math.sin(angle) * radius * scale));
    }
    group.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: layer ? 0x00b4ff : 0x00ff99, transparent: true, opacity: layer ? .32 : .85 })
    ));
  });
  return group;
}

function createMoon(moonData, parent, initialAngle) {
  const isEarthMoon = moonData.name === 'Moon';
  const texture = isEarthMoon ? loadTexture('8k_moon.jpg') : null;
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    color: texture ? 0xffffff : moonData.color,
    roughness: .94,
    metalness: 0
  });
  if (isEarthMoon) {
    material.bumpMap = texture;
    material.bumpScale = 0.008;
  }
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(moonData.radius, 64, 64), material);
  mesh.position.set(Math.cos(initialAngle) * moonData.distance, 0, Math.sin(initialAngle) * moonData.distance);
  mesh.userData = {
    id: moonData.name, name: moonData.name, objectType: 'moon', radius: moonData.radius,
    emoji: moonData.emoji || '🌑', description: moonData.description || '', stats: moonData.stats || {}
  };
  parent.add(mesh);
  solarSystemObjects.push(mesh);
  return mesh;
}

function createAsteroidBelt(scene) {
  // The real asteroid belt is mostly empty space. Use sparse physical geometry
  // instead of billboard particles, so distant objects vanish rather than
  // becoming a wall of square pixels.
  asteroidBelt = new THREE.Group();
  const variants = 3;
  const instancesPerVariant = 240;
  const dummy = new THREE.Object3D();

  for (let variant = 0; variant < variants; variant++) {
    const geometry = new THREE.DodecahedronGeometry(1, variant === 0 ? 0 : 1);
    const material = new THREE.MeshStandardMaterial({
      color: 0x6f685d,
      roughness: 0.98,
      metalness: 0.02,
      flatShading: true,
      vertexColors: true
    });
    const rocks = new THREE.InstancedMesh(geometry, material, instancesPerVariant);
    rocks.frustumCulled = false;

    for (let index = 0; index < instancesPerVariant; index++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 28 + Math.random() * 14;
      const size = 0.012 + Math.pow(Math.random(), 5) * 0.11;
      dummy.position.set(
        Math.cos(angle) * distance,
        (Math.random() - 0.5) * 0.55,
        Math.sin(angle) * distance
      );
      dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      dummy.scale.set(
        size * (0.65 + Math.random() * 0.7),
        size * (0.55 + Math.random() * 0.9),
        size * (0.65 + Math.random() * 0.7)
      );
      dummy.updateMatrix();
      rocks.setMatrixAt(index, dummy.matrix);
      const shade = 0.28 + Math.random() * 0.2;
      rocks.setColorAt(index, new THREE.Color().setRGB(shade, shade * 0.91, shade * 0.8));
    }
    rocks.instanceMatrix.needsUpdate = true;
    if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true;
    asteroidBelt.add(rocks);
  }

  scene.add(asteroidBelt);
}

export function createSolarSystem(scene, renderer) {
  solarSystemObjects = [];
  planets = [];
  orbitMaterials.length = 0;
  planetsGroup = new THREE.Group();
  orbitsGroup = new THREE.Group();
  orbitsGroup.visible = false;
  scene.add(planetsGroup, orbitsGroup);

  if (renderer) {
    maxAnisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
    const lowPower = navigator.deviceMemory && navigator.deviceMemory <= 4;
    sphereSegments = lowPower ? 64 : 256;
  }

  createSun(scene);

  PLANETS_DATA.forEach(data => {
    const geometry = new THREE.SphereGeometry(data.radius, sphereSegments, sphereSegments);
    const mesh = new THREE.Mesh(geometry, makePlanetMaterial(data));
    const angle = currentOrbitalAngle(data);
    mesh.position.set(Math.cos(angle) * data.distance, 0, Math.sin(angle) * data.distance);
    mesh.rotation.z = THREE.MathUtils.degToRad(data.tilt || 0);
    mesh.userData = {
      id: data.id, name: data.name, type: data.type, objectType: 'planet', radius: data.radius,
      distance: data.distance, emoji: data.emoji, description: data.description, stats: data.stats
    };
    planetsGroup.add(mesh);
    solarSystemObjects.push(mesh);

    if (data.id === 'earth') mesh.add(createEarthCloudLayer(data.radius));
    if (data.atmosphereColor && data.atmosphereIntensity) {
      mesh.add(createAtmosphere(data.radius, data.atmosphereColor, data.atmosphereIntensity * 1.2, data.id === 'earth' ? 2.8 : 2.2));
    }
    if (data.rings) mesh.add(createSaturnRings(data.radius));
    orbitsGroup.add(makeOrbitLine(data.distance, data.inclination || 0));

    const moons = (data.moons || []).map((moonData, index) => {
      const moonAngle = angle * (index + 1.7);
      return { mesh: createMoon(moonData, mesh, moonAngle), data: moonData, angle: moonAngle };
    });
    planets.push({ mesh, data, angle, moons });
  });

  createAsteroidBelt(scene);
  return { sun: sunMesh, planets, orbitsGroup, planetsGroup };
}

export function updateSolarSystem(elapsed, timeScale) {
  const deltaSeconds = Math.min(.1, Math.max(0, elapsed - lastElapsed));
  lastElapsed = elapsed;
  const simulatedDays = deltaSeconds * timeScale;

  if (sunMesh) sunMesh.rotation.y += deltaSeconds * .025;
  sunGlowSprites.forEach((sprite, index) => {
    const pulse = 1 + Math.sin(elapsed * (.28 + index * .05) + sprite.userData.phase) * (.025 + index * .008);
    sprite.scale.setScalar(sprite.userData.baseScale * pulse);
    sprite.material.rotation = elapsed * (index % 2 ? -.006 : .004);
  });

  planets.forEach(planet => {
    planet.angle += simulatedDays * Math.PI * 2 / planet.data.period;
    const inclination = THREE.MathUtils.degToRad(planet.data.inclination || 0);
    planet.mesh.position.set(
      Math.cos(planet.angle) * planet.data.distance,
      Math.sin(planet.angle) * Math.sin(inclination) * planet.data.distance,
      Math.sin(planet.angle) * Math.cos(inclination) * planet.data.distance
    );
    planet.mesh.rotation.y += deltaSeconds * (.04 + 12 / Math.sqrt(planet.data.period));
    planet.moons.forEach(moon => {
      moon.angle += simulatedDays * Math.PI * 2 / moon.data.period;
      moon.mesh.position.set(
        Math.cos(moon.angle) * moon.data.distance,
        0,
        Math.sin(moon.angle) * moon.data.distance
      );
      moon.mesh.rotation.y += deltaSeconds * .08;
    });
  });

  if (earthClouds) earthClouds.rotation.y += deltaSeconds * .008;
  if (asteroidBelt) asteroidBelt.rotation.y += deltaSeconds * .0015;
  if (selectionRing) selectionRing.rotation.y += deltaSeconds * .55;
}

export function selectObject(mesh) {
  deselectAll();
  if (!mesh) return;

  selectionRing = makeSelectionRing(mesh.userData.radius || 1);
  mesh.add(selectionRing);
}

export function deselectAll() {
  if (selectionRing?.parent) selectionRing.parent.remove(selectionRing);
  selectionRing = null;

}

export function updateOrbitResolution(width, height) {
  orbitMaterials.forEach(material => material.resolution.set(width, height));
}

export function setPlanetsVisible(visible) { if (planetsGroup) planetsGroup.visible = visible; }
export function setOrbitsVisible(visible) { if (orbitsGroup) orbitsGroup.visible = visible; }
export function setAsteroidBeltVisible(visible) { if (asteroidBelt) asteroidBelt.visible = visible; }
export function getPlanetByName(name) { return planets.find(planet => planet.data.name.toLowerCase() === name.toLowerCase()); }
export function getSunMesh() { return sunMesh; }
