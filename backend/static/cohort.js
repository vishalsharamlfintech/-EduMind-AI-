const featureFields = [
  'attendance',
  'previous_cgpa',
  'internal_marks',
  'assignment_score',
  'study_hours',
  'backlogs',
  'previous_failures',
  'participation_score',
];
const requiredColumns = ['student_id', ...featureFields];
const fieldRules = {
  attendance: { min: 40, max: 100 },
  previous_cgpa: { min: 4, max: 10 },
  internal_marks: { min: 20, max: 100 },
  assignment_score: { min: 20, max: 100 },
  study_hours: { min: 0.5, max: 10 },
  backlogs: { min: 0, max: 6, integer: true },
  previous_failures: { min: 0, max: 5, integer: true },
  participation_score: { min: 10, max: 100 },
};
const csvInput = document.querySelector('#csv-input');
const dropZone = document.querySelector('#drop-zone');
const analyzeButton = document.querySelector('#analyze-button');
const cohortError = document.querySelector('#cohort-error');
const previewSection = document.querySelector('#preview-section');
const resultsSection = document.querySelector('#cohort-results');
let parsedStudents = [];
let cohortResults = [];
let riskSummary = {};

const date = document.querySelector('#cohort-date');
date.textContent = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date());

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
    } else if (character === '"' && value.length === 0) {
      quoted = true;
    } else if (character === ',') {
      row.push(value);
      value = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
      value = '';
    } else {
      value += character;
    }
  }

  if (quoted) throw new Error('The CSV contains an unclosed quoted field.');
  row.push(value);
  if (row.some((cell) => cell.trim() !== '')) rows.push(row);
  if (rows.length < 2) throw new Error('Add a header row and at least one student record.');

  const headers = rows[0].map((header) => header.trim().replace(/^\uFEFF/, '').toLowerCase());
  const duplicateHeaders = headers.filter((header, index) => headers.indexOf(header) !== index);
  if (duplicateHeaders.length) throw new Error(`Duplicate CSV column: ${duplicateHeaders[0]}.`);
  const missing = requiredColumns.filter((column) => !headers.includes(column));
  if (missing.length) throw new Error(`Missing required columns: ${missing.join(', ')}.`);

  const dataRows = rows.slice(1);
  if (dataRows.length > 500) throw new Error(`This workspace accepts up to 500 students per cohort; this file has ${dataRows.length}.`);
  const seenIds = new Set();

  return dataRows.map((cells, rowIndex) => {
    if (cells.length !== headers.length) throw new Error(`Row ${rowIndex + 2} has ${cells.length} values; expected ${headers.length}.`);
    const values = Object.fromEntries(headers.map((header, index) => [header, cells[index].trim()]));
    const studentId = values.student_id;
    if (!studentId) throw new Error(`Row ${rowIndex + 2} has no student_id.`);
    if (studentId.length > 80) throw new Error(`Row ${rowIndex + 2}: student_id must be 80 characters or fewer.`);
    const normalizedId = studentId.toLocaleLowerCase();
    if (seenIds.has(normalizedId)) throw new Error(`Duplicate student_id "${studentId}" in the CSV.`);
    seenIds.add(normalizedId);

    const student = { student_id: studentId };
    for (const field of featureFields) {
      const numericValue = Number(values[field]);
      if (values[field] === '' || !Number.isFinite(numericValue)) {
        throw new Error(`Row ${rowIndex + 2}: ${field} must be a number.`);
      }
      const rule = fieldRules[field];
      if (numericValue < rule.min || numericValue > rule.max || (rule.integer && !Number.isInteger(numericValue))) {
        const integerHint = rule.integer ? ' and a whole number' : '';
        throw new Error(`Row ${rowIndex + 2}: ${field} must be between ${rule.min} and ${rule.max}${integerHint}.`);
      }
      student[field] = numericValue;
    }
    return student;
  });
}

function setError(message) {
  cohortError.textContent = message;
  cohortError.hidden = !message;
}

