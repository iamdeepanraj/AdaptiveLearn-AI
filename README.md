# AdaptiveLearn AI — Local Single-Student Study Companion

AdaptiveLearn AI is a private, source-grounded academic study companion that runs on a **local LLM through Ollama (Gemma)**. It transforms textbooks, lecture slides, and notes into an interactive, verifiable knowledge base. It teaches exclusively from the student's uploaded materials, provides tailored pedagogical explanations, quizzes with graded options, tracks weak concepts and misconceptions, and runs an automated multi-round remediation loop ("Learn this again") until mastery is demonstrated.

---

## Key Highlights & Capabilities

1. **Local Model via Ollama with Gemma**:
   - Native integration with the Ollama HTTP API (`POST /api/chat`, format `json`, stream `false`).
   - Defaults to `gemma4:e4b` (configurable via `OLLAMA_MODEL`) with context window `OLLAMA_NUM_CTX=8192` and timeout `OLLAMA_TIMEOUT_S=180`.
   - Temperature calibration: `0.2` for explanations & grading, `0.6` for question generation.
   - Pydantic response validation with 1 automatic strict retry on JSON formatting errors, discarding invalid output and logging cleanly.
   - Robust health check (`/api/health`): if Ollama is unreachable or the model is not pulled, reports `llm.configured=false` with actionable CLI instructions (`ollama pull gemma4:e4b`), shows a visible banner in the frontend, and falls back gracefully to labeled extractive mode without breaking.

2. **Single-Student Ownership (Teacher Portal Removed)**:
   - Complete removal of the teacher portal, teacher router, teacher analytics page, join codes, and course joining.
   - Every user is an autonomous student who owns their courses and materials. Strict row-level course ownership prevents any student from seeing another user's materials, chats, quizzes, or mastery history.
   - System evaluation benchmarks (`scripts/run_eval.py` and the System Evaluation page) are preserved for the student to inspect model faithfulness, citation validity, and simulation performance.

3. **Grounded Pedagogical Tutor**:
   - Answers strictly from retrieved passages of the student's uploaded materials, citing `[S1]`, `[S2]` with source preview modals. Marker validation removes citations that were not retrieved.
   - 4 tailored explanation styles:
     - **"What is X?"**: Plain-language definition $\to$ why it matters $\to$ one worked example from material.
     - **"How / Why...?"**: Numbered step-by-step causal explanation.
     - **"Solve / Calculate..."**: Given values $\to$ formula from material $\to$ substitution $\to$ result with units $\to$ 1-line check.
     - **"Compare A and B"**: Comparison table $\to$ 1 sentence on when each applies.
   - Honest abstention: If the material does not cover the question, clearly states so and suggests closest available topics. Outside knowledge is never used unless explicitly toggled, where it appears in a separated, clearly labeled box.
   - Injects a line of prerequisite help when the student has recorded weakness on an underlying concept.

4. **Numerical Problems with AST Verification**:
   - Formulates Easy (direct substitution), Medium (rearrangement / 2-step), and Hard (multi-formula synthesis) problems.
   - Recomputes and validates answers using a sandboxed AST safe evaluator (`SafeExpressionEvaluator`), rejecting any problem whose stated answer diverges from mathematical reality.
   - "Suggested Practice Problems" panel in both the Course page and Tutor sidebar, complete with step-by-step derivations and citations to source pages and slides.

5. **Quiz with Graded Options**:
   - 4 options per MCQ:
     - `correct`: Fully right per material (score 1.0) $\to$ concept understood.
     - `partial`: Contains a real part of the idea but incomplete or slightly wrong (score 0.5) $\to$ names the missing nuance.
     - `wrong` (2 options): Plausible distractors based on common misconceptions (score 0.0) $\to$ names the misconception.
   - Options are shuffled; labels and scores are **never sent to the browser before submission**.
   - Dual-pass verification: A second blind model pass must independently pick the correct option and classify the others; otherwise the question is rejected.

6. **Deterministic + Paraphrase Short-Answer Grading**:
   - Evaluates student explanations against model answers with 3–6 weighted keywords and acceptable synonyms.
   - Two-stage grading: deterministic stemming and synonym match first, followed by an optional LLM paraphrase check for unmatched keywords. The model can never lower a deterministic score.
   - Score bands: $\ge 0.8$ Correct, $0.5 - 0.8$ Partially Correct, $< 0.5$ Incorrect.

7. **Understanding Level & Misconception Tracking**:
   - Combines MCQ option scores, keyword short-answer coverage, numerical correctness, and BKT posterior probability.
   - BKT partial credit: Score $\ge 0.75$ treated as correct observation, $< 0.75$ as incorrect.
   - Recency-weighted running understanding score (recent attempts weighted higher).
   - Concept understanding levels: **Strong** ($\ge 0.8$), **Developing** ($0.5 - 0.8$), **Weak** ($< 0.5$), **Not assessed**.
   - Tracks misconception frequency by concept to reveal persistent patterns.

8. **"My Understanding" Dashboard (`/understanding`)**:
   - Overall understanding level and score.
   - Topic and concept breakdown with trends (improving, steady, declining).
   - Top 3 weak concepts with detected misconceptions, specific question/answer evidence, and citations.
   - Plain-language summary synthesized strictly from stored telemetry.

