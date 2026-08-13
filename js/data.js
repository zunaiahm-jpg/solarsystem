// All data needed for the 3D space map

export const PLANETS_DATA = [
  {
    id: 'mercury', name: 'Mercury', type: 'Planet',
    radius: 0.22, distance: 5.8, period: 88, tilt: 0.034, inclination: 7.0,
    color: 0x8C7853, roughness: 0.95, metalness: 0.0,
    atmosphereColor: 0x998877, atmosphereIntensity: 0.08,
    emoji: '⚫',
    description: 'The smallest planet in the Solar System and closest to the Sun. Mercury has no atmosphere, leading to extreme temperature swings from -180°C at night to 430°C during the day.',
    stats: { 'Type': 'Terrestrial', 'Radius': '2,440 km', 'Distance from Sun': '0.39 AU', 'Orbital Period': '88 days', 'Moons': '0', 'Temperature Range': '-180°C to 430°C', 'Gravity': '3.7 m/s²' }
  },
  {
    id: 'venus', name: 'Venus', type: 'Planet',
    radius: 0.38, distance: 10.8, period: 225, tilt: 177.4, inclination: 3.4,
    color: 0xE8C073, roughness: 0.7, metalness: 0.0,
    atmosphereColor: 0xFFE9B0, atmosphereIntensity: 0.9,
    emoji: '🟡',
    description: 'The hottest planet in the Solar System due to a runaway greenhouse effect. Venus rotates backwards and has crushing atmospheric pressure 92 times that of Earth.',
    stats: { 'Type': 'Terrestrial', 'Radius': '6,051 km', 'Distance from Sun': '0.72 AU', 'Orbital Period': '225 days', 'Moons': '0', 'Surface Temperature': '465°C', 'Gravity': '8.87 m/s²' }
  },
  {
    id: 'earth', name: 'Earth', type: 'Planet',
    radius: 0.4, distance: 15, period: 365, tilt: 23.4, inclination: 0.0,
    color: 0x2E86AB, roughness: 0.6, metalness: 0.1,
    atmosphereColor: 0x4FC3F7, atmosphereIntensity: 0.75,
    emoji: '🌍',
    description: 'Our home planet — the only known world harboring life. Earth has liquid water oceans, a protective magnetic field, and a just-right atmosphere for complex life to thrive.',
    stats: { 'Type': 'Terrestrial', 'Radius': '6,371 km', 'Distance from Sun': '1.00 AU', 'Orbital Period': '365.25 days', 'Moons': '1 (Luna)', 'Surface Temperature': '-88°C to 58°C', 'Gravity': '9.81 m/s²' },
    moons: [
      { name: 'Moon', radius: 0.11, distance: 1.1, period: 27.3, color: 0xAAAAAA, emoji: '🌕',
        description: "Earth's only natural satellite, the Moon is the fifth-largest moon in the Solar System. It stabilizes Earth's axial tilt and drives our tides.",
        stats: { 'Radius': '1,737 km', 'Distance from Earth': '384,400 km', 'Orbital Period': '27.3 days', 'Surface Temperature': '-173°C to 127°C' }
      }
    ]
  },
  {
    id: 'mars', name: 'Mars', type: 'Planet',
    radius: 0.27, distance: 22.8, period: 687, tilt: 25.2, inclination: 1.85,
    color: 0xC1440E, roughness: 0.9, metalness: 0.0,
    atmosphereColor: 0xFF9068, atmosphereIntensity: 0.3,
    emoji: '🔴',
    description: 'The Red Planet, named for its rust-colored surface. Mars hosts Olympus Mons, the tallest volcano in the Solar System, and Valles Marineris, the largest canyon system.',
    stats: { 'Type': 'Terrestrial', 'Radius': '3,390 km', 'Distance from Sun': '1.52 AU', 'Orbital Period': '687 days', 'Moons': '2 (Phobos, Deimos)', 'Surface Temperature': '-153°C to 20°C', 'Gravity': '3.71 m/s²' }
  },
  {
    id: 'jupiter', name: 'Jupiter', type: 'Planet',
    radius: 1.4, distance: 78, period: 4332, tilt: 3.1, inclination: 1.3,
    color: 0xC88B3A, roughness: 0.5, metalness: 0.0,
    atmosphereColor: 0xE8C070, atmosphereIntensity: 0.4,
    emoji: '🟠',
    description: 'The largest planet in the Solar System — a gas giant so massive that all other planets could fit inside it twice over. Jupiter\'s Great Red Spot is a storm that has raged for centuries.',
    stats: { 'Type': 'Gas Giant', 'Radius': '69,911 km', 'Distance from Sun': '5.2 AU', 'Orbital Period': '11.86 years', 'Moons': '95 known', 'Cloud Temperature': '-110°C', 'Gravity': '24.79 m/s²' },
    moons: [
      { name: 'Io', radius: 0.09, distance: 2.0, period: 1.77, color: 0xFFD700, emoji: '🟡',
        description: "The most volcanically active body in the Solar System. Io is covered in sulfur deposits from hundreds of active volcanoes.",
        stats: { 'Radius': '1,821 km', 'Orbital Period': '1.77 days' }
      },
      { name: 'Europa', radius: 0.08, distance: 2.6, period: 3.55, color: 0xD4E8F0, emoji: '⚪',
        description: "Europa has a global subsurface ocean beneath its icy crust, making it one of the best candidates for extraterrestrial life.",
        stats: { 'Radius': '1,561 km', 'Orbital Period': '3.55 days' }
      },
      { name: 'Ganymede', radius: 0.12, distance: 3.3, period: 7.15, color: 0x9E9E8A, emoji: '⚫',
        description: "The largest moon in the Solar System — even larger than Mercury. Ganymede has its own magnetic field.",
        stats: { 'Radius': '2,634 km', 'Orbital Period': '7.15 days' }
      },
      { name: 'Callisto', radius: 0.11, distance: 4.2, period: 16.69, color: 0x777777, emoji: '⚫',
        description: "The most heavily cratered object in the Solar System. Callisto may also harbor a subsurface ocean.",
        stats: { 'Radius': '2,410 km', 'Orbital Period': '16.69 days' }
      }
    ]
  },
  {
    id: 'saturn', name: 'Saturn', type: 'Planet',
    radius: 1.2, distance: 143.7, period: 10759, tilt: 26.7, inclination: 2.49,
    color: 0xEAD59B, roughness: 0.4, metalness: 0.0,
    atmosphereColor: 0xF0E4A8, atmosphereIntensity: 0.35,
    emoji: '🪐',
    description: 'The ringed jewel of the Solar System. Saturn\'s spectacular rings are made of billions of ice and rock particles. It is so light it could float on water.',
    stats: { 'Type': 'Gas Giant', 'Radius': '58,232 km', 'Distance from Sun': '9.58 AU', 'Orbital Period': '29.46 years', 'Moons': '146 known', 'Cloud Temperature': '-178°C', 'Gravity': '10.44 m/s²' },
    rings: true,
    moons: [
      { name: 'Titan', radius: 0.1, distance: 2.8, period: 15.94, color: 0xC2820A, emoji: '🟤',
        description: "Saturn's largest moon and the only moon in the Solar System with a thick atmosphere. Titan has lakes of liquid methane on its surface.",
        stats: { 'Radius': '2,575 km', 'Orbital Period': '15.94 days' }
      }
    ]
  },
  {
    id: 'uranus', name: 'Uranus', type: 'Planet',
    radius: 0.7, distance: 287, period: 30688, tilt: 97.8, inclination: 0.77,
    color: 0x7DE8E8, roughness: 0.3, metalness: 0.0,
    atmosphereColor: 0x9FF0F0, atmosphereIntensity: 0.5,
    emoji: '🔵',
    description: 'An ice giant that rotates on its side — its axial tilt is nearly 98°, possibly due to a massive ancient collision. Uranus has faint rings and a cold, pale blue-green atmosphere.',
    stats: { 'Type': 'Ice Giant', 'Radius': '25,362 km', 'Distance from Sun': '19.2 AU', 'Orbital Period': '84 years', 'Moons': '28 known', 'Cloud Temperature': '-224°C', 'Gravity': '8.69 m/s²' }
  },
  {
    id: 'neptune', name: 'Neptune', type: 'Planet',
    radius: 0.68, distance: 450, period: 60182, tilt: 28.3, inclination: 1.77,
    color: 0x3F54BA, roughness: 0.3, metalness: 0.0,
    atmosphereColor: 0x5580FF, atmosphereIntensity: 0.6,
    emoji: '🔵',
    description: 'The windiest planet, with storms reaching 2,100 km/h. Neptune was the first planet predicted by mathematics before it was directly observed.',
    stats: { 'Type': 'Ice Giant', 'Radius': '24,622 km', 'Distance from Sun': '30.1 AU', 'Orbital Period': '164.8 years', 'Moons': '16 known', 'Cloud Temperature': '-218°C', 'Gravity': '11.15 m/s²' }
  }
];