function setFileName(fileName, studentCount) {
  document.querySelector('#upload-title-text').innerHTML = '';
  document.querySelector('#upload-title-text').textContent = fileName;
  document.querySelector('#preview-title').textContent = fileName;
  document.querySelector('#preview-detail').textContent = `${studentCount} ${studentCount === 1 ? 'student' : 'students'}`;
}

function buildCell(row, text, tagName = 'td') {
  const cell = document.createElement(tagName);
  cell.textContent = text;
  row.append(cell);
}

function renderPreview(students) {
  const headers = ['student_id', ...featureFields];
  const headRow = document.createElement('tr');
  for (const header of headers) buildCell(headRow, header.replaceAll('_', ' '), 'th');
  const head = document.querySelector('#preview-head');
  head.replaceChildren(headRow);

  const body = document.querySelector('#preview-body');
  body.replaceChildren();
  for (const student of students.slice(0, 3)) {
    const row = document.createElement('tr');
    for (const header of headers) buildCell(row, String(student[header]));
    body.append(row);
  }
  previewSection.hidden = false;
  analyzeButton.disabled = false;
}

async function loadCsv(file) {
  setError('');
  resultsSection.hidden = true;
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.csv')) {
    setError('Choose a .csv file to analyze.');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    setError('This CSV is larger than the 5 MB limit.');
    return;
  }

  try {
    parsedStudents = parseCsv(await file.text());
    renderPreview(parsedStudents);
    setFileName(file.name, parsedStudents.length);
  } catch (error) {
    parsedStudents = [];
    previewSection.hidden = true;
    analyzeButton.disabled = true;
    setError(error.message);
  }
}

function renderRiskDistribution(summary, total) {
  const container = document.querySelector('#risk-bars');
  container.replaceChildren();
  for (const level of ['LOW', 'MEDIUM', 'HIGH']) {
    const count = summary.risk_counts[level] || 0;
    const percentage = total ? count / total * 100 : 0;
    const row = document.createElement('div');
    row.className = 'cohort-risk-row';
    const label = document.createElement('span');
    label.className = 'cohort-risk-label';
    label.textContent = level[0] + level.slice(1).toLowerCase();
    const track = document.createElement('span');
    track.className = 'cohort-risk-track';
    const fill = document.createElement('span');
    fill.className = `cohort-risk-fill ${level.toLowerCase()}`;
    fill.style.width = `${percentage}%`;
    track.append(fill);
    const countLabel = document.createElement('span');
    countLabel.className = 'cohort-risk-count';
    countLabel.textContent = String(count);
    const percentageLabel = document.createElement('span');
    percentageLabel.className = 'cohort-risk-percent';
    percentageLabel.textContent = `${percentage.toFixed(0)}%`;
    row.append(label, track, countLabel, percentageLabel);
    container.append(row);
  }
  document.querySelector('#distribution-total').textContent = `${total} TOTAL`;
}

function getFilteredResults() {
  const search = document.querySelector('#student-search').value.trim().toLocaleLowerCase();
  const selectedRisk = document.querySelector('#risk-filter').value;
  return cohortResults.filter((student) => {
    const matchesSearch = student.student_id.toLocaleLowerCase().includes(search);
    const matchesRisk = selectedRisk === 'ALL' || student.risk_level === selectedRisk;
    return matchesSearch && matchesRisk;
  });
}

function renderResultsTable() {
  const visibleResults = getFilteredResults();
  const body = document.querySelector('#results-body');
  body.replaceChildren();
  for (const student of visibleResults) {
    const row = document.createElement('tr');
    buildCell(row, student.student_id);
    buildCell(row, student.predicted_performance.toFixed(2));
    const riskCell = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = `risk-badge ${student.risk_level.toLowerCase()}`;
    badge.textContent = student.risk_level;
    riskCell.append(badge);
    row.append(riskCell);
    buildCell(row, `${(student.risk_probabilities.HIGH * 100).toFixed(1)}%`);
    body.append(row);
  }
  document.querySelector('#table-count').textContent = `${visibleResults.length} of ${cohortResults.length} students`;
  document.querySelector('#table-empty').hidden = visibleResults.length > 0;
}

