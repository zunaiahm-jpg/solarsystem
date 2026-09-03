(() => {
  const landing = document.getElementById('launch-landing');
  const dialog = document.getElementById('explore-dialog');
  const form = document.getElementById('explore-form');
  const status = document.getElementById('explore-status');
  let startedAt = Date.now();
  let lastFocused = null;

  function enterExperience() {
    dialog.hidden = true;
    landing.classList.add('is-departing');
    document.body.classList.add('experience-active');
    setTimeout(() => {
      landing.hidden = true;
      document.getElementById('search-input')?.focus();
    }, 850);
  }

  function openDialog() {
    lastFocused = document.activeElement;
    startedAt = Date.now();
    dialog.hidden = false;
    requestAnimationFrame(() => dialog.classList.add('is-open'));
    dialog.querySelector('input[name="name"]')?.focus();
  }

  function closeDialog() {
    dialog.classList.remove('is-open');
    setTimeout(() => { dialog.hidden = true; }, 250);
    lastFocused?.focus();
  }

  document.querySelectorAll('[data-open-explore]').forEach(button => button.addEventListener('click', openDialog));
  document.querySelectorAll('[data-close-explore]').forEach(button => button.addEventListener('click', closeDialog));
  document.getElementById('skip-launch')?.addEventListener('click', enterExperience);
  document.getElementById('form-skip')?.addEventListener('click', enterExperience);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !dialog.hidden) closeDialog();
  });

  form?.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    status.textContent = 'Sending your transmission…';
    const values = Object.fromEntries(new FormData(form));
    try {
      const response = await fetch('/api/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, startedAt }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save your response.');
      status.textContent = 'Transmission received. Preparing departure…';
      form.reset();
      setTimeout(enterExperience, 650);
    } catch (error) {
      status.textContent = error.message;
      submit.disabled = false;
    }
  });
})();