export const OBJECT_MEDIA = {
  sun: {
    youtubeId: '6tmbeLTHC_0', title: 'Thermonuclear Art — The Sun in Ultra HD', quality: 'NASA Goddard · 4K',
    nasaUrl: 'https://science.nasa.gov/sun/', wikipediaUrl: 'https://en.wikipedia.org/wiki/Sun'
  },
  mercury: {
    youtubeId: 'Z0mxVcBum8M', title: "NASA's MESSENGER Mission Ends at Mercury", quality: 'NASA mission video · HD',
    nasaUrl: 'https://science.nasa.gov/mercury/', wikipediaUrl: 'https://en.wikipedia.org/wiki/Mercury_(planet)',
    resources: [{ label: 'MESSENGER Mission', url: 'https://science.nasa.gov/mission/messenger/' }]
  },
  venus: {
    youtubeId: 'rk0PZ1qnLXw', title: "NASA's New Views of Venus' Surface", quality: 'NASA Goddard · HD',
    nasaUrl: 'https://science.nasa.gov/venus/', wikipediaUrl: 'https://en.wikipedia.org/wiki/Venus',
        resources: [{ label: 'NASA Venus Exploration', url: 'https://science.nasa.gov/venus/' }]
  },
  earth: {
    youtubeId: 'oFDeNcu3mnc', title: 'Ultra High Definition View of Planet Earth', quality: 'NASA Johnson · 4K',
    nasaUrl: 'https://science.nasa.gov/earth/', wikipediaUrl: 'https://en.wikipedia.org/wiki/Earth',
    resources: [{ label: 'NASA Earth Observatory', url: 'https://earthobservatory.nasa.gov/' }]
  },
  moon: {
    youtubeId: 'nr5Pj6GQL2o', title: 'Tour of the Moon in 4K', quality: 'NASA Goddard · 4K',
    nasaUrl: 'https://science.nasa.gov/moon/', wikipediaUrl: 'https://en.wikipedia.org/wiki/Moon'
  },
  mars: {
    youtubeId: '4czjS9h4Fpg', title: "Perseverance Rover's Descent and Touchdown", quality: 'NASA/JPL · HD',
    nasaUrl: 'https://science.nasa.gov/mars/', wikipediaUrl: 'https://en.wikipedia.org/wiki/Mars',
    resources: [{ label: 'Mars Exploration', url: 'https://mars.nasa.gov/' }]
  },
  jupiter: {
    youtubeId: 'xh3EKDghbuU', title: 'A Flight Over Jupiter', quality: 'NASA Juno imagery · HD',
    nasaUrl: 'https://science.nasa.gov/jupiter/', wikipediaUrl: 'https://en.wikipedia.org/wiki/Jupiter',
    resources: [{ label: 'Juno Mission', url: 'https://science.nasa.gov/mission/juno/' }]
  },
  saturn: {
    youtubeId: 'xrGAQCq9BMU', title: "Cassini's Grand Finale", quality: 'NASA/JPL · HD',
    nasaUrl: 'https://science.nasa.gov/saturn/', wikipediaUrl: 'https://en.wikipedia.org/wiki/Saturn',
    resources: [{ label: 'Cassini Mission', url: 'https://science.nasa.gov/mission/cassini/' }]
  },
  uranus: {
    youtubeId: '6dcfxVydbQY', title: 'Exploring Planet Uranus', quality: 'NASA Goddard · HD',
    nasaUrl: 'https://science.nasa.gov/uranus/', wikipediaUrl: 'https://en.wikipedia.org/wiki/Uranus',
        resources: [{ label: 'Uranus Mission Overview', url: 'https://science.nasa.gov/uranus/' }]
  },
  neptune: {
    youtubeId: 'l8TA7BU2Bvo', title: 'Voyager 2 Through the Outer Solar System', quality: 'NASA · HD',
    nasaUrl: 'https://science.nasa.gov/neptune/', wikipediaUrl: 'https://en.wikipedia.org/wiki/Neptune',
    resources: [{ label: 'Voyager Mission', url: 'https://science.nasa.gov/mission/voyager/' }]
  }
};

