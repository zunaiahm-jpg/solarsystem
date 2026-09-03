import React from 'react';
import {AbsoluteFill, Composition, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';

const C = {bg: '#020713', blue: '#00b4ff', orange: '#ff7b00', white: '#e8f4ff', muted: '#7d9bb8', green: '#00ff88'};
const stars = Array.from({length: 115}, (_, i) => ({x: (i * 83) % 100, y: (i * 47) % 100, r: (i % 3) + 1, a: 0.25 + (i % 5) / 10}));

const ease = (frame: number, start: number, end: number) => interpolate(frame, [start, end], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
const fade = (frame: number, start: number, end: number) => interpolate(frame, [start, (start + end) / 2, end], [0, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

function Stars({frame}: {frame: number}) {
  return <AbsoluteFill>{stars.map((s, i) => <div key={i} style={{position: 'absolute', left: `${s.x}%`, top: `${s.y}%`, width: s.r, height: s.r, borderRadius: '50%', background: C.white, opacity: s.a * (0.7 + Math.sin(frame / 14 + i) * 0.3), boxShadow: `0 0 ${s.r * 4}px ${C.blue}`}} />)}</AbsoluteFill>;
}

function Sun({size = 240, x = 50, y = 50, spin = 0, progress = 1}: {size?: number; x?: number; y?: number; spin?: number; progress?: number}) {
  return <div style={{position: 'absolute', left: `${x}%`, top: `${y}%`, width: size, height: size, transform: `translate(-50%, -50%) rotate(${spin}deg) scale(${progress})`, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #fff8c4 0%, #ffd166 20%, #ff8a00 55%, #bf3d00 100%)', boxShadow: `0 0 ${size * .35 * progress}px #ff8a00, 0 0 ${size * .7 * progress}px rgba(255,123,0,.3)`}} />;
}

function Planet({size = 130, x = 72, y = 50, color = '#00b4ff', ring = false, progress = 0}: {size?: number; x?: number; y?: number; color?: string; ring?: boolean; progress?: number}) {
  return <div style={{position: 'absolute', left: `${x}%`, top: `${y}%`, width: size, height: size, transform: `translate(-50%, -50%) scale(${.8 + progress * .2})`, borderRadius: '50%', background: `radial-gradient(circle at 32% 25%, #e8f4ff 0%, ${color} 28%, #061b35 100%)`, boxShadow: `inset -${size * .18}px -${size * .12}px ${size * .2}px rgba(0,0,0,.75), 0 0 ${size * .18}px ${color}`}}>{color === '#356b9e' && <div style={{position: 'absolute', inset: '13% 0 20%', borderRadius: '50%', background: 'repeating-linear-gradient(12deg, transparent 0 16px, rgba(205,240,255,.28) 18px 23px, transparent 25px 38px)', mixBlendMode: 'screen', opacity: .8}} />}{ring && <div style={{position: 'absolute', left: '-35%', top: '35%', width: '170%', height: '28%', border: `2px solid ${C.orange}`, borderRadius: '50%', transform: 'rotate(-16deg)', opacity: .8}} />}</div>;
}

function Orbit({size, rotation, opacity = .5}: {size: number; rotation: number; opacity?: number}) {
  return <div style={{position: 'absolute', left: '50%', top: '50%', width: size, height: size * .46, transform: `translate(-50%, -50%) rotate(${rotation}deg)`, border: `1px solid rgba(0,180,255,${opacity})`, borderRadius: '50%'}} />;
}

function Label({children, x, y, color = C.blue}: {children: React.ReactNode; x: number; y: number; color?: string}) {
  return <div style={{position: 'absolute', left: `${x}%`, top: `${y}%`, color, fontSize: 18, letterSpacing: 4, fontFamily: 'monospace', textTransform: 'uppercase'}}>{children}</div>;
}

function Scene({children, opacity = 1}: {children: React.ReactNode; opacity?: number}) {
  return <AbsoluteFill style={{opacity, background: C.bg, overflow: 'hidden', fontFamily: 'Arial, sans-serif'}}>{children}</AbsoluteFill>;
}

function Ad({vertical = false}: {vertical?: boolean}) {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const t = frame / 30;
  const isVertical = vertical;
  const titleSize = isVertical ? 104 : 86;
  const centerX = isVertical ? 50 : 58;
  return <Scene>
    <Stars frame={frame} />
    <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 46%, rgba(0,89,145,.18), transparent 42%), linear-gradient(125deg, rgba(0,180,255,.06), transparent 45%)'}} />
    <div style={{position: 'absolute', inset: 0, opacity: .18, backgroundImage: 'linear-gradient(rgba(0,180,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(0,180,255,.15) 1px, transparent 1px)', backgroundSize: '72px 72px', transform: `translate(${Math.sin(frame / 80) * 15}px, ${frame * .12}px)`}} />

    {/* 0-6: ignition */}
    {t < 7 && <Scene opacity={fade(frame, 0, 210)}><Stars frame={frame} /><Sun size={isVertical ? 280 : 340} x={centerX} y={52} spin={frame * .2} progress={ease(frame, 0, 60)} /><Orbit size={(isVertical ? 520 : 720) * ease(frame, 20, 100)} rotation={-12} /><Orbit size={(isVertical ? 680 : 940) * ease(frame, 35, 125)} rotation={18} opacity={.25} /><Label x={isVertical ? 12 : 11} y={14}>A NEW VIEW OF HOME</Label><div style={{position: 'absolute', left: `${isVertical ? 10 : 11}%`, top: '22%', color: C.white, fontSize: titleSize, lineHeight: .9, fontWeight: 700, letterSpacing: -3}}>STEP<br/><span style={{color: C.blue}}>INSIDE</span></div></Scene>}
    {/* 6-14: explore */}
    {t >= 5 && t < 16 && <Scene opacity={fade(frame, 150, 480)}><Stars frame={frame} /><Orbit size={isVertical ? 760 : 980} rotation={-16} /><Orbit size={isVertical ? 990 : 1260} rotation={14} opacity={.28} /><Sun size={isVertical ? 190 : 230} x={centerX - 12} y={57} spin={frame * .3} /><Planet size={isVertical ? 120 : 145} x={centerX + 22 + Math.sin(frame / 54) * 13} y={37 + Math.cos(frame / 54) * 7} color="#497bba" progress={ease(frame, 180, 390)} /><Planet size={isVertical ? 80 : 98} x={centerX + 36 + Math.sin(frame / 40 + 2) * 15} y={67 + Math.cos(frame / 40 + 2) * 8} color="#d76a3f" progress={ease(frame, 230, 430)} /><Planet size={isVertical ? 72 : 88} x={centerX - 33 + Math.sin(frame / 45 + 4) * 11} y={41 + Math.cos(frame / 45 + 4) * 6} color="#b57a55" ring progress={ease(frame, 270, 450)} /><Label x={isVertical ? 10 : 11} y={15}>REAL ORBITAL MOTION</Label><div style={{position: 'absolute', left: `${isVertical ? 10 : 11}%`, bottom: isVertical ? '19%' : '17%', color: C.white, fontSize: isVertical ? 48 : 42, maxWidth: isVertical ? '80%' : '55%', lineHeight: 1.05}}>Explore every world.<br/><span style={{color: C.orange}}>At your pace.</span></div></Scene>}
    {/* 14-22: detail */}
    {t >= 14 && t < 24 && <Scene opacity={fade(frame, 420, 720)}><Stars frame={frame} /><div style={{position: 'absolute', inset: 0, background: 'radial-gradient(circle at 66% 50%, rgba(0,180,255,.28), transparent 35%)'}} /><Planet size={isVertical ? 460 : 500} x={isVertical ? 50 : 68} y={50} color="#356b9e" ring progress={ease(frame, 450, 650)} /><div style={{position: 'absolute', left: `${isVertical ? 9 : 10}%`, top: '16%', color: C.blue, fontFamily: 'monospace', fontSize: 18, letterSpacing: 4}}>ADAPTIVE 8K / LIVE EARTH</div><div style={{position: 'absolute', left: `${isVertical ? 9 : 10}%`, top: '25%', color: C.white, fontSize: isVertical ? 66 : 62, lineHeight: .96, fontWeight: 700}}>See the<br/><span style={{color: C.blue}}>unseen.</span></div><div style={{position: 'absolute', left: `${isVertical ? 9 : 10}%`, bottom: '18%', width: isVertical ? '82%' : '35%', color: C.muted, fontSize: 22, lineHeight: 1.4}}>High-resolution NASA textures. Living clouds. A solar system that moves with you.</div></Scene>}
    {/* 22-30: VR */}
    {t >= 22 && t < 32 && <Scene opacity={fade(frame, 660, 960)}><Stars frame={frame} /><Sun size={isVertical ? 100 : 130} x={isVertical ? 50 : 72} y={50} /><Planet size={isVertical ? 90 : 110} x={isVertical ? 22 + Math.sin(frame / 38) * 7 : 57 + Math.sin(frame / 38) * 7} y={37 + Math.cos(frame / 38) * 5} color="#487cb0" /><Planet size={isVertical ? 62 : 75} x={isVertical ? 78 + Math.sin(frame / 32) * 8 : 66 + Math.sin(frame / 32) * 8} y={67 + Math.cos(frame / 32) * 5} color="#c66a44" /><div style={{position: 'absolute', left: `${isVertical ? 9 : 10}%`, top: '16%', color: C.orange, fontFamily: 'monospace', fontSize: 18, letterSpacing: 4}}>WEBXR / NO INSTALL</div><div style={{position: 'absolute', left: `${isVertical ? 9 : 10}%`, top: '25%', color: C.white, fontSize: isVertical ? 67 : 62, lineHeight: .95, fontWeight: 700}}>Put on<br/><span style={{color: C.orange}}>wonder.</span></div><div style={{position: 'absolute', left: `${isVertical ? 9 : 10}%`, bottom: '17%', color: C.muted, fontSize: 22}}>Step into a living model of our solar system.</div><div style={{position: 'absolute', right: isVertical ? '9%' : '10%', bottom: '10%', border: `1px solid ${C.orange}`, color: C.orange, padding: '10px 14px', fontFamily: 'monospace', letterSpacing: 2}}>ENTER VR&nbsp; ↗</div></Scene>}
    {/* 30-36: CTA */}
    {t >= 30 && <Scene opacity={fade(frame, 900, durationInFrames)}><Stars frame={frame} /><Sun size={isVertical ? 170 : 210} x={50} y={isVertical ? 30 : 43} spin={frame * .25} /><div style={{position: 'absolute', left: 0, right: 0, top: isVertical ? '52%' : '60%', textAlign: 'center', color: C.white, fontSize: isVertical ? 86 : 74, fontWeight: 700, letterSpacing: -2}}>SOLARIS<span style={{color: C.blue}}>VR</span></div><div style={{position: 'absolute', left: 0, right: 0, top: isVertical ? '61%' : '70%', textAlign: 'center', color: C.muted, fontFamily: 'monospace', fontSize: 20, letterSpacing: 5}}>THE SOLAR SYSTEM, YOURS TO EXPLORE</div><div style={{position: 'absolute', left: 0, right: 0, bottom: isVertical ? '15%' : '12%', textAlign: 'center', color: C.orange, fontSize: 38, fontFamily: 'monospace', letterSpacing: 3}}>solarisvr.com</div></Scene>}
  </Scene>;
}

export const RemotionRoot: React.FC = () => <>
  <Composition id="SolarisVRPromo" component={() => <Ad />} durationInFrames={1080} fps={30} width={1920} height={1080} />
  <Composition id="SolarisVRPromoVertical" component={() => <Ad vertical />} durationInFrames={1080} fps={30} width={1080} height={1920} />
</>;
