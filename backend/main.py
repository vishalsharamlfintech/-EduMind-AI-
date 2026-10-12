from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field
from fastapi.staticfiles import StaticFiles

from app.predict import feature_columns, predict_batch, predict_performance, predict_risk


app = FastAPI(
    title="EduMind-AI API",
    description="AI-powered student performance and risk prediction API",
    version="1.0.0"
)
STATIC_DIR = Path(__file__).resolve().parent / "static"
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


class StudentData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    attendance: float = Field(ge=40, le=100)
    previous_cgpa: float = Field(ge=4, le=10)
    internal_marks: float = Field(ge=20, le=100)
    assignment_score: float = Field(ge=20, le=100)
    study_hours: float = Field(ge=0.5, le=10)
    backlogs: int = Field(ge=0, le=6)
    previous_failures: int = Field(ge=0, le=5)
    participation_score: float = Field(ge=10, le=100)


class BatchStudentData(StudentData):
    student_id: str = Field(min_length=1, max_length=80)


class BatchPredictionRequest(BaseModel):
    students: list[BatchStudentData] = Field(min_length=1, max_length=500)


@app.get("/")
def home():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/cohort", include_in_schema=False)
def cohort_dashboard():
    return FileResponse(STATIC_DIR / "cohort.html")


@app.get("/health")
def health():
    return {"status": "ok", "service": "EduMind-AI API"}


@app.post("/predict")
def predict(student: StudentData):

    student_data = [
        student.attendance,
        student.previous_cgpa,
        student.internal_marks,
        student.assignment_score,
        student.study_hours,
        student.backlogs,
        student.previous_failures,
        student.participation_score
    ]

    performance = predict_performance(student_data)
    risk = predict_risk(student_data)

    return {
        "predicted_performance": performance,
        "risk_level": risk["risk_level"],
        "risk_probabilities": risk["probabilities"]
    }


@app.post("/predict/batch")
def predict_cohort(request: BatchPredictionRequest):
    students = request.students
    model_inputs = [
        [getattr(student, feature) for feature in feature_columns]
        for student in students
    ]
    predictions = predict_batch(model_inputs)

    risk_counts = {"LOW": 0, "MEDIUM": 0, "HIGH": 0}
    results = []
    for student, prediction in zip(students, predictions):
        risk_counts[prediction["risk_level"]] += 1
        results.append({"student_id": student.student_id, **prediction})

    total = len(results)
    average_performance = sum(
        result["predicted_performance"] for result in results
    ) / total

    return {
        "total_students": total,
        "summary": {
            "average_performance": round(average_performance, 2),
            "risk_counts": risk_counts,
            "high_risk_percentage": round(risk_counts["HIGH"] / total * 100, 1)
        },
        "results": results
    }