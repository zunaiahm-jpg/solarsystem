(() => {
  const authPanel = document.getElementById('auth-panel');
  const setupPanel = document.getElementById('setup-panel');
  const classList = document.getElementById('class-list');

  async function api(path, options = {}) {
    const response = await fetch(path, {
      credentials: 'same-origin',
      ...options,
      headers: options.body ? { 'Content-Type': 'application/json', ...options.headers } : options.headers,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'The request could not be completed.');
    return result;
  }

  function setStatus(form, message, isError = false) {
    const status = form.querySelector('.form-status');
    status.textContent = message;
    status.classList.toggle('error', isError);
  }

  function setBusy(form, busy) {
    form.querySelectorAll('button, input').forEach((control) => { control.disabled = busy; });
  }

  async function submitAuth(form, endpoint) {
    setBusy(form, true);
    setStatus(form, 'Working…');
    const values = Object.fromEntries(new FormData(form));
    try {
      const result = await api(endpoint, { method: 'POST', body: JSON.stringify(values) });
      form.reset();
      showAccount(result.teacher);
    } catch (error) {
      setStatus(form, error.message, true);
    } finally {
      setBusy(form, false);
    }
  }

  function showAccount(teacher) {
    authPanel.hidden = true;
    setupPanel.hidden = false;
    document.getElementById('teacher-summary').textContent = `${teacher.email} · ${teacher.school}`;
    loadClasses();
  }

  function showAuth() {
    setupPanel.hidden = true;
    authPanel.hidden = false;
    classList.replaceChildren();
  }

  function studentItem(student) {
    const item = document.createElement('li');
    item.textContent = student.display_name;
    return item;
  }

  async function loadStudents(classId, list, count) {
    try {
      const result = await api(`/api/education-students?classId=${encodeURIComponent(classId)}`);
      list.replaceChildren(...result.students.map(studentItem));
      count.textContent = `${result.students.length} student profile${result.students.length === 1 ? '' : 's'}`;
    } catch (error) {
      list.textContent = error.message;
    }
  }

  function classCard(classroom) {
    const article = document.createElement('article');
    article.className = 'class-card';
    const header = document.createElement('header');
    const title = document.createElement('h3');
    title.textContent = classroom.name;
    const code = document.createElement('span');
    code.className = 'join-code';
    code.textContent = `Class code: ${classroom.join_code}`;
    header.append(title, code);

    const count = document.createElement('p');
    count.className = 'hint';
    count.textContent = `${classroom.student_count} student profile${classroom.student_count === 1 ? '' : 's'}`;
    const students = document.createElement('ul');
    students.className = 'student-list';

    const form = document.createElement('form');
    form.className = 'student-form';
    form.innerHTML = '<label>Student display name<input name="displayName" maxlength="80" required></label><button type="submit">Add profile</button><p class="form-status" role="status"></p>';
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      setBusy(form, true);
      setStatus(form, 'Adding…');
      try {
        const displayName = new FormData(form).get('displayName');
        await api('/api/education-students', {
          method: 'POST',
          body: JSON.stringify({ classId: classroom.id, displayName }),
        });
        form.reset();
        setStatus(form, 'Profile added.');
        await loadStudents(classroom.id, students, count);
      } catch (error) {
        setStatus(form, error.message, true);
      } finally {
        setBusy(form, false);
      }
    });

    article.append(header, count, students, form);
    loadStudents(classroom.id, students, count);
    return article;
  }

  async function loadClasses() {
    classList.textContent = 'Loading classes…';
    try {
      const result = await api('/api/education-classes');
      if (!result.classes.length) {
        classList.textContent = 'No classes yet. Create one above to add optional student profiles.';
        return;
      }
      classList.replaceChildren(...result.classes.map(classCard));
    } catch (error) {
      if (/sign in/i.test(error.message)) showAuth();
      else classList.textContent = error.message;
    }
  }

  document.getElementById('register-form').addEventListener('submit', (event) => {
    event.preventDefault();
    submitAuth(event.currentTarget, '/api/teacher-register');
  });
  document.getElementById('login-form').addEventListener('submit', (event) => {
    event.preventDefault();
    submitAuth(event.currentTarget, '/api/teacher-login');
  });
  document.getElementById('class-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(form, true);
    setStatus(form, 'Creating…');
    try {
      await api('/api/education-classes', {
        method: 'POST',
        body: JSON.stringify({ name: new FormData(form).get('name') }),
      });
      form.reset();
      setStatus(form, 'Class created.');
      await loadClasses();
    } catch (error) {
      setStatus(form, error.message, true);
    } finally {
      setBusy(form, false);
    }
  });
  document.getElementById('logout-button').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await api('/api/teacher-logout', { method: 'POST' });
      showAuth();
    } catch (error) {
      document.getElementById('teacher-summary').textContent = `Sign out failed: ${error.message}`;
    } finally {
      button.disabled = false;
    }
  });

  api('/api/teacher-session').then((result) => showAccount(result.teacher)).catch(showAuth);
})();