9. **Automated Remediation Loop ("Learn this again")**:
   - Accessible after each quiz and directly from `/understanding`.
   - Multi-round adaptive cycle:
     - **Round 1**: Simpler explanation from material, addressing prerequisites and specific misconceptions, plus 1 new worked example.
     - Asks 2–3 fresh check questions (MCQ with graded options, short answer, numerical).
     - Score $\ge 0.8$: Concept marked as improving and scheduled for spaced repetition.
     - Score $< 0.8$: Advances round using alternative explanation style (**Round 2**: Analogy $\to$ **Round 3**: Step-by-step procedure). After 3 rounds, suggests specific textbook readings.

---

## Architecture & Technology Stack

```
                          ┌──────────────────────────────────────┐
                          │     Next.js 16 App Router UI         │
                          │  TypeScript • Tailwind • Lucide      │
                          └──────────────────┬───────────────────┘
                                             │ HTTP/JSON
                                             ▼
                          ┌──────────────────────────────────────┐
                          │        FastAPI Python Backend        │
                          │        Uvicorn • Pydantic v2         │
                          └──────┬───────────┬────────────┬──────┘
                                 │           │            │
       ┌─────────────────────────┴──┐        │            └─────────────────────────┐
       ▼                            ▼        ▼                                      ▼
┌──────────────┐          ┌────────────┐   ┌──────────────────┐           ┌────────────────────┐
│ Ingestion    │          │ Retrieval  │   │ Learner Model    │           │ Adaptive Quizzes   │
│ PyMuPDF (PDF)│          │ Vector +   │   │ - BKT Engine     │           │ - Graded 4-Opt MCQ │
│ PPTX Slides  │          │ BM25/Dense │   │ - Recency Score  │           │ - Keyword Short Ans│
│ Audio/Video  │          │ Reranker   │   │ - Misconceptions │           │ - AST Numerical    │
└──────────────┘          └────────────┘   └──────────────────┘           └────────────────────┘
       │                            │
       └────────────────────────────┴─────────────┐
                                                  ▼
                                  ┌────────────────────────────────┐
                                  │   Local Ollama HTTP Server     │
                                  │   Gemma (`gemma4:e4b`)         │
                                  │   `nomic-embed-text`           │
                                  └────────────────────────────────┘
```

---

## Local Setup & Ollama Installation

### 1. Install and Start Ollama

#### macOS (Homebrew or Direct Download)
```bash
# Using Homebrew:
brew install ollama

# Or download from https://ollama.ai/download
```

#### Linux
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

#### Start the Ollama Service
```bash
ollama serve
```

### 2. Pull Gemma Model and Embeddings

```bash
# Pull the default local model:
ollama pull gemma4:e4b

# Confirm the exact tag with ollama list:
ollama list

# Optional: Pull local embeddings model (if using EMBEDDING_PROVIDER=ollama):
ollama pull nomic-embed-text
```

> **Note**: You can configure any local model tag by setting `OLLAMA_MODEL` in your `.env` (e.g. `gemma2:2b`, `gemma2:9b`, `gemma4:e4b`, `llama3.2:3b`).

---

## Environment Variables (.env)

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Key configuration variables:

```ini
# Database
DATABASE_URL=postgresql://deepan@localhost:5432/adaptivelearn

# Security / JWT
SECRET_KEY=adaptivelearn-local-secure-key-2026
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Local LLM via Ollama
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma4:e4b
OLLAMA_NUM_CTX=8192
OLLAMA_TIMEOUT_S=180

# Embeddings
EMBEDDING_PROVIDER=deterministic_tfidf
OLLAMA_EMBED_MODEL=nomic-embed-text

# Server & Storage
UPLOAD_DIR=./uploads
CORS_ORIGINS=http://localhost:3000,http://localhost:3005
NEXT_PUBLIC_API_URL=http://localhost:8005/api
```

---

## Running the Application Locally

### 1. Backend (FastAPI)

```bash
# Enter backend directory and activate virtualenv
cd backend
python3 -m venv venv
./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt

# Run database migrations
./venv/bin/alembic upgrade head

# Seed initial course materials, topics, and verified questions
PYTHONPATH=.. ./venv/bin/python3 -c "
from backend.app.database import init_db, SessionLocal
from backend.app.services.seed_data import seed_database
init_db()
db = SessionLocal()
seed_database(db)
db.close()
"

# Run tests
PYTHONPATH=.. ./venv/bin/pytest tests/ -v

# Start FastAPI server on port 8005
PYTHONPATH=.. ./venv/bin/uvicorn backend.app.main:app --host 0.0.0.0 --port 8005
```

### 2. Frontend (Next.js 16)

```bash
cd frontend
npm install
npm run build
npm run dev -- -p 3005
```

Open `http://localhost:3005` in your browser.

### 3. Demo Account
- **Student Login**: `student@adaptivelearn.ai` / `StudentPass123!`

---

## Running System Evaluation

You can run the end-to-end RAG and student simulation evaluation offline:

```bash
cd backend
PYTHONPATH=.. ./venv/bin/python3 ../scripts/run_eval.py
```

This tests:
- **Tutor RAG Evaluation**: Faithfulness, answer relevancy, context precision/recall, and citation validity (evaluated by the local Gemma model as judge).
- **Simulated Student Evaluation**: Multi-round simulation with Novice, Intermediate, and Advanced agents testing BKT mastery gain, understanding-level accuracy, question repetition rate ($0.0\%$), and remediation success rate.
- Outputs results cleanly to `evaluation_report.json`.