function renderAssessment(result) {
  cohortResults = result.results;
  riskSummary = result.summary;
  document.querySelector('#total-students').textContent = String(result.total_students);
  document.querySelector('#average-performance').textContent = result.summary.average_performance.toFixed(1);
  document.querySelector('#high-risk-share').textContent = `${result.summary.high_risk_percentage.toFixed(1)}%`;
  renderRiskDistribution(result.summary, result.total_students);
  document.querySelector('#student-search').value = '';
  document.querySelector('#risk-filter').value = 'ALL';
  renderResultsTable();
  resultsSection.hidden = false;
}

function escapeCsv(value) {
  let safeValue = String(value);
  if (/^[=+@\-\t\r]/.test(safeValue)) safeValue = `'${safeValue}`;
  return `"${safeValue.replaceAll('"', '""')}"`;
}

function downloadCsv(fileName, contents) {
  const blob = new Blob([contents], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

csvInput.addEventListener('change', (event) => loadCsv(event.target.files[0]));
dropZone.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropZone.classList.remove('dragover');
  loadCsv(event.dataTransfer.files[0]);
});

document.querySelector('#remove-file').addEventListener('click', () => {
  parsedStudents = [];
  csvInput.value = '';
  previewSection.hidden = true;
  analyzeButton.disabled = true;
  resultsSection.hidden = true;
  setError('');
  document.querySelector('#upload-title-text').textContent = 'Drop a CSV file here, or browse files';
});

document.querySelector('#template-button').addEventListener('click', () => {
  const headers = requiredColumns.join(',');
  const samples = [
    ['EM-1001', 82, 7.8, 74, 79, 4.2, 0, 0, 76],
    ['EM-1002', 61, 5.9, 55, 60, 2.1, 2, 1, 48],
    ['EM-1003', 94, 8.6, 88, 91, 5.5, 0, 0, 92],
  ];
  downloadCsv('edumind-cohort-template.csv', [headers, ...samples.map((row) => row.join(','))].join('\r\n'));
});

document.querySelector('#analyze-button').addEventListener('click', async () => {
  if (parsedStudents.length === 0) return;
  setError('');
  analyzeButton.disabled = true;
  analyzeButton.querySelector('span:first-child').textContent = 'Analyzing cohort';
  try {
    const response = await fetch('/predict/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ students: parsedStudents }),
    });
    const result = await response.json();
    if (!response.ok) {
      const detail = Array.isArray(result.detail) ? result.detail.map((issue) => issue.msg).join(' ') : result.detail;
      throw new Error(detail || 'The cohort could not be analyzed. Review the values and try again.');
    }
    renderAssessment(result);
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    setError(error instanceof TypeError ? 'Unable to reach the prediction service. Confirm the API is running and try again.' : error.message);
  } finally {
    analyzeButton.disabled = parsedStudents.length === 0;
    analyzeButton.querySelector('span:first-child').textContent = 'Analyze cohort';
  }
});

document.querySelector('#student-search').addEventListener('input', renderResultsTable);
document.querySelector('#risk-filter').addEventListener('change', renderResultsTable);
document.querySelector('#export-button').addEventListener('click', () => {
  if (cohortResults.length === 0) return;
  const headers = ['student_id', 'predicted_performance', 'risk_level', 'low_risk_probability', 'medium_risk_probability', 'high_risk_probability'];
  const rows = cohortResults.map((student) => [
    student.student_id,
    student.predicted_performance.toFixed(2),
    student.risk_level,
    student.risk_probabilities.LOW,
    student.risk_probabilities.MEDIUM,
    student.risk_probabilities.HIGH,
  ].map(escapeCsv).join(','));
  downloadCsv('edumind-cohort-results.csv', [headers.join(','), ...rows].join('\r\n'));
});
