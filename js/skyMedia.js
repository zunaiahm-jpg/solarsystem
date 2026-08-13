// ─────────────────────────────────────────────────────────────────────────────
// skyMedia.js — the all-sky plate pipeline
//
// The sky is loaded in escalating tiers so the scene is never empty and never
// blurrier than the hardware can actually display:
//
//   1. 4K NASA plate  — decoded first, appears almost instantly.
//   2. 8K NASA plate  — swapped in once decoded, if the GPU can sample it.
//   3. Looping video  — swapped in *only* if a loop file has been built and the
//                       device can decode it at that resolution.
//
// Every tier is optional and every failure falls back to the tier below, so a
// missing file or a codec the headset cannot handle never breaks the sky.
//
// A note on "motion": a real star field does not move. What reads as crawling
// static in a rendered sky is aliasing — sub-pixel stars flickering between
// frames — not animation. That is fixed with mipmaps + anisotropy below, not
// with video. Video is supported for hand-authored plates (aurora, drifting
// nebula, gas motion), but it is never required.
// ─────────────────────────────────────────────────────────────────────────────

import * as THREE from 'three';

// Still plates, lowest tier first. Each is a full equirectangular 2:1 panorama.
const STILL_TIERS = [
  { url: './assets/sky/starmap-nasa-4k.jpg', width: 4096, label: '4K still' },
  { url: './assets/sky/starmap-nasa-8k.jpg', width: 8192, label: '8K still' }
];

// Optional looping plates, highest tier first. Build them with
// `node tools/build-sky-video.mjs`; the sky works perfectly without them.
const VIDEO_TIERS = [
  {
    url: './assets/sky/starmap-nasa-8k-loop.mp4',
    width: 8192,
    label: '8K video',
    mime: 'video/mp4; codecs="hvc1"'
  },
  {
    url: './assets/sky/starmap-nasa-8k-loop.webm',
    width: 8192,
    label: '8K video',
    mime: 'video/webm; codecs="vp9"'
  },
  {
    url: './assets/sky/starmap-nasa-4k-loop.mp4',
    width: 4096,
    label: '4K video',
    mime: 'video/mp4; codecs="avc1.640034"'
  }
];

export const skyStatus = {
  tier: 'none',
  source: null,
  width: 0,
  animated: false,
  maxTextureSize: 0,
  deviceMemory: null,
  videoRejectedBecause: 'not probed yet'
};

function detectCapabilities(renderer) {
  const maxTextureSize = renderer ? renderer.capabilities.maxTextureSize : 4096;
  const deviceMemory = typeof navigator.deviceMemory === 'number' ? navigator.deviceMemory : null;
  const connection = navigator.connection || {};
  skyStatus.maxTextureSize = maxTextureSize;
  skyStatus.deviceMemory = deviceMemory;

  return {
    maxTextureSize,
    // An 8K RGBA mipmapped plate costs roughly 170 MB of VRAM. Machines that
    // report 4 GB or less of system memory are given the 4K plate instead.
    memoryBudget: deviceMemory === null ? 8 : deviceMemory,
    saveData: connection.saveData === true,
    reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  };
}

function applyPlateFiltering(texture, renderer) {
  // NoColorSpace: the sky shader re-linearises with pow(texel, 2.2) itself.
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  // Mipmaps plus maximum anisotropy are what stop a dense star plate from
  // boiling into crawling static when the camera turns.
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  if (renderer) texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  texture.needsUpdate = true;
  return texture;
}

function loadStill(url, renderer) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (texture) => resolve(applyPlateFiltering(texture, renderer)),
      undefined,
      reject
    );
  });
}

/** Does this build even have a loop file, and can the decoder handle it? */
async function probeVideoTier(tier, caps) {
  const probe = document.createElement('video');
  const support = probe.canPlayType(tier.mime);
  if (support !== 'probably' && support !== 'maybe') return `codec unsupported (${tier.mime})`;
  if (tier.width > caps.maxTextureSize) return `GPU max texture ${caps.maxTextureSize}px`;

  try {
    const response = await fetch(tier.url, { method: 'HEAD', cache: 'no-store' });
    if (!response.ok) return `no loop file (${response.status})`;
  } catch {
    return 'no loop file';
  }
  return null; // usable
}

function startVideo(tier) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = tier.url;
    video.loop = true;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.preload = 'auto';
    video.setAttribute('aria-hidden', 'true');
    video.style.display = 'none';
    document.body.appendChild(video);

    const fail = (reason) => {
      video.remove();
      reject(new Error(reason));
    };

    video.addEventListener('error', () => fail('decode error'), { once: true });
    video.addEventListener('canplaythrough', () => resolve(video), { once: true });

    const attempt = () => video.play().catch(() => {
      // Autoplay blocked: retry on the first interaction, which in VR is the
      // same gesture that starts the immersive session.
      const retry = () => {
        video.play().catch(() => {});
        window.removeEventListener('pointerdown', retry);
      };
      window.addEventListener('pointerdown', retry, { once: true });
    });
    attempt();

    setTimeout(() => {
      if (video.readyState < 3) fail('timed out buffering');
    }, 12000);
  });
}

/**
 * Load the best sky the device can render, calling `onTexture` once per tier
 * as each becomes available. Never rejects — the caller always keeps whatever
 * tier last succeeded.
 */
export async function loadSky({ renderer, onTexture, onStatus }) {
  const caps = detectCapabilities(renderer);
  const report = (tier, source, width, animated) => {
    skyStatus.tier = tier;
    skyStatus.source = source;
    skyStatus.width = width;
    skyStatus.animated = animated;
    onStatus?.(skyStatus);
  };

  const affordable = STILL_TIERS.filter(
    (tier) => tier.width <= caps.maxTextureSize && (tier.width <= 4096 || caps.memoryBudget >= 6)
  );
  const plates = affordable.length ? affordable : [STILL_TIERS[0]];

  for (const tier of plates) {
    try {
      const texture = await loadStill(tier.url, renderer);
      onTexture(texture, tier);
      report(tier.label, tier.url, tier.width, false);
    } catch (error) {
      console.warn(`[sky] ${tier.label} unavailable`, error);
    }
  }

  if (caps.saveData || caps.reducedMotion) {
    skyStatus.videoRejectedBecause = caps.saveData ? 'data saver on' : 'reduced motion on';
    onStatus?.(skyStatus);
    return skyStatus;
  }

  for (const tier of VIDEO_TIERS) {
    const rejection = await probeVideoTier(tier, caps);
    if (rejection) {
      skyStatus.videoRejectedBecause = rejection;
      continue;
    }
    try {
      const video = await startVideo(tier);
      const texture = new THREE.VideoTexture(video);
      texture.colorSpace = THREE.NoColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      onTexture(texture, tier);
      report(tier.label, tier.url, tier.width, true);
      skyStatus.videoRejectedBecause = null;
      return skyStatus;
    } catch (error) {
      skyStatus.videoRejectedBecause = error.message;
    }
  }

  onStatus?.(skyStatus);
  return skyStatus;
}
