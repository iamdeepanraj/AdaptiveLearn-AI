const API_BASE = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? '/api' : 'http://127.0.0.1:8005/api');

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: 'student' | 'teacher' | 'admin';
  is_active: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user_id: number;
  email: string;
  full_name: string;
  role: string;
}

export interface Topic {
  id: number;
  course_id: number;
  name: string;
  code?: string;
  description?: string;
  order_index: number;
  created_at: string;
  prerequisite_ids: number[];
}

export interface Course {
  id: number;
  code: string;
  title: string;
  description?: string;
  created_by_id?: number;
  created_at: string;
  topics: Topic[];
  document_count: number;
}

export interface PrerequisiteNode {
  id: number;
  name: string;
  code?: string;
  mastery_prob: number;
  status: 'locked' | 'available' | 'learning' | 'mastered' | 'proficient';
}

export interface PrerequisiteEdge {
  source: number;
  target: number;
}

export interface PrerequisiteGraph {
  nodes: PrerequisiteNode[];
  edges: PrerequisiteEdge[];
}

export interface SourceCitation {
  chunk_id: number;
  document_id: number;
  document_name: string;
  source_type: string;
  page?: number;
  slide?: number;
  timestamp_start?: number;
  timestamp_end?: number;
  quote: string;
  figure_description?: string;
  similarity_score?: number;
}

export interface DocumentItem {
  id: number;
  course_id: number;
  filename: string;
  file_type: string;
  file_size_bytes: number;
  status: string;
  page_or_slide_count: number;
  error_message?: string;
  extracted_metadata?: Record<string, any>;
  created_at: string;
}

export interface SourcePreview {
  document_id: number;
  filename: string;
  file_type: string;
  target_page?: number;
  target_slide?: number;
  target_timestamp?: number;
  total_units: number;
  excerpt: string;
  figure_description?: string;
}

export interface ChatMessage {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations: SourceCitation[];
  is_grounded: boolean;
  has_insufficient_evidence: boolean;
  created_at: string;
}

export interface Conversation {
  id: number;
  course_id: number;
  title: string;
  created_at: string;
  updated_at: string;
  messages: ChatMessage[];
}

export interface QuestionOption {
  key: string;
  text: string;
}

export interface QuestionStudentView {
  id: number;
  topic_id: number;
  topic_name: string;
  question_type: 'mcq' | 'short_answer' | 'numerical';
  difficulty: string;
  question_text: string;
  options?: QuestionOption[];
}

export interface QuizSession {
  id: number;
  course_id: number;
  title: string;
  status: string;
  difficulty_mode: string;
  total_questions: number;
  is_diagnostic: boolean;
  started_at: string;
  questions: QuestionStudentView[];
}

export interface GradedOptionFeedback {
  key: string;
  text: string;
  label: 'correct' | 'partial' | 'wrong';
  score: number;
  rationale: string;
  misconception?: string;
}

export interface QuizResponseResult {
  response_id: number;
  question_id: number;
  is_correct: boolean;
  score_awarded: number;
  correct_answer: string;
  explanation: string;
  feedback: string;
  feedback_citations: SourceCitation[];
  misconception_tag?: string;
  
  // Graded MCQ feedback
  option_label?: 'correct' | 'partial' | 'wrong';
  option_score?: number;
  option_rationale?: string;
  missing_detail?: string;
  revealed_options?: GradedOptionFeedback[];

  // Keyword Short-Answer feedback
  covered_keywords?: string[];
  missing_keywords?: string[];

  // Learner & BKT feedback
  topic_id: number;
  topic_name: string;
  p_mastery_before: number;
  p_mastery_after: number;
  mastery_delta: number;
  new_mastery_state: string;
  running_understanding_score?: number;
  understanding_level?: 'Strong' | 'Developing' | 'Weak' | 'Not assessed';
}


export interface TopicBreakdown {
  topic_id: number;
  topic_name: string;
  questions_attempted: number;
  questions_correct: number;
  accuracy_percentage: number;
  p_mastery: number;
  mastery_state: string;
  status: 'strength' | 'developing' | 'weak';
}

export interface AssessmentReport {
  quiz_session_id: number;
  course_title: string;
  total_questions: number;
  correct_count: number;
  score_percentage: number;
  completed_at: string;
  topic_breakdowns: TopicBreakdown[];
  identified_misconceptions: string[];
  strengths: string[];
  recommended_next_steps: string[];
}

