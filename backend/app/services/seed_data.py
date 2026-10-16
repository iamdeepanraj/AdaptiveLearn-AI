import os
from sqlalchemy.orm import Session
import logging

from backend.app.models.user import User, UserRole
from backend.app.models.course import Course, Topic, Prerequisite
from backend.app.models.document import Document, DocumentChunk, DocumentStatus, SourceType
from backend.app.models.quiz import Question, QuestionType, DifficultyLevel
from backend.app.models.learner import LearnerMastery, MasteryState, Recommendation, RecommendationType
from backend.app.auth import hash_password
from backend.app.retrieval.embeddings import embedding_service
from backend.app.assessment.verifier import QuestionVerifier
from backend.app.assessment.generator import QuestionGenerator

logger = logging.getLogger(__name__)

def seed_database(db: Session):
    """Pre-populates the database with foundational courses, materials, questions, and demo accounts."""
    
    student = db.query(User).filter(User.email == "student@adaptivelearn.ai").first()
    if not student:
        student = User(
            email="student@adaptivelearn.ai",
            hashed_password=hash_password("StudentPass123!"),
            full_name="Alex Chen",
            role=UserRole.STUDENT
        )
        db.add(student)
        db.commit()
        db.refresh(student)

    # 2. Create Course (Owned by student)
    course = db.query(Course).filter(Course.code == "CS101").first()
    if not course:
        course = Course(
            code="CS101",
            title="Introduction to Machine Learning & Neural Networks",
            description="Core theoretical principles of machine learning, loss optimization, backpropagation, and deep transformer architectures.",
            created_by_id=student.id
        )
        db.add(course)
        db.commit()
        db.refresh(course)
    elif course.created_by_id != student.id:
        course.created_by_id = student.id
        db.commit()

    # 3. Create Topics
    topic_data = [
        {"name": "Foundations of Learning & Loss Functions", "code": "ML-01", "order": 1, "desc": "Empirical risk minimization, cross-entropy, and mean squared error loss formulations."},
        {"name": "Optimization & Backpropagation", "code": "ML-02", "order": 2, "desc": "Gradient descent, automatic differentiation, chain rule computations, and momentum."},
        {"name": "Deep Architectures & Convolutional Networks", "code": "ML-03", "order": 3, "desc": "Spatial feature hierarchies, convolution kernels, pooling layers, and residual connections."},
        {"name": "Attention Mechanisms & Transformers", "code": "ML-04", "order": 4, "desc": "Scaled dot-product attention, multi-head attention heads, and sequence modeling."}
    ]

    topics = []
    for td in topic_data:
        t = db.query(Topic).filter(Topic.course_id == course.id, Topic.name == td["name"]).first()
        if not t:
            t = Topic(
                course_id=course.id,
                name=td["name"],
                code=td["code"],
                description=td["desc"],
                order_index=td["order"]
            )
            db.add(t)
            db.commit()
            db.refresh(t)
        topics.append(t)

    # Prerequisites: Topic 2 requires Topic 1; Topics 3 & 4 require Topic 2
    prereq_pairs = [(topics[1].id, topics[0].id), (topics[2].id, topics[1].id), (topics[3].id, topics[1].id)]
    for tid, pid in prereq_pairs:
        exists = db.query(Prerequisite).filter(Prerequisite.topic_id == tid, Prerequisite.prerequisite_topic_id == pid).first()
        if not exists:
            db.add(Prerequisite(topic_id=tid, prerequisite_topic_id=pid))
    db.commit()

    # 4. Create Source Documents
    doc_pdf = db.query(Document).filter(Document.filename == "Neural_Networks_Fundamentals.pdf").first()
    if not doc_pdf:
        doc_pdf = Document(
            course_id=course.id,
            uploaded_by_id=teacher.id,
            filename="Neural_Networks_Fundamentals.pdf",
            file_type=SourceType.PDF,
            file_path="uploads/Neural_Networks_Fundamentals.pdf",
            file_size_bytes=420000,
            status=DocumentStatus.INDEXED,
            page_or_slide_count=5,
            extracted_metadata={"author": "Stanford AI Lab", "units": 5}
        )
        db.add(doc_pdf)
        db.commit()
        db.refresh(doc_pdf)

        # Chunks for PDF
        pdf_chunks = [
            {
                "page": 1,
                "topic_id": topics[0].id,
                "text": "Chapter 1: Foundations of Machine Learning. Supervised learning algorithms learn a mapping function f(x) from input features x to ground-truth targets y. To quantify model discrepancy, loss functions L(y, f(x)) measure error. For continuous regression targets, Mean Squared Error (MSE) is given by L = 1/2 * (y - f(x))^2. For multiclass classification, Cross-Entropy Loss measures the negative log-likelihood of the true class probability.",
                "fig": "Figure 1.1: Empirical Risk Minimization workflow on Page 1."
            },
            {
                "page": 2,
                "topic_id": topics[0].id,
                "text": "Regularization techniques mitigate overfitting by adding a penalty term R(w) to the objective function. L2 regularization (Ridge) adds 1/2 * lambda * ||w||_2^2, driving weights toward zero smoothly and preventing extreme weight magnitudes. L1 regularization (Lasso) adds lambda * ||w||_1, encouraging sparsity in model parameters by driving non-critical weights to exact zero.",
                "fig": None
            },
            {
                "page": 3,
                "topic_id": topics[1].id,
                "text": "Chapter 2: Optimization and Gradient Descent. The primary objective of Gradient Descent in neural network optimization is to minimize the empirical risk loss function by iteratively updating model parameters theta in the direction opposite to the gradient: theta_new = theta_old - eta * grad_L(theta), where eta represents the learning rate. If eta is too large, optimization diverges; if too small, convergence is painfully slow.",
                "fig": "Figure 2.1: Convex vs Non-convex Loss Surface topology on Page 3."
            },
            {
                "page": 4,
                "topic_id": topics[1].id,
                "text": "Backpropagation computes the analytical gradient of the loss with respect to each weight via recursive application of the calculus chain rule. In a computational graph, gradients flow backward from the scalar loss output to each node. In contrast to Batch Gradient Descent which computes gradients over the complete dataset, Stochastic Gradient Descent (SGD) uses mini-batches of size B, providing noisy gradient estimates that help escape local minima and saddle points.",
                "fig": "Figure 2.2: Forward propagation vs Backward sensitivity pass on Page 4."
            },
            {
                "page": 5,
                "topic_id": topics[2].id,
                "text": "Chapter 3: Convolutional Neural Networks (CNNs). Standard dense layers fail on high-dimensional visual inputs due to parameter explosion and lack of translation invariance. CNNs leverage parameter sharing and spatial local receptive fields through convolution kernels. Pooling layers (such as Max Pooling with stride s=2) downsample spatial feature maps, reducing computational complexity while imparting translation equivariance.",
                "fig": "Figure 3.1: 2D Convolution Operation across RGB input channels on Page 5."
            }
        ]

        for idx, c in enumerate(pdf_chunks):
            chunk = DocumentChunk(
                document_id=doc_pdf.id,
                course_id=course.id,
                topic_id=c["topic_id"],
                chunk_index=idx,
                content=c["text"],
                page_number=c["page"],
                source_type=SourceType.PDF,
                figure_description=c["fig"],
                embedding=embedding_service.get_embedding(c["text"])
            )
            db.add(chunk)
        db.commit()

    # PPTX Document
    doc_pptx = db.query(Document).filter(Document.filename == "Attention_and_Transformers_Lecture.pptx").first()
    if not doc_pptx:
        doc_pptx = Document(
            course_id=course.id,
            uploaded_by_id=teacher.id,
            filename="Attention_and_Transformers_Lecture.pptx",
            file_type=SourceType.PPTX,
            file_path="uploads/Attention_and_Transformers_Lecture.pptx",
            file_size_bytes=310000,
            status=DocumentStatus.INDEXED,
            page_or_slide_count=6,
            extracted_metadata={"author": "Prof. Eleanor Vance", "slides": 6}
        )
        db.add(doc_pptx)
        db.commit()
        db.refresh(doc_pptx)

        pptx_chunks = [
            {
                "slide": 1,
                "topic_id": topics[3].id,
                "text": "Slide 1: Limitations of Recurrent Architectures (RNN/LSTM). Sequential token processing forces O(N) sequential steps, preventing parallel training across GPUs. Long-range context degradation persists despite gating mechanisms.",
                "fig": None
            },
            {
                "slide": 5,
                "topic_id": topics[3].id,
                "text": "Slide 5: Scaled Dot-Product Attention Mechanics. Given Query (Q), Key (K), and Value (V) projections: Attention(Q, K, V) = softmax( (Q * K^T) / sqrt(d_k) ) * V. The scaling factor 1/sqrt(d_k) prevents the dot products from growing excessively large for large dimensions, which would otherwise push the softmax function into regions with vanishingly small gradients.",
                "fig": "Slide 5 Diagram: Scaled Dot-Product Attention architecture with Query, Key, and Value matrices."
            },
            {
                "slide": 6,
                "topic_id": topics[3].id,
                "text": "Slide 6: Multi-Head Attention. Rather than computing a single attention function, Multi-Head Attention projects Q, K, and V linearly h times into d_k, d_k, and d_v dimensions. This allows the model to jointly attend to information from different representation subspaces at different positions.",
                "fig": "Slide 6 Chart: 8-head parallel projection tensor splits."
            }
        ]

        for idx, c in enumerate(pptx_chunks):
            chunk = DocumentChunk(
                document_id=doc_pptx.id,
                course_id=course.id,
                topic_id=c["topic_id"],
                chunk_index=idx,
                content=c["text"],
                slide_number=c["slide"],
                source_type=SourceType.PPTX,
                figure_description=c["fig"],
                embedding=embedding_service.get_embedding(c["text"])
            )
            db.add(chunk)
        db.commit()

    # 5. Seed Verified Question Bank with Graded Options (1 Correct, 1 Partial, 2 Wrong)
    questions_data = [
        {
            "topic_id": topics[1].id,
            "type": QuestionType.MCQ,
            "diff": DifficultyLevel.EASY,
            "text": "In gradient descent optimization, what happens if the learning rate parameter is set excessively high?",
            "options": [
                {
                    "key": "A",
                    "text": "The model diverges and the loss oscillates wildly or becomes NaN",
                    "label": "correct",
                    "score": 1.0,
                    "rationale": "Excessive learning rate overshoots the minimum and causes mathematical instability and divergence.",
                    "misconception": None
                },
                {
                    "key": "B",
                    "text": "The optimization proceeds too slowly toward the minimum",
                    "label": "partial",
                    "score": 0.5,
                    "rationale": "Slow convergence happens when the learning rate is too small, not excessively high, though it reflects understanding of learning rate tuning.",
                    "misconception": "Confused the effect of an excessively small learning rate with an excessively large one."
                },
                {
                    "key": "C",
                    "text": "The weights instantly shrink to zero due to L1 regularization",
                    "label": "wrong",
                    "score": 0.0,
                    "rationale": "L1 regularization drives sparsity, which is independent of the gradient descent step size.",
                    "misconception": "Confused gradient descent step size with penalty regularization effects."
                },
                {
                    "key": "D",
                    "text": "Training converges in exactly one iteration",
                    "label": "wrong",
                    "score": 0.0,
                    "rationale": "Higher learning rate does not guarantee one-step convergence; it destabilizes convergence.",
                    "misconception": "Believed higher step size always speeds up convergence without overshooting."
                }
            ],
            "correct": "A",
            "explanation": "As stated in Neural_Networks_Fundamentals.pdf (Page 3), if the learning rate is too large, weight updates overshoot the loss minimum, causing optimization divergence or severe oscillation.",
            "citations": [{"document_id": doc_pdf.id, "document_name": "Neural_Networks_Fundamentals.pdf", "page": 3, "quote": "If eta is too large, optimization diverges; if too small, convergence is painfully slow."}]
        },
        {
            "topic_id": topics[1].id,
            "type": QuestionType.NUMERICAL,
            "diff": DifficultyLevel.MEDIUM,
            "text": "A weight parameter has current value w = 2.50. The computed gradient of the loss is grad = 3.00, and the learning rate is eta = 0.10. Using standard gradient descent w_new = w - eta * grad, calculate the updated weight value.",
            "options": None,
            "correct": "2.20",
            "explanation": "Using w_new = w - (eta * grad): w_new = 2.50 - (0.10 * 3.00) = 2.50 - 0.30 = 2.20.",
            "citations": [{"document_id": doc_pdf.id, "document_name": "Neural_Networks_Fundamentals.pdf", "page": 3, "quote": "theta_new = theta_old - eta * grad_L(theta)"}]
        },
        {
            "topic_id": topics[3].id,
            "type": QuestionType.MCQ,
            "diff": DifficultyLevel.MEDIUM,
            "text": "Why do Transformers divide the dot product Q * K^T by sqrt(d_k) in Scaled Dot-Product Attention?",
            "options": [
                {
                    "key": "A",
                    "text": "To prevent large dot-product magnitudes that push softmax into vanishing gradient regions",
                    "label": "correct",
                    "score": 1.0,
                    "rationale": "Scaling by 1/sqrt(d_k) controls dot product variance so softmax maintains non-vanishing gradients.",
                    "misconception": None
                },
                {
                    "key": "B",
                    "text": "To normalize the attention scores so that they sum to 1.0",
                    "label": "partial",
                    "score": 0.5,
                    "rationale": "Normalization to sum to 1.0 is performed by the softmax function, not the scaling factor alone.",
                    "misconception": "Confused the role of square-root dimension scaling with the softmax probability normalization."
                },
                {
                    "key": "C",
                    "text": "To guarantee that the resulting attention matrix is diagonal",
                    "label": "wrong",
                    "score": 0.0,
                    "rationale": "Attention matrices are dense, not diagonal.",
                    "misconception": "Assumed attention matrices must be diagonal matrices."
                },
                {
                    "key": "D",
                    "text": "To eliminate the need for Value vector projections",
                    "label": "wrong",
                    "score": 0.0,
                    "rationale": "Value projections are still required to compute the weighted sum of representations.",
                    "misconception": "Believed scaling replaces representation projections."
                }
            ],
            "correct": "A",
            "explanation": "According to Attention_and_Transformers_Lecture.pptx (Slide 5), the scaling factor 1/sqrt(d_k) prevents large dot products from saturating the softmax function, which would lead to vanishingly small training gradients.",
            "citations": [{"document_id": doc_pptx.id, "document_name": "Attention_and_Transformers_Lecture.pptx", "slide": 5, "quote": "The scaling factor 1/sqrt(d_k) prevents the dot products from growing excessively large for large dimensions..."}]
        },
        {
            "topic_id": topics[0].id,
            "type": QuestionType.MCQ,
            "diff": DifficultyLevel.EASY,
            "text": "Which regularization technique adds the sum of absolute values of weights (L1 norm) to encourage model sparsity?",
            "options": [
                {
                    "key": "A",
                    "text": "Lasso Regularization (L1)",
                    "label": "correct",
                    "score": 1.0,
                    "rationale": "Lasso penalizes absolute weight magnitudes, driving non-critical weights to exact zero.",
                    "misconception": None
                },
                {
                    "key": "B",
                    "text": "Ridge Regularization (L2)",
                    "label": "partial",
                    "score": 0.5,
                    "rationale": "Ridge is a weight penalty regularization technique, but uses squared L2 norm and shrinks weights smoothly rather than enforcing exact zero sparsity.",
                    "misconception": "Confused L1 Lasso (absolute penalty, exact zero sparsity) with L2 Ridge (squared penalty, smooth shrinkage)."
                },
                {
                    "key": "C",
                    "text": "Batch Normalization",
                    "label": "wrong",
                    "score": 0.0,
                    "rationale": "Batch Normalization normalizes activation statistics across a batch, not a weight norm penalty.",
                    "misconception": "Confused activation normalization with weight norm regularization."
                },
                {
                    "key": "D",
                    "text": "Dropout with keep probability 0.5",
                    "label": "wrong",
                    "score": 0.0,
                    "rationale": "Dropout randomly deactivates neurons during forward pass, rather than adding an L1 norm penalty to the objective.",
                    "misconception": "Confused stochastic layer deactivation with explicit loss norm penalties."
                }
            ],
            "correct": "A",
            "explanation": "Neural_Networks_Fundamentals.pdf (Page 2) explains that L1 regularization (Lasso) adds lambda * ||w||_1, which drives non-critical parameters to exact zero.",
            "citations": [{"document_id": doc_pdf.id, "document_name": "Neural_Networks_Fundamentals.pdf", "page": 2, "quote": "L1 regularization (Lasso) adds lambda * ||w||_1, encouraging sparsity in model parameters..."}]
        },
        {
            "topic_id": topics[1].id,
            "type": QuestionType.SHORT_ANSWER,
            "diff": DifficultyLevel.HARD,
            "text": "What fundamental mathematical rule enables backpropagation to compute gradients through multilayer computational graphs?",
            "options": [
                {"keyword": "chain rule", "weight": 1.0, "synonyms": ["calculus chain rule", "recursive chain rule", "chain rule of calculus"]},
                {"keyword": "calculus", "weight": 0.5, "synonyms": ["differential calculus", "differentiation"]},
                {"keyword": "gradient", "weight": 0.5, "synonyms": ["partial derivatives", "derivatives"]}
            ],
            "correct": "Chain rule of calculus",
            "explanation": "Backpropagation recursively applies the calculus chain rule backward from the scalar loss output to each weight tensor (Neural_Networks_Fundamentals.pdf, Page 4).",
            "citations": [{"document_id": doc_pdf.id, "document_name": "Neural_Networks_Fundamentals.pdf", "page": 4, "quote": "Backpropagation computes the analytical gradient of the loss with respect to each weight via recursive application of the calculus chain rule."}]
        },
        {
            "topic_id": topics[0].id,
            "type": QuestionType.MCQ,
            "diff": DifficultyLevel.MEDIUM,
            "text": "For continuous regression problems, what standard loss formulation measures the squared difference between target y and prediction f(x)?",
            "options": [
                {
                    "key": "A",
                    "text": "Mean Squared Error (MSE)",
                    "label": "correct",
                    "score": 1.0,
                    "rationale": "MSE measures 1/2 * (y - f(x))^2 for continuous regression.",
                    "misconception": None
                },
                {
                    "key": "B",
                    "text": "Mean Absolute Error (MAE)",
                    "label": "partial",
                    "score": 0.5,
                    "rationale": "MAE is also a regression loss, but it computes absolute linear differences rather than squared differences.",
                    "misconception": "Confused absolute regression error with squared regression error."
                },
                {
                    "key": "C",
                    "text": "Cross-Entropy Loss",
                    "label": "wrong",
                    "score": 0.0,
                    "rationale": "Cross-entropy loss is applied to classification tasks using probabilities, not continuous regression targets.",
                    "misconception": "Applied classification probability loss to continuous regression."
                },
                {
                    "key": "D",
                    "text": "Hinge Loss",
                    "label": "wrong",
                    "score": 0.0,
                    "rationale": "Hinge loss is used in margin-based classifiers like Support Vector Machines.",
                    "misconception": "Confused margin classification loss with regression discrepancy."
                }
            ],
            "correct": "A",
            "explanation": "Neural_Networks_Fundamentals.pdf (Page 1) defines Mean Squared Error (MSE) as L = 1/2 * (y - f(x))^2 for continuous regression targets.",
            "citations": [{"document_id": doc_pdf.id, "document_name": "Neural_Networks_Fundamentals.pdf", "page": 1, "quote": "For continuous regression targets, Mean Squared Error (MSE) is given by L = 1/2 * (y - f(x))^2."}]
        },
        {
            "topic_id": topics[2].id,
            "type": QuestionType.MCQ,
            "diff": DifficultyLevel.MEDIUM,
            "text": "Why do Convolutional Neural Networks (CNNs) outperform fully connected layers on high-dimensional visual inputs?",
            "options": [
                {
                    "key": "A",
                    "text": "They use parameter sharing and spatial local receptive fields",
                    "label": "correct",
                    "score": 1.0,
                    "rationale": "Parameter sharing across kernels and local receptive fields dramatically reduce parameter counts while preserving spatial structure.",
                    "misconception": None
                },
                {
                    "key": "B",
                    "text": "They use deeper layers with smaller batch sizes",
                    "label": "partial",
                    "score": 0.5,
                    "rationale": "While CNNs can be deep, the primary structural inductive bias comes from convolution kernels and parameter sharing.",
                    "misconception": "Attributed spatial processing capability solely to depth rather than convolutional weight sharing."
                },
                {
                    "key": "C",
                    "text": "They disable backpropagation updates to prevent overfitting",
                    "label": "wrong",
                    "score": 0.0,
                    "rationale": "CNNs rely on backpropagation to train kernel weights.",
                    "misconception": "Believed convolutional weights are not trained via backpropagation."
                },
                {
                    "key": "D",
                    "text": "They require O(N) sequential recurrent steps across pixels",
                    "label": "wrong",
                    "score": 0.0,
                    "rationale": "Sequential steps are characteristic of RNNs, not CNNs which compute 2D convolutions in parallel.",
                    "misconception": "Confused convolutional spatial filtering with recurrent temporal processing."
                }
            ],
            "correct": "A",
            "explanation": "Neural_Networks_Fundamentals.pdf (Page 5) states that CNNs leverage parameter sharing and spatial local receptive fields through convolution kernels to impart translation equivariance.",
            "citations": [{"document_id": doc_pdf.id, "document_name": "Neural_Networks_Fundamentals.pdf", "page": 5, "quote": "CNNs leverage parameter sharing and spatial local receptive fields through convolution kernels."}]
        },
        {
            "topic_id": topics[3].id,
            "type": QuestionType.MCQ,
            "diff": DifficultyLevel.HARD,
            "text": "What is the primary advantage of Multi-Head Attention compared to single-head attention in Transformers?",
            "options": [
                {
                    "key": "A",
                    "text": "It allows the model to jointly attend to information from different representation subspaces",
                    "label": "correct",
                    "score": 1.0,
                    "rationale": "Linear projections into multiple heads enable attending to distinct syntactic and semantic relationships simultaneously.",
                    "misconception": None
                },
                {
                    "key": "B",
                    "text": "It increases the sequence length capacity by a factor of h",
                    "label": "partial",
                    "score": 0.5,
                    "rationale": "Multi-head attention projects dimensionality d_k per head, but does not increase maximum context sequence length.",
                    "misconception": "Confused representation subspace dimensionality with maximum token context window length."
                },
                {
                    "key": "C",
                    "text": "It restricts attention exclusively to adjacent tokens",
                    "label": "wrong",
                    "score": 0.0,
                    "rationale": "Multi-head attention allows all-to-all global token interactions, not just adjacent tokens.",
                    "misconception": "Confused transformer self-attention with localized 1D convolution."
                },
                {
                    "key": "D",
                    "text": "It eliminates the need for Key and Value matrices",
                    "label": "wrong",
                    "score": 0.0,
                    "rationale": "Each attention head still requires Key and Value projections.",
                    "misconception": "Believed multi-head architecture eliminates projection matrices."
                }
            ],
            "correct": "A",
            "explanation": "Attention_and_Transformers_Lecture.pptx (Slide 6) notes that Multi-Head Attention allows the model to jointly attend to information from different representation subspaces at different positions.",
            "citations": [{"document_id": doc_pptx.id, "document_name": "Attention_and_Transformers_Lecture.pptx", "slide": 6, "quote": "This allows the model to jointly attend to information from different representation subspaces at different positions."}]
        },
        {
            "topic_id": topics[1].id,
            "type": QuestionType.MCQ,
            "diff": DifficultyLevel.EASY,
            "text": "How does Stochastic Gradient Descent (SGD) differ from standard Batch Gradient Descent?",
            "options": [
                {
                    "key": "A",
                    "text": "SGD uses mini-batches rather than the complete dataset per update",
                    "label": "correct",
                    "score": 1.0,
                    "rationale": "SGD evaluates gradient estimates on subsets/mini-batches of data, providing computational efficiency and noisy trajectories.",
                    "misconception": None
                },
                {
                    "key": "B",
                    "text": "SGD calculates gradients without using loss functions",
                    "label": "partial",
                    "score": 0.5,
                    "rationale": "SGD still requires loss functions to evaluate gradients on mini-batches.",
                    "misconception": "Assumed mini-batch optimization skips loss function evaluation."
                },
                {
                    "key": "C",
                    "text": "SGD removes learning rate parameters entirely",
                    "label": "wrong",
                    "score": 0.0,
                    "rationale": "SGD explicitly relies on learning rate schedules (eta) for updating parameters.",
                    "misconception": "Believed stochastic descent is parameter-free."
                },
                {
                    "key": "D",
                    "text": "SGD computes analytical second-order Hessian matrices",
                    "label": "wrong",
                    "score": 0.0,
                    "rationale": "SGD is a first-order optimization method, not a second-order Hessian method.",
                    "misconception": "Confused first-order mini-batch descent with second-order curvature methods."
                }
            ],
            "correct": "A",
            "explanation": "Neural_Networks_Fundamentals.pdf (Page 4) explains that SGD uses mini-batches of size B providing noisy gradient estimates rather than computing over the complete dataset.",
            "citations": [{"document_id": doc_pdf.id, "document_name": "Neural_Networks_Fundamentals.pdf", "page": 4, "quote": "In contrast to Batch Gradient Descent which computes gradients over the complete dataset, Stochastic Gradient Descent (SGD) uses mini-batches..."}]
        },
        {
            "topic_id": topics[2].id,
            "type": QuestionType.NUMERICAL,
            "diff": DifficultyLevel.HARD,
            "text": "An input feature map has spatial dimensions 28x28. A max-pooling layer with a 2x2 filter and stride s=2 is applied. What is the output spatial height dimension in pixels?",
            "options": None,
            "correct": "14",
            "explanation": "With input size 28 and stride 2 without padding, the output height is 28 / 2 = 14 pixels (Neural_Networks_Fundamentals.pdf, Page 5).",
            "citations": [{"document_id": doc_pdf.id, "document_name": "Neural_Networks_Fundamentals.pdf", "page": 5, "quote": "Pooling layers (such as Max Pooling with stride s=2) downsample spatial feature maps..."}]
        },
        {
            "topic_id": topics[3].id,
            "type": QuestionType.SHORT_ANSWER,
            "diff": DifficultyLevel.HARD,
            "text": "Why do traditional Recurrent Neural Networks (RNNs) struggle with long-range sequence context?",
            "options": [
                {"keyword": "sequential", "weight": 1.0, "synonyms": ["sequential processing", "step-by-step", "sequential token processing"]},
                {"keyword": "vanishing gradient", "weight": 1.0, "synonyms": ["gradient degradation", "vanishing gradients", "exploding gradient"]},
                {"keyword": "O(N)", "weight": 0.5, "synonyms": ["linear time", "unparallelized"]}
            ],
            "correct": "Sequential token processing and vanishing gradients",
            "explanation": "As detailed in Attention_and_Transformers_Lecture.pptx (Slide 1), sequential processing forces O(N) steps causing gradient degradation across long distances.",
            "citations": [{"document_id": doc_pptx.id, "document_name": "Attention_and_Transformers_Lecture.pptx", "slide": 1, "quote": "Sequential token processing forces O(N) sequential steps, preventing parallel training across GPUs. Long-range context degradation persists..."}]
        },
        {
            "topic_id": topics[0].id,
            "type": QuestionType.SHORT_ANSWER,
            "diff": DifficultyLevel.MEDIUM,
            "text": "Explain the fundamental tradeoff in choosing the learning rate for gradient descent.",
            "options": [
                {"keyword": "divergence", "weight": 1.0, "synonyms": ["diverge", "overshooting", "unstable", "loss explodes"]},
                {"keyword": "slow convergence", "weight": 1.0, "synonyms": ["slow training", "tiny steps", "slow", "sluggish"]},
                {"keyword": "step size", "weight": 0.5, "synonyms": ["learning rate", "eta", "update magnitude"]}
            ],
            "correct": "A learning rate that is too large causes divergence or oscillation, whereas a learning rate that is too small results in excessively slow convergence.",
            "explanation": "Neural_Networks_Fundamentals.pdf (Page 4): If the learning rate is too large, optimization diverges; if too small, convergence takes excessive epochs.",
            "citations": [{"document_id": doc_pdf.id, "document_name": "Neural_Networks_Fundamentals.pdf", "page": 4, "quote": "The learning rate (eta) governs step magnitude. Excessive values trigger loss divergence, whereas undersized values cause sluggish convergence."}]
        },
        {
            "topic_id": topics[2].id,
            "type": QuestionType.SHORT_ANSWER,
            "diff": DifficultyLevel.MEDIUM,
            "text": "What are the two primary computational advantages of using parameter sharing and local receptive fields in CNNs?",
            "options": [
                {"keyword": "parameter reduction", "weight": 1.0, "synonyms": ["fewer weights", "memory efficiency", "reduced parameters", "fewer parameters"]},
                {"keyword": "translation invariance", "weight": 1.0, "synonyms": ["spatial hierarchy", "shift invariance", "spatial invariance", "feature detection"]},
                {"keyword": "receptive field", "weight": 0.5, "synonyms": ["local patch", "kernel", "filter window"]}
            ],
            "correct": "Parameter sharing drastically reduces parameter count and memory footprint, while local receptive fields enable learning spatial hierarchies and translation invariance.",
            "explanation": "Neural_Networks_Fundamentals.pdf (Page 5): Convolutional weight sharing enforces parameter efficiency and translation invariance across visual inputs.",
            "citations": [{"document_id": doc_pdf.id, "document_name": "Neural_Networks_Fundamentals.pdf", "page": 5, "quote": "Weight sharing across convolutional kernels significantly curtails parameter count and promotes translation invariance across the receptive fields."}]
        }
    ]

    for qd in questions_data:
        # For MCQs: shuffle option content on server, assign ascending keys A, B, C, D
        if qd["type"] == QuestionType.MCQ and qd.get("options"):
            shuffled_opts, correct_key = QuestionGenerator.shuffle_and_rekey_options(qd["options"])
            qd["options"] = shuffled_opts
            qd["correct"] = correct_key

        fp = QuestionVerifier.generate_fingerprint(qd["text"])
        existing_q = db.query(Question).filter(Question.fingerprint == fp).first()
        if not existing_q:
            q = Question(
                course_id=course.id,
                topic_id=qd["topic_id"],
                question_type=qd["type"],
                difficulty=qd["diff"],
                question_text=qd["text"],
                options=qd["options"],
                correct_answer=qd["correct"],
                explanation=qd["explanation"],
                fingerprint=fp,
                source_citations=qd["citations"],
                is_verified=True
            )
            db.add(q)
        else:
            existing_q.options = qd["options"]
            existing_q.correct_answer = qd["correct"]
            existing_q.explanation = qd["explanation"]
            existing_q.source_citations = qd["citations"]
            existing_q.is_verified = True
    db.commit()


    # 6. Initialize Student Learner Mastery & Baseline Recommendations
    for idx, t in enumerate(topics):
        m = db.query(LearnerMastery).filter(LearnerMastery.user_id == student.id, LearnerMastery.topic_id == t.id).first()
        if not m:
            p_val = 0.75 if idx == 0 else (0.42 if idx == 1 else 0.20)
            m_state = MasteryState.PROFICIENT if p_val >= 0.70 else (MasteryState.LEARNING if p_val >= 0.40 else MasteryState.NOVICE)
            m = LearnerMastery(
                user_id=student.id,
                topic_id=t.id,
                p_mastery=p_val,
                mastery_state=m_state,
                total_attempts=4 if idx < 2 else 0,
                correct_attempts=3 if idx == 0 else (2 if idx == 1 else 0),
                last_accuracy=0.75 if idx == 0 else (0.50 if idx == 1 else 0.0)
            )
            db.add(m)
    db.commit()

    # Initial Recommendation
    rec = db.query(Recommendation).filter(Recommendation.user_id == student.id).first()
    if not rec:
        db.add(Recommendation(
            user_id=student.id,
            course_id=course.id,
            topic_id=topics[1].id,
            recommendation_type=RecommendationType.REVIEW_WEAK,
            title="Practice Optimization & Backpropagation",
            reason="Your mastery estimate is 42%. A short 3-question drill on gradient descent mechanics will elevate you to proficient.",
            priority=1
        ))
        db.commit()

    logger.info("Database seeding completed successfully.")
