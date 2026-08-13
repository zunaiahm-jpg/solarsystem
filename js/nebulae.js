import * as THREE from 'three';
import { NEBULAE_DATA } from './data.js';

export let nebulaObjects = [];
let nebulaGroup = null;
const nebulaMaterials = [];

const VOLUME_VERT = `
  varying vec3 vLocalPosition;
  varying vec3 vWorldPosition;
  varying vec3 vNormalDirection;
  void main() {
    vLocalPosition = position;
    vNormalDirection = normalize(normalMatrix * normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const VOLUME_FRAG = `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uSeed;
  varying vec3 vLocalPosition;
  varying vec3 vWorldPosition;
  varying vec3 vNormalDirection;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z
    );
  }

  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.52;
    for (int i = 0; i < 6; i++) {
      value += noise(p) * amplitude;
      p = p * 2.03 + vec3(11.7, 5.2, 8.3);
      amplitude *= 0.49;
    }
    return value;
  }

  void main() {
    vec3 normalizedPosition = normalize(vLocalPosition);
    vec3 flow = vec3(uTime * 0.006, -uTime * 0.003, uTime * 0.004);
    float broad = fbm(normalizedPosition * 2.1 + uSeed + flow);
    float detail = fbm(normalizedPosition * 6.2 - uSeed - flow * 1.7);
    float density = smoothstep(0.45, 0.82, broad * 0.72 + detail * 0.38);

    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float rim = pow(1.0 - abs(dot(viewDirection, vNormalDirection)), 1.7);
    float softVolume = density * (0.24 + rim * 0.76);
    vec3 color = mix(uColorA, uColorB, detail);
    float alpha = softVolume * uOpacity;
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(color * (0.55 + detail * 0.7), alpha);
  }
`;

function createVolumeMaterial(data, layer) {
  const colors = [data.color1, data.color2, data.color3];
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColorA: { value: new THREE.Color(colors[layer % colors.length]) },
      uColorB: { value: new THREE.Color(colors[(layer + 1) % colors.length]) },
      uOpacity: { value: 0.075 - layer * 0.014 },
      uTime: { value: 0 },
      uSeed: { value: Math.random() * 30 }
    },
    vertexShader: VOLUME_VERT,
    fragmentShader: VOLUME_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    toneMapped: true
  });
  nebulaMaterials.push(material);
  return material;
}

export function createNebulae(scene) {
  nebulaObjects = [];
  nebulaMaterials.length = 0;
  nebulaGroup = new THREE.Group();

  NEBULAE_DATA.forEach((data, nebulaIndex) => {
    const volumeGroup = new THREE.Group();
    volumeGroup.position.set(data.x, data.y, data.z);
    volumeGroup.rotation.set(nebulaIndex * 0.7, nebulaIndex * 1.1, nebulaIndex * 0.3);

    for (let layer = 0; layer < 3; layer++) {
      const geometry = new THREE.SphereGeometry(data.size * (0.32 + layer * 0.08), 96, 64);
      const volume = new THREE.Mesh(geometry, createVolumeMaterial(data, layer));
      volume.scale.set(1.35 + layer * .1, 0.58 + layer * .07, 0.9 + layer * .06);
      volume.rotation.y = layer * 1.9;
      volumeGroup.add(volume);
    }

    const hitMesh = new THREE.Mesh(
      new THREE.SphereGeometry(data.size * .42, 16, 12),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitMesh.userData = { ...data, objectType: 'nebula' };
    volumeGroup.add(hitMesh);
    nebulaObjects.push(hitMesh);
    nebulaGroup.add(volumeGroup);
  });

  // Nearby space is visually dark. Deep-sky emission is an optional exposure
  // layer rather than a cloud physically sitting inside the Solar System.
  nebulaGroup.visible = false;
  scene.add(nebulaGroup);
  return nebulaGroup;
}

export function updateNebulae(time) {
  nebulaMaterials.forEach((material, index) => {
    material.uniforms.uTime.value = time + index * 9.7;
  });
}

export function setNebulaeVisible(visible) {
  if (nebulaGroup) nebulaGroup.visible = visible;
}