export const SUN_DATA = {
  id: 'sun', name: 'Sun', type: 'Star (G-type)',
  radius: 2.5, color: 0xFDB813, emissiveColor: 0xFF8800,
  emoji: '☀️',
  description: 'The Sun is the star at the center of our Solar System. It is a nearly perfect sphere of hot plasma, generating energy through nuclear fusion of hydrogen into helium at its core.',
  stats: { 'Type': 'G-type main-sequence (Yellow Dwarf)', 'Age': '4.6 billion years', 'Radius': '696,340 km', 'Mass': '1.989 × 10³⁰ kg', 'Core Temperature': '15 million °C', 'Surface Temperature': '5,778 K', 'Distance from Earth': '~150 million km (1 AU)' }
};

export const FAMOUS_STARS_DATA = [
  { id: 'sirius', name: 'Sirius', constellation: 'Canis Major', color: 0xA2D2FF, size: 3.5, magnitude: -1.46, spectral: 'A1V',
    x: 800, y: -200, z: -400,
    emoji: '⭐', type: 'Star (White)',
    description: 'The brightest star in the night sky, located 8.6 light-years away. Sirius is actually a binary star system — Sirius A and the white dwarf Sirius B.',
    stats: { 'Spectral Type': 'A1V (White)', 'Distance': '8.6 light-years', 'Apparent Magnitude': '-1.46', 'Luminosity': '25× Sun', 'Temperature': '9,940 K', 'Constellation': 'Canis Major' }
  },
  { id: 'betelgeuse', name: 'Betelgeuse', constellation: 'Orion', color: 0xFF4500, size: 6, magnitude: 0.42, spectral: 'M1–M2',
    x: 600, y: 300, z: -900,
    emoji: '🔴', type: 'Star (Red Supergiant)',
    description: 'A massive red supergiant nearing the end of its life. Betelgeuse is so large that if placed at our Sun, it would extend past the orbit of Jupiter. It is expected to explode as a supernova within the next 100,000 years.',
    stats: { 'Spectral Type': 'M1–M2 (Red Supergiant)', 'Distance': '~700 light-years', 'Apparent Magnitude': '0.42', 'Luminosity': '100,000× Sun', 'Radius': '700× Sun', 'Constellation': 'Orion' }
  },
  { id: 'rigel', name: 'Rigel', constellation: 'Orion', color: 0xBED9FF, size: 4.5, magnitude: 0.13, spectral: 'B8Ia',
    x: 450, y: 100, z: -1200,
    emoji: '💙', type: 'Star (Blue Supergiant)',
    description: 'One of the most luminous stars known, Rigel is a blue supergiant burning 120,000 times brighter than our Sun. Despite appearing dimmer than Sirius, it is intrinsically far more powerful.',
    stats: { 'Spectral Type': 'B8Ia (Blue Supergiant)', 'Distance': '~860 light-years', 'Apparent Magnitude': '0.13', 'Luminosity': '120,000× Sun', 'Temperature': '12,100 K', 'Constellation': 'Orion' }
  },
  { id: 'polaris', name: 'Polaris', constellation: 'Ursa Minor', color: 0xFFF5CC, size: 3.2, magnitude: 1.97, spectral: 'F7Ib',
    x: 0, y: 1300, z: 0,
    emoji: '⭐', type: 'Star (Yellow Supergiant)',
    description: 'The North Star — the pole star of the Northern Hemisphere. Polaris has been humanity\'s navigation star for millennia. It sits almost perfectly at the North Celestial Pole.',
    stats: { 'Spectral Type': 'F7Ib (Yellow Supergiant)', 'Distance': '~433 light-years', 'Apparent Magnitude': '1.97', 'Luminosity': '2,500× Sun', 'Constellation': 'Ursa Minor' }
  },
  { id: 'vega', name: 'Vega', constellation: 'Lyra', color: 0xD0E8FF, size: 3, magnitude: 0.03, spectral: 'A0V',
    x: -700, y: 500, z: -400,
    emoji: '⭐', type: 'Star (White)',
    description: 'One of the brightest stars in the northern sky, Vega served as the northern pole star ~12,000 years ago and will again in ~13,727 CE due to Earth\'s axial precession.',
    stats: { 'Spectral Type': 'A0V (White)', 'Distance': '25 light-years', 'Apparent Magnitude': '0.03', 'Luminosity': '40× Sun', 'Temperature': '9,600 K', 'Constellation': 'Lyra' }
  },
  { id: 'antares', name: 'Antares', constellation: 'Scorpius', color: 0xFF2200, size: 5.5, magnitude: 1.05, spectral: 'M1.5Iab',
    x: -500, y: -400, z: -800,
    emoji: '🔴', type: 'Star (Red Supergiant)',
    description: 'A massive red supergiant and one of the largest stars visible to the naked eye. Antares is the heart of the Scorpion and would engulf Mercury, Venus, Earth and Mars if it were our Sun.',
    stats: { 'Spectral Type': 'M1.5Iab (Red Supergiant)', 'Distance': '~550 light-years', 'Apparent Magnitude': '1.05', 'Luminosity': '57,500× Sun', 'Radius': '700× Sun', 'Constellation': 'Scorpius' }
  },
  { id: 'arcturus', name: 'Arcturus', constellation: 'Boötes', color: 0xFFB347, size: 3.8, magnitude: -0.05, spectral: 'K0III',
    x: -900, y: 600, z: 200,
    emoji: '🟠', type: 'Star (Orange Giant)',
    description: 'The brightest star in the northern celestial hemisphere. Arcturus is an orange giant moving rapidly through the galaxy — it will be invisible to the naked eye in about 500,000 years.',
    stats: { 'Spectral Type': 'K0III (Orange Giant)', 'Distance': '37 light-years', 'Apparent Magnitude': '-0.05', 'Luminosity': '170× Sun', 'Temperature': '4,300 K', 'Constellation': 'Boötes' }
  },
  { id: 'aldebaran', name: 'Aldebaran', constellation: 'Taurus', color: 0xFF7722, size: 4, magnitude: 0.86, spectral: 'K5III',
    x: 900, y: 200, z: -600,
    emoji: '🟠', type: 'Star (Red Giant)',
    description: 'The brightest star in Taurus, the bull\'s eye. Aldebaran is a red giant nearing the end of its life, having expanded to about 44 times the diameter of our Sun.',
    stats: { 'Spectral Type': 'K5III (Red Giant)', 'Distance': '65 light-years', 'Apparent Magnitude': '0.86', 'Luminosity': '500× Sun', 'Temperature': '3,900 K', 'Constellation': 'Taurus' }
  }
];

