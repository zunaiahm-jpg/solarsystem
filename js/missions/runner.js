// Generic mission runner UI: Predict -> Simulate -> Observe -> Conclude ->
// Score, reusable for every mission built on the schema in schema.js. This
// module only manipulates its own overlay DOM and the bridge; it never
// touches the 3D engine's internals directly.
import { DATA_LABEL_TEXT } from './schema.js';
import { applySimulationConfig, captureSimulationState, restoreSimulationState } from './bridge.js';

function el(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.html !== undefined) node.innerHTML = options.html;
  if (options.attrs) for (const [key, value] of Object.entries(options.attrs)) node.setAttribute(key, value);
  for (const child of children) if (child) node.appendChild(child);
  return node;
}

function labelBadge(labelKind) {
  return el('span', { className: `mission-label mission-label--${labelKind}`, text: DATA_LABEL_TEXT[labelKind] || labelKind });
}

/**
 * Opens the mission runner overlay for one mission.
 * @param {object} mission - a validated mission definition (see schema.js).
 * @param {object} hooks
 * @param {() => void} hooks.onExit - called when the overlay closes.
 * @param {(joinCode: string) => Promise<{classId:string, className:string, students:{id:string, display_name:string}[]}>} hooks.joinClass
 * @param {(payload: object) => Promise<void>} hooks.submitAttempt
 */
