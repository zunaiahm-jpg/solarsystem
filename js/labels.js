import * as THREE from 'three';

let labelGroup = null;
let labels = []; // {sprite, position, name, minZoom, maxZoom}
let labelsVisible = false;

function makeLabel(text, color = '#ffffff', bgColor = 'rgba(5,15,40,0.7)', fontSize = 18) {
  const pixelScale = 4;
  const measureCanvas = document.createElement('canvas');
  const measureContext = measureCanvas.getContext('2d');
  measureContext.font = `600 ${fontSize}px "Exo 2", sans-serif`;
  const logicalWidth = Math.ceil(measureContext.measureText(text).width) + 28;
  const logicalHeight = fontSize + 18;

  const canvas = document.createElement('canvas');
  canvas.width = logicalWidth * pixelScale;
  canvas.height = logicalHeight * pixelScale;
  const context = canvas.getContext('2d');
  context.scale(pixelScale, pixelScale);
  context.fillStyle = bgColor;
  context.strokeStyle = 'rgba(0,180,255,.28)';
  context.lineWidth = 1;
  context.beginPath();
  context.roundRect(.5, .5, logicalWidth - 1, logicalHeight - 1, 5);
  context.fill();
  context.stroke();
  context.font = `600 ${fontSize}px "Exo 2", sans-serif`;
  context.textBaseline = 'middle';
  context.fillStyle = color;
  context.shadowColor = color;
  context.shadowBlur = 5;
  context.fillText(text, 14, logicalHeight / 2 + .5);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.userData.labelAspect = logicalWidth / logicalHeight;
  sprite.scale.set(logicalWidth * .04, logicalHeight * .04, 1);
  return sprite;
}

export function createLabels(scene, objects) {
  labelGroup = new THREE.Group();
  labelGroup.visible = false;
  labels = [];
  scene.add(labelGroup);

  objects.forEach(obj => {
    const name = obj.userData.name;
    const type = obj.userData.objectType;
    if (!name) return;
    let color = '#00d4ff';
    let fontSize = 16;
    let offsetY = 0;
    let minDist = 0;
    let maxDist = Infinity;

    if (type === 'sun') { color = '#FFD700'; fontSize = 20; offsetY = 3.5; }
    else if (type === 'planet') { color = '#88CCFF'; fontSize = 14; offsetY = obj.userData.radius + 0.8; maxDist = 600; }
    else if (type === 'moon') { color = '#AABBCC'; fontSize = 10; offsetY = obj.userData.radius + 0.5; maxDist = 50; }
    else if (type === 'star') { color = '#FFE88A'; fontSize = 13; offsetY = 15; maxDist = 3000; }
    else if (type === 'nebula') { color = '#CC88FF'; fontSize = 14; offsetY = 50; maxDist = 3000; }

    const sprite = makeLabel(name, color, 'rgba(5,12,35,0.75)', fontSize);
    sprite.position.copy(obj.position);
    sprite.position.y += offsetY;
    labelGroup.add(sprite);
    labels.push({ sprite, target: obj, offsetY, minDist, maxDist, type });
  });

  return labelGroup;
}

export function updateLabels(camera) {
  if (!labelGroup || !labelsVisible) return;
  // In VR the camera is parented to a rig, so its local position is (0,0,0).
  // Always measure from the resolved world position.
  const camPos = camera.getWorldPosition(new THREE.Vector3());

  labels.forEach(({ sprite, target, offsetY, maxDist }) => {
    const worldPos = new THREE.Vector3();
    target.getWorldPosition(worldPos);
    sprite.position.copy(worldPos);
    sprite.position.y += offsetY;

    const dist = camPos.distanceTo(worldPos);
    const visible = dist < maxDist && labelsVisible;
    sprite.visible = visible;

    if (visible) {
      // Preserve the label's true aspect ratio and high-DPI raster density.
      const height = Math.max(0.18, dist * 0.009);
      sprite.scale.set(height * sprite.userData.labelAspect, height, 1);
    }
  });
}

export function setLabelsVisible(visible) {
  labelsVisible = visible;
  if (labelGroup) labelGroup.visible = visible;
}