export const NEBULAE_DATA = [
  { id: 'orion', name: 'Orion Nebula', type: 'Emission Nebula', emoji: '🌌',
    x: 500, y: 150, z: -850,
    color1: 0xFF6B9D, color2: 0xFFB347, color3: 0xA8E6FF,
    size: 120, particleCount: 3000,
    description: 'One of the brightest nebulae visible to the naked eye, the Orion Nebula is a stellar nursery where new stars are being born right now. It lies 1,344 light-years away.',
    stats: { 'Distance': '1,344 light-years', 'Type': 'Emission/Reflection Nebula', 'Size': '24 light-years across', 'Age': '< 2 million years', 'Stars Forming': 'Yes — over 700 young stars', 'Constellation': 'Orion' }
  },
  { id: 'crab', name: 'Crab Nebula', type: 'Supernova Remnant', emoji: '💥',
    x: 850, y: 300, z: -500,
    color1: 0xFF4444, color2: 0xFF8800, color3: 0xFFFF44,
    size: 80, particleCount: 2000,
    description: 'The remnant of a supernova explosion observed by Chinese astronomers in 1054 CE. At its center lies a rapidly spinning neutron star (pulsar) — the collapsed core of the original star.',
    stats: { 'Distance': '6,500 light-years', 'Type': 'Supernova Remnant', 'Size': '11 light-years across', 'Age': '~970 years', 'Contains': 'Pulsar at center', 'Constellation': 'Taurus' }
  },
  { id: 'eagle', name: 'Eagle Nebula', type: 'Emission Nebula', emoji: '🦅',
    x: -800, y: -300, z: -700,
    color1: 0x44FF88, color2: 0x4488FF, color3: 0x88FF44,
    size: 100, particleCount: 2500,
    description: 'Home to the famous "Pillars of Creation" — towering columns of gas and dust where stars are actively forming. Made famous by the Hubble Space Telescope image in 1995.',
    stats: { 'Distance': '7,000 light-years', 'Type': 'Emission Nebula', 'Size': '70 × 55 light-years', 'Features': 'Pillars of Creation', 'Contains': 'Young star cluster M16', 'Constellation': 'Serpens' }
  },
  { id: 'lagoon', name: 'Lagoon Nebula', type: 'Emission Nebula', emoji: '🌊',
    x: -600, y: -500, z: -400,
    color1: 0xFF66AA, color2: 0xAA44FF, color3: 0xFF4488,
    size: 90, particleCount: 2200,
    description: 'A vast cloud of gas and dust lit up by the radiation of young, hot stars embedded within it. The Lagoon Nebula is one of only two star-forming nebulae visible to the naked eye from mid-northern latitudes.',
    stats: { 'Distance': '4,100 light-years', 'Type': 'Emission Nebula', 'Size': '110 × 50 light-years', 'Stars Forming': 'Yes', 'Constellation': 'Sagittarius' }
  }
];

