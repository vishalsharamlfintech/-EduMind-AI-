import unittest

from fastapi.testclient import TestClient

from backend.main import app


class PredictionApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def setUp(self):
        self.payload = {
            "attendance": 75,
            "previous_cgpa": 7.2,
            "internal_marks": 68,
            "assignment_score": 72,
            "study_hours": 3.5,
            "backlogs": 1,
            "previous_failures": 0,
            "participation_score": 68,
        }

    def test_dashboard_and_health_routes(self):
        dashboard = self.client.get("/")
        cohort_dashboard = self.client.get("/cohort")
        health = self.client.get("/health")

        self.assertEqual(dashboard.status_code, 200)
        self.assertIn("text/html", dashboard.headers["content-type"])
        self.assertEqual(cohort_dashboard.status_code, 200)
        self.assertEqual(health.json()["status"], "ok")

    def test_prediction_returns_performance_and_risk(self):
        response = self.client.post("/predict", json=self.payload)

        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertGreaterEqual(result["predicted_performance"], 0)
        self.assertLessEqual(result["predicted_performance"], 100)
        self.assertIn(result["risk_level"], {"LOW", "MEDIUM", "HIGH"})
        self.assertEqual(set(result["risk_probabilities"]), {"LOW", "MEDIUM", "HIGH"})

    def test_rejects_values_outside_training_ranges(self):
        invalid_values = {
            "attendance": 101,
            "previous_cgpa": 3.9,
            "internal_marks": 19,
            "assignment_score": 101,
            "study_hours": 10.1,
            "backlogs": 7,
            "previous_failures": -1,
            "participation_score": 9,
        }

        for field, value in invalid_values.items():
            with self.subTest(field=field):
                response = self.client.post(
                    "/predict",
                    json={**self.payload, field: value},
                )
                self.assertEqual(response.status_code, 422)

    def test_rejects_unrecognized_fields(self):
        response = self.client.post(
            "/predict",
            json={**self.payload, "unexpected": 1},
        )

        self.assertEqual(response.status_code, 422)

    def test_batch_prediction_returns_per_student_results_and_summary(self):
        students = [
            {"student_id": "S-101", **self.payload},
            {"student_id": "S-102", **self.payload, "attendance": 92},
        ]

        response = self.client.post("/predict/batch", json={"students": students})

        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(result["total_students"], 2)
        self.assertEqual(len(result["results"]), 2)
        self.assertEqual(
            sum(result["summary"]["risk_counts"].values()),
            result["total_students"],
        )
        self.assertGreaterEqual(result["summary"]["high_risk_percentage"], 0)
        self.assertLessEqual(result["summary"]["high_risk_percentage"], 100)
        self.assertEqual(result["results"][0]["student_id"], "S-101")

    def test_batch_prediction_rejects_empty_or_invalid_cohorts(self):
        empty_response = self.client.post("/predict/batch", json={"students": []})
        invalid_student = {"student_id": "S-101", **self.payload, "study_hours": 11}
        invalid_response = self.client.post(
            "/predict/batch",
            json={"students": [invalid_student]},
        )

        self.assertEqual(empty_response.status_code, 422)
        self.assertEqual(invalid_response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
