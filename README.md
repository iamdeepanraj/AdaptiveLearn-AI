# AdaptiveLearn AI — Local Single-Student Study Companion

AdaptiveLearn AI is a private, source-grounded academic study companion that runs on a **local LLM through Ollama (Gemma)**. It transforms textbooks, lecture slides, and notes into an interactive, verifiable knowledge base. It teaches exclusively from the student's uploaded materials, provides tailored pedagogical explanations, quizzes with graded options, tracks weak concepts and misconceptions, and runs an automated multi-round remediation loop ("Learn this again") until mastery is demonstrated.

---

## Key Highlights & Capabilities

1. **Local Model via Ollama with Gemma**:
   - Native integration with the Ollama HTTP API (`POST /api/chat` with SSE token streaming at `POST /api/chat/stream`).
   - Defaults to `gemma4:e4b` (configurable via `OLLAMA_MODEL`) with context window `OLLAMA_NUM_CTX=8192` and timeout `OLLAMA_TIMEOUT_S=180`.
   - Temperature calibration: `0.2` for explanations & grading, `0.6` for question generation.
   - Real-time token streaming with model badges (`gemma4:e4b · local` vs `extractive · fallback`), post-stream `[S#]` citation validation, and offline banner with fix instructions (`ollama pull gemma4:e4b`).

2. **Complete Light & Dark Theme Support (Zero-Flash Tokens)**:
   - Full CSS variable design tokens defined in `globals.css` with zero hardcoded colors in UI components.
   - 3-choice toggle in top navigation: **Light**, **Dark**, and **System** (defaulting to `prefers-color-scheme`).
   - Synchronous inline `<script>` in `<head>` applies `.dark` before first paint, eliminating flash of wrong theme. Choice stored in `localStorage` wrapped in `try/catch`.
   - Strict WCAG AA contrast compliance ($\ge 4.5:1$) across all body text, headings, cards, and status colors.

3. **Fixed Prompt Bar & In-Chat Attachments**:
   - Fixed bottom prompt bar (`sticky bottom-0`) with mobile keyboard protection; only the message thread scrolls.
   - Paperclip attachment button supporting PDFs, PPTX slides, diagrams/images, audio, video, and `.vtt`/`.srt` subtitle transcripts.
   - Real-time indexing progress chip with "still processing" guard (unindexed files are never cited prematurely).
   - Prioritized retrieval: attached material is cited first when asking targeted follow-up questions.
   - Inline conversation session renaming (`PATCH /api/chat/conversations/{id}`) and deletion (`DELETE /api/chat/conversations/{id}`) with newest-first ordering and date group headers.
   - Dynamic starter prompts generated from the student's actual course topics (developer test chips removed).

4. **"Quick Revise" Topic Flashcards & BKT Integration**:
   - Drawer modal accessible directly from the AI Tutor chat bar and quiz review screens.
   - Extracts 6–10 concept flashcards (definitions, formulas, key facts) strictly from the topic's uploaded materials with exact citations to page, slide, or timestamp.
   - Flip card interaction with "Knew it" and "Didn't know" ratings.
   - Reviews feed directly into the Bayesian Knowledge Tracing (BKT) learner model and Spaced Repetition scheduler for that topic.

5. **Quiz Option Order Stability & Section Architecture**:
   - **Option Order**: Option content is shuffled server-side on creation with keys re-indexed strictly ascending from A to D. Stored on the assessment item for permanent reload stability. Option labels and scores are withheld from the client until submission.
   - **Separate Sections**: Quizzes are organized into 3 clear sections:
     - **Section A: Multiple choice** (4-option graded MCQs)
     - **Section B: Short answers** (Keyword-graded conceptual explanations)
     - **Section C: Numerical problems** (AST-verified mathematical problems)
   - Section tabs, per-section progress bars, and separate section scores ($A, B, C$) displayed on the results screen.

6. **MCQ vs Short-Answer Diagnostic Comparison & Targeted Drills**:
   - Cross-section diagnostic engine comparing recognition (MCQ) vs recall/synthesis (Short Answer) across the current quiz and the last 5 quizzes.
   - **Minimum Answers Rule**: Requires at least 3 answered questions in each section to avoid noise.
   - **4 Pedagogical Diagnoses**:
     - *Case 1 (MCQ $\ge 0.7$, SA $< 0.5$)*: "How to improve your written answers" with side-by-side answer comparisons, missing keywords highlighted, 3-part structured writing template, and a 3-question short-answer practice drill.
     - *Case 2 (SA $\ge 0.7$, MCQ $< 0.5$)*: "How to improve on multiple choice" with partial distractor trap frequency analysis, chosen partial options vs correct answers, and a 3-question MCQ drill.
     - *Case 3 (Both $< 0.5$)*: "Learn this again" foundational review with tutor prompts and Quick Revise flashcard recommendations.
     - *Case 4 (Both $\ge 0.7$)*: Suggests advancing to Rigorous difficulty drills with multi-step synthesis.
   - Stored in the quiz report and surfaced on the "My Understanding" dashboard.

7. **Unified Mastery Threshold (`MASTERY_THRESHOLD = 0.85`)**:
   - Consistent $0.85$ posterior probability threshold across backend configuration, API schemas, Dashboard module indicators, and My Understanding status badges.

8. **AST Numerical Problem Verification & Short-Answer Grading**:
   - Sandboxed AST expression evaluator validates numerical problems, recalculating tolerances and preventing hallucinated answers.
   - Keyword short-answer grader performs deterministic root stemming, synonym matching, and optional non-lowering LLM paraphrase checks.

9. **Automated Remediation Loop ("Learn this again")**:
   - Multi-round adaptive cycle accessible from quizzes and My Understanding:
     - **Round 1**: Simpler explanation from material, addressing prerequisites and misconceptions + 1 new worked example + 2–3 check questions.
     - **Round 2**: Analogy explanation $\to$ **Round 3**: Step-by-step procedure $\to$ Reading guide.


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

# Run tests from repository root
PYTHONPATH=. ./backend/venv/bin/pytest backend/tests -v

# Start FastAPI server on port 8005
PYTHONPATH=.. ./venv/bin/uvicorn backend.app.main:app --host 0.0.0.0 --port 8005
```

### Running Automated Test Suites

```bash
# Run all test suites
PYTHONPATH=. ./backend/venv/bin/pytest backend/tests -v

# Targeted test suites:
# 1. Option order stability & key suppression before answering
PYTHONPATH=. ./backend/venv/bin/pytest backend/tests/test_option_order.py -v

# 2. Section A, B, C breakdown & independent section scores
PYTHONPATH=. ./backend/venv/bin/pytest backend/tests/test_section_scores.py -v

# 3. MCQ vs Short-Answer diagnostic comparison & practice drills
PYTHONPATH=. ./backend/venv/bin/pytest backend/tests/test_mcq_vs_sa_suggestions.py -v

# 4. Chat session deduplication, rename, delete & eval isolation
PYTHONPATH=. ./backend/venv/bin/pytest backend/tests/test_session_management.py -v

# 5. Quick Revise flashcards extraction with citations & BKT review
PYTHONPATH=. ./backend/venv/bin/pytest backend/tests/test_quick_revise.py -v

# 6. In-chat file attachment, prioritized retrieval & VTT/SRT parsing
PYTHONPATH=. ./backend/venv/bin/pytest backend/tests/test_in_chat_upload.py -v

# 7. Ollama real-time token streaming & offline extractive fallback
PYTHONPATH=. ./backend/venv/bin/pytest backend/tests/test_ollama_streaming.py -v
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
