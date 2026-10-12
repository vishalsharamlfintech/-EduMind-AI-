# EduMind-AI

Student performance and academic-risk estimation using a trained regression model and risk classifier. The project includes a FastAPI prediction API and a responsive browser dashboard.

**Created by Vishal Sharma**

## Run locally

Install the runtime dependencies and start the API from the repository root:

```powershell
python -m pip install -r requirements.txt
python -m uvicorn backend.main:app --reload
```

Open <http://127.0.0.1:8000/> for the dashboard or <http://127.0.0.1:8000/docs> for interactive API documentation.

## API

`POST /predict` accepts all eight model features. Values are restricted to the training-data ranges:

| Feature | Accepted range |
| --- | --- |
| `attendance` | 40–100 |
| `previous_cgpa` | 4–10 |
| `internal_marks` | 20–100 |
| `assignment_score` | 20–100 |
| `study_hours` | 0.5–10 |
| `backlogs` | 0–6 |
| `previous_failures` | 0–5 |
| `participation_score` | 10–100 |

The response contains a predicted performance score, a risk category, and probabilities for each risk category. Invalid or unknown input fields return HTTP 422.

`POST /predict/batch` accepts 1–500 student records and returns each prediction with cohort averages and risk counts. The `/cohort` dashboard accepts a CSV, previews it before analysis, and exports the results. Its required columns are `student_id` and the eight model feature columns shown on the page. Uploaded inputs are not saved by the dashboard; malformed IDs, missing columns, invalid values, and oversized cohorts are rejected before inference.

Run the API regression tests with:

```powershell
python -m unittest discover -s tests -v
```

Recent assessment history stores prediction summaries in the current browser only; student input values are not added to that history.

## Important limitations

The included dataset is synthetic, and model outputs are estimates rather than explanations or diagnoses. Do not use a prediction as the sole basis for academic, disciplinary, admissions, or financial decisions. Review each case with the student and an appropriate academic support professional.