export function openMission(mission, hooks = {}) {
  const previousState = captureSimulationState();
  const overlay = el('div', { className: 'mission-overlay', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': mission.title } });
  const panel = el('div', { className: 'mission-panel' });
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  const state = { prediction: {}, conclusionText: '', scoreResult: null };

  function closeOverlay() {
    restoreSimulationState(previousState);
    overlay.remove();
    hooks.onExit?.();
  }

  function render(stepName) {
    panel.replaceChildren();
    const steps = ['intro', 'predict', 'simulate', 'observe', 'conclude', 'score'];
    const progress = el('div', { className: 'mission-progress', text: `Step ${steps.indexOf(stepName) + 1} of ${steps.length}` });
    const closeButton = el('button', { className: 'mission-close', text: '\u2715', attrs: { type: 'button', 'aria-label': 'Close mission' } });
    closeButton.addEventListener('click', closeOverlay);
    const header = el('div', { className: 'mission-header' }, [
      el('h2', { text: mission.title }),
      closeButton,
    ]);
    panel.append(header, progress);

    const renderers = { intro: renderIntro, predict: renderPredict, simulate: renderSimulate, observe: renderObserve, conclude: renderConclude, score: renderScore };
    renderers[stepName]();
  }

  function renderIntro() {
    panel.append(
      el('p', { className: 'mission-description', text: mission.description }),
      el('p', { className: 'mission-meta', text: `Ages ${mission.ageRange} \u00b7 ${mission.difficulty} \u00b7 about ${mission.estimatedMinutes} minutes` }),
      el('h3', { text: 'What you will learn' }),
      el('ul', {}, mission.objectives.map((objective) => el('li', { text: objective }))),
      el('h3', { text: 'Steps' }),
      el('ol', {}, mission.instructions.map((instruction) => el('li', { text: instruction }))),
    );
    const startButton = el('button', { className: 'mission-btn mission-btn--primary', text: 'Start: make a prediction' });
    startButton.addEventListener('click', () => render('predict'));
    panel.appendChild(el('div', { className: 'mission-actions' }, [startButton]));
  }

  function renderPredict() {
    panel.append(labelBadge(mission.prediction.labelKind), el('p', { text: mission.prediction.prompt }));
    const fieldEls = {};
    for (const field of mission.prediction.fields) {
      const select = el('select', { attrs: { id: `mission-field-${field.id}` } });
      select.appendChild(el('option', { text: 'Choose\u2026', attrs: { value: '' } }));
      for (const optionId of field.options) select.appendChild(el('option', { text: optionId, attrs: { value: optionId } }));
      fieldEls[field.id] = select;
      panel.append(el('label', { className: 'mission-field', text: field.label }, [select]));
    }
    const continueButton = el('button', { className: 'mission-btn mission-btn--primary', text: 'Continue to simulation' });
    continueButton.addEventListener('click', () => {
      for (const [id, select] of Object.entries(fieldEls)) state.prediction[id] = select.value || null;
      render('simulate');
    });
    panel.appendChild(el('div', { className: 'mission-actions' }, [continueButton]));
  }

  function renderSimulate() {
    applySimulationConfig(mission.simulation);
    panel.append(
      el('p', { text: 'Solaris is now running the simulation for this mission. Watch the 3D view, then continue when you are ready.' }),
      el('p', { className: 'mission-hint', text: 'You can still look around and interact with the 3D scene normally while this panel is open.' }),
    );
    const continueButton = el('button', { className: 'mission-btn mission-btn--primary', text: 'Continue to real data' });
    continueButton.addEventListener('click', () => render('observe'));
    panel.appendChild(el('div', { className: 'mission-actions' }, [continueButton]));
  }

  function renderObserve() {
    panel.append(labelBadge(mission.observation.labelKind), el('p', { text: mission.observation.prompt }));
    const rows = mission.observation.getData();
    const table = el('table', { className: 'mission-table' }, [
      el('tbody', {}, rows.map((row) => el('tr', {}, [
        el('td', { text: row.id }),
        el('td', { text: `${row.yearDays.toLocaleString()} Earth days` }),
      ]))),
    ]);
    panel.appendChild(table);
    const continueButton = el('button', { className: 'mission-btn mission-btn--primary', text: 'Continue to conclusion' });
    continueButton.addEventListener('click', () => render('conclude'));
    panel.appendChild(el('div', { className: 'mission-actions' }, [continueButton]));
  }

  function renderConclude() {
    panel.append(el('p', { text: mission.conclusion.prompt }));
    const textarea = el('textarea', { className: 'mission-textarea', attrs: { rows: '4', maxlength: '2000' } });
    panel.appendChild(textarea);
    const status = el('p', { className: 'mission-status' });
    panel.appendChild(status);
    const submitButton = el('button', { className: 'mission-btn mission-btn--primary', text: 'See my score' });
    submitButton.addEventListener('click', () => {
      const text = textarea.value.trim();
      if (text.length < (mission.conclusion.minLength || 1)) {
        status.textContent = `Please write at least ${mission.conclusion.minLength} characters.`;
        return;
      }
      state.conclusionText = text;
      state.scoreResult = mission.scoring.evaluate(state.prediction, state.conclusionText);
      hooks.onScored?.({
        missionId: mission.id,
        prediction: state.prediction,
        explanation: state.conclusionText,
        result: state.scoreResult,
      });
      render('score');
    });
    panel.appendChild(el('div', { className: 'mission-actions' }, [submitButton]));
  }

  function renderScore() {
    const result = state.scoreResult;
    panel.append(
      el('p', { className: 'mission-score', text: `${result.earned} / ${result.possible} (${result.percentage}%)` }),
      el('ul', { className: 'mission-score-breakdown' }, result.components.map((component) => el('li', {
        text: `${component.earned}/${component.possible} \u2014 ${component.label}`,
      }))),
    );

    const finishButton = el('button', { className: 'mission-btn mission-btn--primary', text: 'Finish' });
    finishButton.addEventListener('click', closeOverlay);
    const actions = el('div', { className: 'mission-actions' }, [finishButton]);

    if (hooks.joinClass && hooks.submitAttempt) {
      const saveButton = el('button', { className: 'mission-btn mission-btn--secondary', text: 'Save to my class' });
      saveButton.addEventListener('click', () => renderSaveToClass(actions, saveButton));
      actions.insertBefore(saveButton, finishButton);
    }
    panel.appendChild(actions);
  }

  function renderSaveToClass(actions, saveButton) {
    saveButton.remove();
    const codeInput = el('input', { attrs: { type: 'text', maxlength: '6', placeholder: 'Class code' } });
    const lookupButton = el('button', { className: 'mission-btn mission-btn--secondary', text: 'Find my class' });
    const status = el('p', { className: 'mission-status' });
    const saveRow = el('div', { className: 'mission-save-row' }, [codeInput, lookupButton]);
    actions.insertBefore(saveRow, actions.firstChild);
    actions.insertBefore(status, saveRow);

    lookupButton.addEventListener('click', async () => {
      status.textContent = 'Looking up your class\u2026';
      try {
        const { students } = await hooks.joinClass(codeInput.value.trim());
        if (!students.length) { status.textContent = 'That class has no student profiles yet. Ask your teacher.'; return; }
        const picker = el('select', {}, [
          el('option', { text: 'Choose your name\u2026', attrs: { value: '' } }),
          ...students.map((student) => el('option', { text: student.display_name, attrs: { value: student.id } })),
        ]);
        const confirmButton = el('button', { className: 'mission-btn mission-btn--primary', text: 'Save my result' });
        saveRow.replaceChildren(picker, confirmButton);
        status.textContent = '';
        confirmButton.addEventListener('click', async () => {
          if (!picker.value) { status.textContent = 'Please choose your name first.'; return; }
          status.textContent = 'Saving\u2026';
          try {
            await hooks.submitAttempt({
              studentId: picker.value,
              missionId: mission.id,
              prediction: state.prediction,
              result: state.scoreResult,
              explanation: state.conclusionText,
              score: state.scoreResult.earned,
              maxScore: state.scoreResult.possible,
            });
            status.textContent = 'Saved to your class.';
          } catch (error) {
            status.textContent = error.message || 'Could not save right now.';
          }
        });
      } catch (error) {
        status.textContent = error.message || 'That class code was not found.';
      }
    });
  }

  render('intro');
  return { close: closeOverlay };
}