export interface TopicMastery {
  topic_id: number;
  topic_name: string;
  course_id: number;
  course_name: string;
  p_mastery: number;
  mastery_state: string;
  total_attempts: number;
  correct_attempts: number;
  accuracy: number;
  next_review_due_at?: string;
  is_due_for_review: boolean;
}

export interface RecommendationCard {
  id: number;
  topic_id: number;
  topic_name: string;
  course_id: number;
  recommendation_type: string;
  title: string;
  reason: string;
  priority: number;
}

export interface MasteryTimelinePoint {
  timestamp: string;
  p_mastery: number;
  topic_name: string;
  is_correct: boolean;
}

export interface StudentDashboardData {
  overall_mastery: number;
  topics_mastered_count: number;
  topics_in_progress_count: number;
  total_study_sessions: number;
  total_questions_answered: number;
  overall_accuracy: number;
  weak_topics: TopicMastery[];
  strong_topics: TopicMastery[];
  upcoming_revisions: TopicMastery[];
  recommendations: RecommendationCard[];
  mastery_timeline: MasteryTimelinePoint[];
}

export interface DifficultConcept {
  topic_id: number;
  topic_name: string;
  course_name: string;
  average_mastery: number;
  student_struggle_percentage: number;
  common_misconceptions: string[];
  total_attempts: number;
}

export interface StudentProgressRow {
  student_id: number;
  student_name: string;
  email: string;
  overall_mastery: number;
  quizzes_taken: number;
  last_active?: string;
  weak_topic_count: number;
}

export interface TeacherDashboardData {
  total_students: number;
  total_courses: number;
  average_class_mastery: number;
  quizzes_completed_total: number;
  difficult_concepts: DifficultConcept[];
  students: StudentProgressRow[];
}

export interface UnderstandingTopicItem {
  topic_id: number;
  topic_name: string;
  topic_code?: string;
  course_id?: number;
  understanding_score: number;
  understanding_level: 'Strong' | 'Developing' | 'Weak' | 'Not assessed';
  total_attempts: number;
  correct_attempts: number;
  p_mastery: number;
  trend: 'improving' | 'steady' | 'declining';
  misconception_counts: Record<string, number>;
}

export interface WeakConceptEvidence {
  question_text: string;
  student_answer: string;
  is_correct: boolean;
  score_awarded: number;
  misconception_tag?: string;
  submitted_at?: string;
}

export interface WeakConceptItem {
  topic_id: number;
  concept_name: string;
  score: number;
  level: string;
  misconception: string;
  evidence: WeakConceptEvidence[];
  citations: SourceCitation[];
}

export interface RemediationSessionItem {
  id: number;
  topic_id: number;
  concept_name: string;
  round_number: number;
  score: number;
  is_improving: boolean;
  status: string;
  created_at: string;
}

export interface UnderstandingOverview {
  overall_level: 'Strong' | 'Developing' | 'Weak' | 'Not assessed';
  overall_score: number;
  topics: UnderstandingTopicItem[];
  weak_concepts: WeakConceptItem[];
  strengths: string[];
  plain_summary: string;
  remediation_sessions: RemediationSessionItem[];
}

export interface RemediationStartData {
  session_id: number;
  topic_id: number;
  concept_name: string;
  round_number: number;
  explanation_style: string;
  weak_prerequisite?: string;
  misconception_addressed: string;
  explanation_text: string;
  worked_example?: string;
  check_questions: QuestionStudentView[];
  suggested_readings: { chunk_id: number; document_name: string; page?: number; slide?: number; excerpt: string }[];
  status: string;
}

export interface PracticeProblem {
  id?: number;
  topic_id?: number;
  topic_name?: string;
  stem: string;
  difficulty: string;
  formula?: string;
  expression?: string;
  params?: Record<string, any>;
  answer?: number;
  unit?: string;
  worked_solution?: string;
  source_page?: number;
  source_slide?: number;
  source_doc?: string;
  source_citation?: SourceCitation;
}

class ApiService {

