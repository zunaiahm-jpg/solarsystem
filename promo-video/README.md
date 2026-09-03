# SolarisVR Promo Video

Self-contained Remotion project for the Solaris promotional ad. It does not import or modify the parent site's build and uses only generated graphics.

## Requirements

- Node.js 18+
- Chromium available to Remotion (the Remotion CLI can download it when needed)

## Preview and render

```bash
cd promo-video
npm ci
npm run dev
# In another terminal:
npm run preview
npm run preview:vertical
npm run render
npm run render:vertical
```

Outputs are written to `out/`. The main render is `out/solarisvr-ad.mp4`; the vertical render is `out/solarisvr-ad-vertical.mp4`. The preview still is `out/preview.png` and the vertical preview is `out/vertical-preview.png`.

The default composition is `SolarisVRPromo` at 1920x1080, 30fps, 1080 frames (36 seconds). `SolarisVRPromoVertical` is 1080x1920 with the same timing.

## Brand and licensing

The direction is grounded in the public Solaris site and the parent repository's dark space UI: deep navy `#020713`, electric cyan `#00b4ff`, solar orange `#ff7b00`, cool white, and monospace HUD labels. All scene art is procedural and self-generated. No third-party assets are required or redistributed.
