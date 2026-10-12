"""
EduMind-AI
Synthetic Student Academic Dataset Generator
"""

from pathlib import Path

import numpy as np
import pandas as pd


RANDOM_SEED = 42
N_STUDENTS = 5000

PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = PROJECT_ROOT / "data" / "raw"
OUTPUT_FILE = OUTPUT_DIR / "student_academic_data.csv"


def generate_dataset(
    n_students: int = N_STUDENTS,
    random_seed: int = RANDOM_SEED,
) -> pd.DataFrame:
    """Generate synthetic student academic data."""

    rng = np.random.default_rng(random_seed)

    # Student ID
    student_id = np.arange(
        100001,
        100001 + n_students,
    )

    # Academic features
    attendance = np.clip(
        rng.normal(78, 12, n_students),
        40,
        100,
    )

    previous_cgpa = np.clip(
        rng.normal(7.2, 1.2, n_students),
        4.0,
        10.0,
    )

    internal_marks = np.clip(
        rng.normal(68, 15, n_students),
        20,
        100,
    )

    assignment_score = np.clip(
        rng.normal(72, 14, n_students),
        20,
        100,
    )

    study_hours = np.clip(
        rng.normal(3.5, 1.8, n_students),
        0.5,
        10,
    )

    backlogs = np.clip(
        rng.poisson(0.8, n_students),
        0,
        6,
    )

    previous_failures = np.clip(
        rng.poisson(0.5, n_students),
        0,
        5,
    )

    participation_score = np.clip(
        rng.normal(68, 17, n_students),
        10,
        100,
    )

    # -----------------------------------------
    # Performance score
    # -----------------------------------------

    performance_score = (
        0.22 * attendance
        + 5.0 * previous_cgpa
        + 0.25 * internal_marks
        + 0.18 * assignment_score
        + 1.8 * study_hours
        + 0.12 * participation_score
        - 2.5 * backlogs
        - 3.0 * previous_failures
        + rng.normal(0, 7, n_students)
    )

    performance_score = (
        (performance_score - performance_score.min())
        / (
            performance_score.max()
            - performance_score.min()
        )
        * 100
    )

    final_score = np.clip(
        performance_score,
        0,
        100,
    )

    # -----------------------------------------
    # Academic risk score
    # -----------------------------------------

    risk_score = (
        0.35 * (100 - attendance)
        + 0.25 * (10 - previous_cgpa) * 10
        + 0.15 * (100 - internal_marks)
        + 0.10 * (100 - assignment_score)
        + 2.5 * backlogs
        + 3.0 * previous_failures
        + 0.08 * (100 - participation_score)
        - 2.0 * study_hours
        + rng.normal(0, 5, n_students)
    )

    # -----------------------------------------
    # Risk classification
    # -----------------------------------------

    low_threshold = np.percentile(
        risk_score,
        50,
    )

    high_threshold = np.percentile(
        risk_score,
        85,
    )

    risk_level = np.select(
        [
            risk_score <= low_threshold,
            risk_score <= high_threshold,
        ],
        [
            "LOW",
            "MEDIUM",
        ],
        default="HIGH",
    )

    # -----------------------------------------
    # Create DataFrame
    # -----------------------------------------

    df = pd.DataFrame(
        {
            "student_id": student_id,
            "attendance": np.round(
                attendance,
                2,
            ),
            "previous_cgpa": np.round(
                previous_cgpa,
                2,
            ),
            "internal_marks": np.round(
                internal_marks,
                2,
            ),
            "assignment_score": np.round(
                assignment_score,
                2,
            ),
            "study_hours": np.round(
                study_hours,
                2,
            ),
            "backlogs": backlogs,
            "previous_failures": previous_failures,
            "participation_score": np.round(
                participation_score,
                2,
            ),
            "final_score": np.round(
                final_score,
                2,
            ),
            "risk_level": risk_level,
        }
    )

    return df


def save_dataset(df: pd.DataFrame) -> None:
    """Save dataset to CSV."""

    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    df.to_csv(
        OUTPUT_FILE,
        index=False,
    )

    print("\n" + "=" * 60)
    print("EduMind-AI Dataset Generated Successfully")
    print("=" * 60)

    print(f"\nDataset shape: {df.shape}")
    print(f"Saved to: {OUTPUT_FILE}")

    print("\nColumns:")

    for column in df.columns:
        print(f"  - {column}")

    print("\nRisk distribution:")
    print(
        df["risk_level"]
        .value_counts()
    )

    print("\nDataset preview:")
    print(df.head())

    print("\nBasic statistics:")
    print(
        df.describe()
        .round(2)
    )


if __name__ == "__main__":
    dataset = generate_dataset()
    save_dataset(dataset)
