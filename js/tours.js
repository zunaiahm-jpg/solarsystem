// Narrated guided tours for classroom use. Each tour is a list of stops; the
// camera flies to the stop's object while the narration is spoken with the
// browser's built-in Web Speech API (no downloads, no accounts). Captions are
// always shown so the tour works with speech disabled or unsupported.
//
// Deep links: explorer.html?tour=<id> starts a tour as soon as the visitor
// presses Start. Lesson plans on /lessons.html link here.

export const TOURS = [
  {
    id: 'inner-planets',
    title: 'The Inner Planets',
    grade: 'Grades 3–5 · ~4 min',
    ngss: '5-ESS1-2, 3-5-ETS1-2',
    summary: 'Compare the four rocky worlds and discover why Earth is the odd one out.',
    stops: [
      { target: 'sun', text: 'Welcome aboard. Everything in this tour orbits the star at the center of our neighborhood: the Sun. It holds 99.8 percent of the solar system\'s mass, and its light takes about eight minutes to reach Earth.', dwell: 14 },
      { target: 'mercury', text: 'First stop: Mercury, the smallest planet and the closest to the Sun. A year here lasts only 88 Earth days, yet one full day-night cycle takes 176 Earth days. Its surface is covered in craters, much like our Moon.', dwell: 15 },
      { target: 'venus', text: 'Venus is almost the same size as Earth, but its thick carbon dioxide atmosphere traps heat, making it the hottest planet at around 465 degrees Celsius. Venus also spins backwards compared to most planets.', dwell: 15 },
      { target: 'earth', text: 'Home. Earth is the only world we know of with liquid water oceans on its surface and life. Look for the thin blue line of the atmosphere. Notice how small the Moon is next to it.', dwell: 14 },
      { target: 'mars', text: 'Mars, the red planet. Iron-rich dust gives it its color. It has the tallest volcano in the solar system, Olympus Mons, and evidence that rivers once flowed here. Rovers are exploring its surface today.', dwell: 15 },
      { target: 'earth', text: 'Back at Earth. Ask yourself: what makes our planet the right distance from the Sun for liquid water? Scientists call this the habitable zone. That question ends our tour of the inner planets.', dwell: 12 },
    ],
  },
  {
    id: 'gas-giants',
    title: 'Giants of the Outer System',
    grade: 'Grades 6–8 · ~5 min',
    ngss: 'MS-ESS1-2, MS-ESS1-3',
    summary: 'Scale, gravity and moons: why the outer planets grew so large.',
    stops: [
      { target: 'jupiter', text: 'Jupiter is the largest planet, more than twice as massive as all the other planets combined. Its Great Red Spot is a storm wider than Earth that has raged for centuries. Jupiter has at least 95 moons.', dwell: 16 },
      { target: 'Io', text: 'Io is the most volcanically active world we know. Jupiter\'s gravity squeezes and stretches it, heating its interior. Plumes of sulfur rise hundreds of kilometers above its surface.', dwell: 13 },
      { target: 'Europa', text: 'Europa hides a salty ocean beneath a shell of ice. That ocean may hold twice as much water as all of Earth\'s oceans, which makes Europa a leading place to search for life beyond Earth.', dwell: 13 },
      { target: 'saturn', text: 'Saturn\'s rings are made of billions of pieces of ice and rock, some as small as grains of sand and some as large as houses. The rings are hundreds of thousands of kilometers wide but often less than a kilometer thick.', dwell: 16 },
      { target: 'Titan', text: 'Titan, Saturn\'s largest moon, has a thick orange atmosphere and lakes of liquid methane. It is the only moon in the solar system with a dense atmosphere.', dwell: 12 },
      { target: 'uranus', text: 'Uranus is tipped over on its side, so its poles take turns facing the Sun for 42 years at a time. Methane in its atmosphere gives it a pale blue-green color.', dwell: 12 },
      { target: 'neptune', text: 'Neptune, the most distant planet, has the fastest winds in the solar system, over 2,000 kilometers per hour. One Neptune year lasts 165 Earth years. This concludes the giants tour.', dwell: 13 },
    ],
  },
  {
    id: 'scale-of-space',
    title: 'The Scale of Space',
    grade: 'Grades 9–12 · ~4 min',
    ngss: 'HS-ESS1-4, HS-PS2-4',
    summary: 'From Earth to the stars: orbits, Kepler\'s laws and why this model compresses distance.',
    stops: [
      { target: 'earth', text: 'This model shrinks distances so the planets stay in view. In reality, if Earth were the size of a marble, the Sun would be a beach ball 150 meters away, and Neptune would be four and a half kilometers from here.', dwell: 16 },
      { target: 'mars', text: 'Mars orbits at 1.5 astronomical units. Kepler\'s third law tells us that the square of a planet\'s orbital period is proportional to the cube of its distance, so Mars takes 687 days to orbit the Sun.', dwell: 15 },
      { target: 'jupiter', text: 'At 5.2 astronomical units, Jupiter needs almost 12 years for one orbit. Turn on the Orbits layer and speed up time to watch the inner planets lap the outer ones many times.', dwell: 14 },
      { target: 'neptune', text: 'Neptune sits 30 astronomical units out, about 4.5 billion kilometers from the Sun. Sunlight takes over four hours to reach it. Voyager 2 is the only spacecraft to have visited.', dwell: 14 },
      { target: 'sirius', text: 'Now look far beyond the planets. Sirius, the brightest star in our night sky, is 8.6 light-years away. Light we see from it tonight left the star more than eight years ago.', dwell: 14 },
      { target: 'betelgeuse', text: 'Betelgeuse is a red supergiant hundreds of light-years away and so large that if it replaced the Sun, it would swallow the orbit of Jupiter. When it eventually explodes as a supernova, it will be visible in daylight. End of tour.', dwell: 15 },
    ],
  },
];

