import os
import joblib
import pandas as pd


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR = os.path.join(BASE_DIR, "models")


# Load trained models
performance_model = joblib.load(
    os.path.join(MODEL_DIR, "performance_regression_model.pkl")
)

risk_model = joblib.load(
    os.path.join(MODEL_DIR, "risk_classification_model.pkl")
)

regression_scaler = joblib.load(
    os.path.join(MODEL_DIR, "regression_scaler.pkl")
)

classification_scaler = joblib.load(
    os.path.join(MODEL_DIR, "classification_scaler.pkl")
)

feature_columns = joblib.load(
    os.path.join(MODEL_DIR, "feature_columns.pkl")
)


def prepare_data(student_data):
    return pd.DataFrame(
        [student_data],
        columns=feature_columns
    )


def predict_performance(student_data):
    data = prepare_data(student_data)

    data_scaled = regression_scaler.transform(data)

    prediction = performance_model.predict(data_scaled)[0]

    return round(float(prediction), 2)


def predict_risk(student_data):
    data = prepare_data(student_data)

    data_scaled = classification_scaler.transform(data)

    prediction = risk_model.predict(data_scaled)[0]
    probabilities = risk_model.predict_proba(data_scaled)[0]

    risk_probabilities = {
        class_name: round(float(probability), 4)
        for class_name, probability in zip(
            risk_model.classes_,
            probabilities
        )
    }

    return {
        "risk_level": prediction,
        "probabilities": risk_probabilities
    }


def predict_batch(students_data):
    data = pd.DataFrame(
        students_data,
        columns=feature_columns
    )

    performance_scaled = regression_scaler.transform(data)
    classification_scaled = classification_scaler.transform(data)
    performance_predictions = performance_model.predict(performance_scaled)
    risk_predictions = risk_model.predict(classification_scaled)
    risk_probabilities = risk_model.predict_proba(classification_scaled)

    results = []
    for index, prediction in enumerate(performance_predictions):
        probabilities = {
            str(class_name): round(float(probability), 4)
            for class_name, probability in zip(
                risk_model.classes_,
                risk_probabilities[index]
            )
        }
        results.append({
            "predicted_performance": round(float(prediction), 2),
            "risk_level": str(risk_predictions[index]),
            "risk_probabilities": probabilities
        })

    return results


# Test prediction
if __name__ == "__main__":

    test_student = [
        75.0,
        7.2,
        68.0,
        72.0,
        3.5,
        1,
        0,
        68.0
    ]

    performance = predict_performance(test_student)
    risk = predict_risk(test_student)

    print("========================================")
    print("EDUMIND-AI PREDICTION TEST")
    print("========================================")

    print(f"Predicted Performance Score: {performance}")
    print(f"Predicted Risk Level: {risk['risk_level']}")

    print("\nRisk Probabilities:")

    for level, probability in risk["probabilities"].items():
        print(f"{level}: {probability}")
