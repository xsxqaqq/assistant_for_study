export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  relevant_chunks?: string[];
}

export interface Document {
  id: string;
  filename: string;
  upload_time: string;
  status: string;
  chunk_count: number;
}

export interface DocumentListResponse {
  documents: Document[];
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