  private getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('adaptivelearn_token');
    }
    return null;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    };

    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      let errorMsg = `Error ${res.status}: ${res.statusText}`;
      try {
        const errorData = await res.json();
        errorMsg = errorData.detail || errorMsg;
      } catch (e) {
        // ignore
      }
      throw new Error(errorMsg);
    }

    return res.json();
  }

  // Auth
  async login(email: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(data: { email: string; password: string; full_name: string; role: string }): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getMe(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  // Courses
  async getCourses(): Promise<Course[]> {
    return this.request<Course[]>('/courses');
  }

  async getCourse(id: number): Promise<Course> {
    return this.request<Course>(`/courses/${id}`);
  }

  async getPrerequisites(courseId: number): Promise<PrerequisiteGraph> {
    return this.request<PrerequisiteGraph>(`/courses/${courseId}/prerequisites`);
  }

  // Documents
  async uploadDocument(courseId: number, file: File): Promise<DocumentItem> {
    const formData = new FormData();
    formData.append('course_id', courseId.toString());
    formData.append('file', file);
    return this.request<DocumentItem>('/documents/upload', {
      method: 'POST',
      body: formData,
    });
  }

  async getDocuments(courseId: number): Promise<DocumentItem[]> {
    return this.request<DocumentItem[]>(`/documents?course_id=${courseId}`);
  }

  async getDocumentPreview(params: { documentId: number; page?: number; slide?: number; timestamp?: number }): Promise<SourcePreview> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.slide) searchParams.append('slide', params.slide.toString());
    if (params.timestamp) searchParams.append('timestamp', params.timestamp.toString());
    return this.request<SourcePreview>(`/documents/${params.documentId}/preview?${searchParams.toString()}`);
  }

  // Tutor Chat
  async sendChatMessage(data: { course_id: number; message: string; conversation_id?: number; topic_id?: number }): Promise<ChatMessage> {
    return this.request<ChatMessage>('/chat', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getConversations(courseId: number): Promise<Conversation[]> {
    return this.request<Conversation[]>(`/chat/conversations?course_id=${courseId}`);
  }

  async getConversation(id: number): Promise<Conversation> {
    return this.request<Conversation>(`/chat/conversations/${id}`);
  }

  // Health check
  async getHealth(): Promise<{ status: string; app: string; version: string; llm: { provider: string; model: string; configured: boolean; reason: string } }> {
    return this.request<any>('/health');
  }

  // Quizzes & Assessments
  async startQuiz(data: { course_id: number; topic_ids?: number[]; question_types?: string[]; difficulty_mode?: string; question_count?: number; is_diagnostic?: boolean }): Promise<QuizSession> {
    return this.request<QuizSession>('/quizzes/start', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async submitQuizAnswer(data: { quiz_session_id: number; question_id: number; answer: string; response_time_sec?: number; confidence_level?: string }): Promise<QuizResponseResult> {
    return this.request<QuizResponseResult>('/quizzes/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async finishQuiz(sessionId: number): Promise<AssessmentReport> {
    return this.request<AssessmentReport>(`/quizzes/${sessionId}/finish`, {
      method: 'POST',
    });
  }

  async getAssessmentReport(sessionId: number): Promise<AssessmentReport> {
    return this.request<AssessmentReport>(`/quizzes/${sessionId}/report`);
  }

  // Understanding Overview
  async getUnderstanding(courseId?: number): Promise<UnderstandingOverview> {
    const url = courseId ? `/understanding?course_id=${courseId}` : '/understanding';
    return this.request<UnderstandingOverview>(url);
  }

  // Remediation Loop
  async startRemediation(topicId: number, roundNumber: number = 1): Promise<RemediationStartData> {
    return this.request<RemediationStartData>('/remediation/start', {
      method: 'POST',
      body: JSON.stringify({ topic_id: topicId, round_number: roundNumber }),
    });
  }

  async submitRemediation(sessionId: number, answers: { question_id: number; answer: string }[]): Promise<any> {
    return this.request<any>('/remediation/submit', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId, answers }),
    });
  }

  // Practice Problems
  async getTopicPracticeProblems(courseId: number, topicId: number): Promise<PracticeProblem[]> {
    return this.request<PracticeProblem[]>(`/courses/${courseId}/topics/${topicId}/practice-problems`);
  }

  // Analytics
  async getStudentDashboard(courseId?: number): Promise<StudentDashboardData> {
    const url = courseId ? `/analytics/student?course_id=${courseId}` : '/analytics/student';
    return this.request<StudentDashboardData>(url);
  }

  // Evaluation
  async runBenchmark(): Promise<any> {
    return this.request<any>('/evaluation/benchmark');
  }

  async runSimulation(): Promise<any> {
    return this.request<any>('/evaluation/simulation');
  }
}

export const api = new ApiService();

