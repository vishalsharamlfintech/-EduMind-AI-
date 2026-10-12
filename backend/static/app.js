const form = document.querySelector('#assessment-form');
const submitButton = document.querySelector('#submit-button');
const formError = document.querySelector('#form-error');
const emptyState = document.querySelector('#empty-state');
const resultContent = document.querySelector('#result-content');
const historyKey = 'edumind-assessments-v1';
const fields = ['attendance', 'previous_cgpa', 'internal_marks', 'assignment_score', 'study_hours', 'backlogs', 'previous_failures', 'participation_score'];
const sampleValues = {
  attendance: 75,
  previous_cgpa: 7.2,
  internal_marks: 68,
  assignment_score: 72,
  study_hours: 3.5,
  backlogs: 1,
  previous_failures: 0,
  participation_score: 68,
};
let latestAssessment = null;
let toastTimer;

const dateElement = document.querySelector('#today-date');
dateElement.textContent = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date());

function getHistory() {
  try {
    const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
    return Array.isArray(history) ? history : [];
  } catch {
    return [];
  }
}

function saveHistory(history) {
  try {
    localStorage.setItem(historyKey, JSON.stringify(history.slice(0, 5)));
  } catch {
    showToast('This browser could not save the assessment history.');
  }
}

function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 2600);
}

function renderHistory() {
  const history = getHistory();
  const container = document.querySelector('#history-list');
  document.querySelector('#recent-count').textContent = `${history.length} ${history.length === 1 ? 'estimate' : 'estimates'}`;
  document.querySelector('#clear-history').hidden = history.length === 0;
  container.replaceChildren();

  if (history.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'history-empty';
    empty.textContent = 'Assessments from this browser will appear here.';
    container.append(empty);
    return;
  }

  for (const item of history) {
    const button = document.createElement('button');
    button.className = 'history-item';
    button.type = 'button';
    button.dataset.id = item.id;
    const left = document.createElement('span');
    left.className = 'history-left';
    const dot = document.createElement('span');
    dot.className = `history-dot ${item.risk.toLowerCase()}`;
    const label = document.createElement('span');
    const name = document.createElement('span');
    name.className = 'history-name';
    name.textContent = `Assessment ${item.id.slice(-5)}`;
    const time = document.createElement('span');
    time.className = 'history-time';
    time.textContent = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(item.createdAt));
    label.append(name, document.createElement('br'), time);
    left.append(dot, label);
    const right = document.createElement('span');
    right.className = 'history-result';
    right.textContent = `${item.score.toFixed(1)} · ${item.risk}`;
    button.append(left, right);
    container.append(button);
  }
}

function renderProbabilities(probabilities) {
  const container = document.querySelector('#probability-bars');
  container.replaceChildren();
  for (const level of ['LOW', 'MEDIUM', 'HIGH']) {
    const probability = Math.max(0, Math.min(1, Number(probabilities[level] ?? 0)));
    const row = document.createElement('div');
    row.className = 'probability-row';
    const label = document.createElement('span');
    label.textContent = level[0] + level.slice(1).toLowerCase();
    const track = document.createElement('span');
    track.className = 'probability-track';
    const fill = document.createElement('span');
    fill.className = `probability-fill ${level.toLowerCase()}`;
    fill.style.display = 'block';
    fill.style.width = `${probability * 100}%`;
    track.append(fill);
    const value = document.createElement('span');
    value.className = 'probability-value';
    value.textContent = `${(probability * 100).toFixed(1)}%`;
    row.append(label, track, value);
    container.append(row);
  }
}

function renderResult(result, reference) {
  const score = Math.max(0, Math.min(100, Number(result.predicted_performance)));
  const risk = String(result.risk_level).toUpperCase();
  latestAssessment = { score, risk, probabilities: result.risk_probabilities, reference };
  emptyState.hidden = true;
  resultContent.hidden = false;
  document.querySelector('#result-state').textContent = 'ASSESSMENT READY';
  document.querySelector('#result-state').classList.add('ready');
  document.querySelector('#performance-score').textContent = score.toFixed(1);
  document.querySelector('#score-ring').style.background = `conic-gradient(var(--green) ${score * 3.6}deg, #e7ece5 ${score * 3.6}deg)`;
  document.querySelector('#score-description').textContent = score >= 75 ? 'Strong performance outlook' : score >= 55 ? 'Developing performance outlook' : 'Support may be beneficial';
  const badge = document.querySelector('#risk-badge');
  badge.textContent = `${risk} RISK`;
  badge.className = `risk-badge ${risk.toLowerCase()}`;
  document.querySelector('#result-reference').textContent = `REF ${reference}`;
  renderProbabilities(result.risk_probabilities || {});
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  formError.hidden = true;
  if (!form.reportValidity()) return;

  const payload = Object.fromEntries(new FormData(form).entries());
  for (const field of fields) payload[field] = Number(payload[field]);
  submitButton.disabled = true;
  submitButton.querySelector('span:first-child').textContent = 'Assessing profile';
  document.querySelector('#result-state').textContent = 'PROCESSING';

  try {
    const response = await fetch('/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    if (!response.ok) {
      const detail = Array.isArray(body.detail) ? body.detail.map((item) => item.msg).join(' ') : body.detail;
      throw new Error(detail || 'The assessment could not be completed. Check the entered values and try again.');
    }

    const reference = crypto.randomUUID().slice(0, 8).toUpperCase();
    renderResult(body, reference);
    const history = getHistory();
    history.unshift({ id: reference, createdAt: new Date().toISOString(), score: Number(body.predicted_performance), risk: String(body.risk_level).toUpperCase(), probabilities: body.risk_probabilities });
    saveHistory(history);
    renderHistory();
  } catch (error) {
    document.querySelector('#result-state').textContent = 'ASSESSMENT FAILED';
    formError.textContent = error instanceof TypeError ? 'Unable to reach the prediction service. Confirm the API is running and try again.' : error.message;
    formError.hidden = false;
  } finally {
    submitButton.disabled = false;
    submitButton.querySelector('span:first-child').textContent = 'Generate assessment';
  }
});

document.querySelector('#sample-button').addEventListener('click', () => {
  for (const [field, value] of Object.entries(sampleValues)) form.elements[field].value = value;
  formError.hidden = true;
  showToast('Sample student indicators loaded.');
});

document.querySelector('#history-list').addEventListener('click', (event) => {
  const button = event.target.closest('.history-item');
  if (!button) return;
  const item = getHistory().find((entry) => entry.id === button.dataset.id);
  if (!item) return;
  renderResult({ predicted_performance: item.score, risk_level: item.risk, risk_probabilities: item.probabilities }, item.id);
  document.querySelector('#assessment').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.querySelector('#clear-history').addEventListener('click', () => {
  localStorage.removeItem(historyKey);
  renderHistory();
  showToast('Recent assessment history cleared.');
});

document.querySelector('#copy-button').addEventListener('click', async () => {
  if (!latestAssessment) return;
  const summary = [
    `EduMind assessment ${latestAssessment.reference}`,
    `Predicted performance: ${latestAssessment.score.toFixed(1)} / 100`,
    `Predicted risk category: ${latestAssessment.risk}`,
    ...['LOW', 'MEDIUM', 'HIGH'].map((level) => `${level} risk probability: ${((latestAssessment.probabilities[level] || 0) * 100).toFixed(1)}%`),
    'Indicative model output; review with the student before making support decisions.',
  ].join('\n');
  try {
    await navigator.clipboard.writeText(summary);
    showToast('Assessment summary copied.');
  } catch {
    showToast('Clipboard access is unavailable in this browser.');
  }
});

renderHistory();
