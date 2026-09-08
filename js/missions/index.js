// Entry point for the optional "Learn" layer on top of Solaris. This is the
// only module explorer.html loads for missions; it never modifies the 3D
// engine and free exploration works identically whether or not this module
// is present.
import { validateMission } from './schema.js';
import { openMission } from './runner.js';
import { raceAroundTheSun } from './definitions/raceAroundTheSun.js';
import { theScaleProblem } from './definitions/theScaleProblem.js';
import { solarSystemDetective } from './definitions/solarSystemDetective.js';

const MISSIONS = [raceAroundTheSun, theScaleProblem, solarSystemDetective].filter((mission) => {
  const errors = validateMission(mission);
  if (errors.length) console.error(`[missions] "${mission?.id}" is invalid and was skipped:`, errors);
  return errors.length === 0;
});

const LOCAL_HISTORY_KEY = 'solaris.missionAttempts';

function saveLocalAttempt(attempt) {
  try {
    const history = JSON.parse(localStorage.getItem(LOCAL_HISTORY_KEY) || '[]');
    history.push({ ...attempt, savedAt: new Date().toISOString() });
    localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(history.slice(-50)));
  } catch {
    // Local storage may be unavailable (private browsing, quota); the
    // mission still completes normally without this optional history.
  }
}

async function joinClass(joinCode) {
  const response = await fetch('/api/join-class', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ joinCode }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'That class code was not found.');
  return data;
}

async function submitAttempt(payload) {
  const response = await fetch('/api/mission-attempts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'The result could not be saved.');
  return data;
}

async function fetchHistory(studentId) {
  const response = await fetch(`/api/mission-attempts?studentId=${encodeURIComponent(studentId)}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Your results could not be loaded.');
  return data;
}

function buildLearnButton() {
  const button = document.createElement('div');
  button.id = 'learn-btn';
  button.className = 'corner-icon';
  button.title = 'Learn: missions and investigations';
  button.setAttribute('role', 'button');
  button.setAttribute('tabindex', '0');
  button.setAttribute('aria-label', 'Open Learn: missions and investigations');
  button.innerHTML = '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M8 14 24 7l16 7-16 7z" stroke="#999" stroke-width="3" stroke-linejoin="round"/><path d="M14 21v10c0 3 4.5 6 10 6s10-3 10-6V21" stroke="#999" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  return button;
}

function buildMissionListModal(onSelect) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = 'mission-list-modal';
  backdrop.hidden = true;

  const card = document.createElement('div');
  card.className = 'modal-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-labelledby', 'mission-list-title');

  const closeButton = document.createElement('button');
  closeButton.className = 'modal-close';
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', 'Close');
  closeButton.textContent = '\u2715';
  closeButton.addEventListener('click', () => { backdrop.hidden = true; });

  const title = document.createElement('h3');
  title.id = 'mission-list-title';
  title.textContent = 'Learn: pick a mission';

  const intro = document.createElement('p');
  intro.textContent = 'Optional, free investigations built on the real Solaris 3D world. Exploring Solaris never requires this.';

  const list = document.createElement('div');
  list.className = 'mission-list';
  for (const mission of MISSIONS) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'mission-list-item';
    item.innerHTML = `<strong>${mission.title}</strong><span>${mission.description}</span><em>Ages ${mission.ageRange} \u00b7 ${mission.difficulty} \u00b7 ~${mission.estimatedMinutes} min</em>`;
    item.addEventListener('click', () => { backdrop.hidden = true; onSelect(mission); });
    list.appendChild(item);
  }

  card.append(closeButton, title, intro, list);
  backdrop.appendChild(card);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) backdrop.hidden = true; });
  return backdrop;
}

function init() {
  if (!MISSIONS.length) return;
  const learnButton = buildLearnButton();
  const modal = buildMissionListModal((mission) => {
    openMission(mission, {
      joinClass,
      submitAttempt,
      fetchHistory,
      onScored: saveLocalAttempt,
    });
  });
  document.body.append(learnButton, modal);

  const openList = () => { modal.hidden = false; };
  learnButton.addEventListener('click', openList);
  learnButton.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openList(); }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