export const CONSTELLATIONS_DATA = [
  {
    name: 'Orion', stars: [
      [500, 300, -800], [600, 100, -900], [450, 100, -950],
      [480, -100, -870], [550, 50, -920], [520, 350, -830]
    ]
  },
  {
    name: 'Ursa Major', stars: [
      [-400, 600, -200], [-300, 700, -150], [-200, 720, -100],
      [-100, 700, -80], [-50, 650, -120], [-80, 580, -180], [-200, 560, -220]
    ]
  }
];

// Build the searchable objects list
export const SEARCHABLE_OBJECTS = [
  { id: 'sun', name: 'Sun', type: 'Star', emoji: '☀️', category: 'solar-system' },
  ...PLANETS_DATA.map(p => ({ id: p.id, name: p.name, type: 'Planet', emoji: p.emoji, category: 'solar-system' })),
  ...PLANETS_DATA.flatMap(p => (p.moons || []).map(m => ({ id: m.name, name: m.name, type: 'Moon', emoji: m.emoji, category: 'moon', parentId: p.id }))),
  ...FAMOUS_STARS_DATA.map(s => ({ id: s.id, name: s.name, type: s.type, emoji: s.emoji, category: 'star' })),
  ...NEBULAE_DATA.map(n => ({ id: n.id, name: n.name, type: n.type, emoji: n.emoji, category: 'nebula' }))
];