let active = null;
let flyTo = null;
let onState = () => {};
let stopTimer = null;

function speechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

function pickVoice() {
  if (!speechSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  const english = voices.filter(voice => /^en(-|_)?/i.test(voice.lang));
  return english.find(voice => /Google|Samantha|Daniel|Natural|Premium/i.test(voice.name)) || english[0] || voices[0] || null;
}

function speak(text, onEnd) {
  if (!speechSupported() || !active?.voiceOn) {
    onEnd?.({ spoken: false });
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickVoice();
  if (voice) utterance.voice = voice;
  utterance.rate = 0.96;
  utterance.pitch = 1;
  utterance.onend = () => onEnd?.({ spoken: true });
  utterance.onerror = () => onEnd?.({ spoken: false });
  window.speechSynthesis.speak(utterance);
}

function emit() {
  if (!active) {
    onState({ running: false });
    return;
  }
  const stop = active.tour.stops[active.index];
  onState({
    running: true,
    tour: active.tour,
    index: active.index,
    total: active.tour.stops.length,
    text: stop.text,
    voiceOn: active.voiceOn,
    speechSupported: speechSupported(),
  });
}

function playStop() {
  if (!active) return;
  clearTimeout(stopTimer);
  const stop = active.tour.stops[active.index];
  flyTo?.(stop.target);
  emit();

  let advanced = false;
  const advance = () => {
    if (advanced || !active) return;
    advanced = true;
    stopTimer = setTimeout(() => nextStop(), 1800);
  };

  speak(stop.text, ({ spoken }) => {
    if (spoken) advance();
  });
  // If speech is off or unsupported, fall back to a reading-time dwell.
  if (!speechSupported() || !active.voiceOn) {
    stopTimer = setTimeout(advance, (stop.dwell || 12) * 1000);
  }
}

export function setupTours({ flyToCallback, onStateChange }) {
  flyTo = flyToCallback;
  onState = onStateChange || onState;
  if (speechSupported()) window.speechSynthesis.getVoices();
}

export function startTour(id, { voice = true } = {}) {
  const tour = TOURS.find(entry => entry.id === id);
  if (!tour) return false;
  stopTour();
  active = { tour, index: 0, voiceOn: voice };
  playStop();
  return true;
}

export function nextStop() {
  if (!active) return;
  if (active.index >= active.tour.stops.length - 1) {
    stopTour();
    return;
  }
  active.index += 1;
  playStop();
}

export function previousStop() {
  if (!active || active.index === 0) return;
  active.index -= 1;
  playStop();
}

export function toggleTourVoice() {
  if (!active) return;
  active.voiceOn = !active.voiceOn;
  if (!active.voiceOn && speechSupported()) window.speechSynthesis.cancel();
  playStop();
}

export function stopTour() {
  clearTimeout(stopTimer);
  if (speechSupported()) window.speechSynthesis.cancel();
  active = null;
  emit();
}

export function isTourRunning() {
  return Boolean(active);
}
