export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  relevant_chunks?: string[];
  rag_response?: RAGQueryResponse;
}

export interface Document {
  id: string;
  filename: string;
  original_filename: string;
  custom_filename?: string;
  upload_time: string;
  status: string;
  chunk_count: number;
}

export interface AdminDocument extends Document {
  user_id: number;
  username: string;
  email: string;
}

export interface DocumentListResponse {
  documents: Document[];
}

export interface AdminDocumentListResponse {
  documents: AdminDocument[];
  status_code: number;
  message: string;
}

export interface DocumentUploadResponse {
  document_id: string;
  status: string;
  message: string;
}

export interface RAGQueryRequest {
  question: string;
  top_k?: number;
}

export interface RAGQueryResponse {
  answer: string;
  relevant_chunks: string[];
  status_code: number;
  message: string;
  vector_info?: Record<string, number[]>;
}

export interface TaskStatusResponse {
  status: string;
  document_id: string;
  filename: string;
}
