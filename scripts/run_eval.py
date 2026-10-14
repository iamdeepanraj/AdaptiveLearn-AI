#!/usr/bin/env python3
"""
AdaptiveLearn AI Evaluation Suite
Evaluates RAG performance and simulated student learning trajectories using the local Ollama model.
"""

import os
import sys
import json
from datetime import datetime

# Add project root and backend to python path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
sys.path.insert(0, ROOT_DIR)
sys.path.insert(0, BACKEND_DIR)

from backend.app.database import SessionLocal, init_db
from backend.app.services.seed_data import seed_database
from backend.app.evaluation.runner import EvaluationRunner
from backend.app.config import settings

def main():
    print("=" * 70)
    print(" AdaptiveLearn AI — System Evaluation & Student Simulation ")
    print("=" * 70)
    print(f"Timestamp: {datetime.utcnow().isoformat()}")
    print(f"LLM Provider: {settings.LLM_PROVIDER}")
    print(f"Ollama Model: {settings.OLLAMA_MODEL}")
    print(f"Ollama Base URL: {settings.OLLAMA_BASE_URL}")
    print("-" * 70)

    # Initialize and seed database if necessary
    init_db()
    db = SessionLocal()
    try:
        seed_database(db)
        print("Database seeded and verified.")

        # 1. Run RAG Benchmark
        print("\n[1/2] Running RAG Benchmark Evaluation...")
        rag_report = EvaluationRunner.run_benchmark(db)
        if "average_metrics" in rag_report:
            print(f"  Tutor & Judge: {rag_report.get('judge_model')}")
            for metric, val in rag_report["average_metrics"].items():
                print(f"  - {metric.replace('_', ' ').title():24}: {val:.4f}")
        else:
            print(f"  Status: {rag_report.get('status', 'not run')} ({rag_report.get('error', 'unknown error')})")

        # 2. Run Simulated Student Evaluation
        print("\n[2/2] Running Simulated Student Evaluation...")
        sim_report = EvaluationRunner.run_student_simulation(db)
        if "results" in sim_report:
            print(f"  Overall Remediation Success Rate: {sim_report.get('remediation_success_rate', 0.0)*100:.1f}%")
            print(f"  Overall Understanding Accuracy:   {sim_report.get('overall_understanding_level_accuracy', 0.0)*100:.1f}%\n")
            for res in sim_report["results"]:
                print(f"  Profile: {res['profile']}")
                print(f"    Hidden Level: {res['hidden_true_level']:12} -> Estimated Level: {res['estimated_understanding_level']}")
                print(f"    Mastery:      {res['initial_mastery']:.2f} -> {res['final_mastery']:.2f} (Gain: +{res['mastery_gain']:.2f})")
                print(f"    Repetition:   {res['repetition_rate']*100:.1f}% (Duplicates: {res['duplicate_serves']})")
                print(f"    Remediation:  Triggered={res['remediation_triggered']}, Successful={res['remediation_successful']}")
                print("")
        else:
            print(f"  Status: {sim_report.get('status', 'not run')} ({sim_report.get('error', 'unknown error')})")

        output_path = os.path.join(ROOT_DIR, "evaluation_report.json")
        full_report = {
            "evaluation_timestamp": datetime.utcnow().isoformat(),
            "rag_evaluation": rag_report,
            "student_simulation": sim_report
        }
        with open(output_path, "w") as f:
            json.dump(full_report, f, indent=2)
        print(f"Saved complete evaluation report to: {output_path}")
        print("=" * 70)

    finally:
        db.close()

if __name__ == "__main__":
    main()
