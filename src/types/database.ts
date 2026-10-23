// ============================================================
// Lithium — Database Types (mirrors Supabase schema)
// ============================================================

export type ReadingType = "book" | "article";
export type ReviewStatus = "pending" | "done";

// ---- Row types ----

export interface Subject {
  id: string;
  name: string;
  is_autonomous: boolean;
  class_days: string[];
  theme_color: string;
  created_at: string;
  updated_at: string;
}

export interface Deliverable {
  id: string;
  subject_id: string;
  title: string;
  date: string; // DATE as ISO string
  created_at: string;
  updated_at: string;
}

export interface Reading {
  id: string;
  subject_id: string;
  title: string;
  author: string | null;
  type: ReadingType;
  isbn: string | null;
  full_book_pages: number | null;
  target_pages: number;
  read_full_book: boolean;
  deadline: string;
  is_read: boolean;
  current_speed_pph: number;
  created_at: string;
  updated_at: string;
}

export interface ReadingSession {
  id: string;
  reading_id: string;
  duration_minutes: number;
  pages_read: number;
  created_at: string;
}

export interface SpacedReview {
  id: string;
  reading_id: string;
  review_date: string;
  status: ReviewStatus;
  type: string;
  created_at: string;
}

// ---- Insert types (omit server-generated fields) ----

export type SubjectInsert = Omit<Subject, "id" | "created_at" | "updated_at">;
export type SubjectUpdate = Partial<SubjectInsert>;

export type DeliverableInsert = Omit<Deliverable, "id" | "created_at" | "updated_at">;
export type DeliverableUpdate = Partial<DeliverableInsert>;

export type ReadingInsert = Omit<Reading, "id" | "created_at" | "updated_at">;
export type ReadingUpdate = Partial<ReadingInsert>;

export type ReadingSessionInsert = Omit<ReadingSession, "id" | "created_at">;

export type SpacedReviewInsert = Omit<SpacedReview, "id" | "created_at">;
export type SpacedReviewUpdate = Partial<Pick<SpacedReview, "status">>;

// ---- Joined / view types ----

export interface ReadingWithSubject extends Reading {
  subject: Subject;
}

export interface SpacedReviewWithReading extends SpacedReview {
  reading: Reading & { subject: Subject };
}

// ---- Supabase generated Database type ----

export interface Database {
  public: {
    Tables: {
      subjects: {
        Row: Subject;
        Insert: Partial<Subject> & Pick<SubjectInsert, "name">;
        Update: Partial<Subject>;
        Relationships: [
          {
            foreignKeyName: "";
            columns: [];
            isOneToOne: false;
            referencedRelation: "";
            referencedColumns: [];
          }
        ];
      };
      deliverables: {
        Row: Deliverable;
        Insert: Partial<Deliverable> & Pick<DeliverableInsert, "subject_id" | "title" | "date">;
        Update: Partial<Deliverable>;
        Relationships: [
          {
            foreignKeyName: "deliverables_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          }
        ];
      };
      readings: {
        Row: Reading;
        Insert: Partial<Reading> & Pick<ReadingInsert, "subject_id" | "title" | "deadline">;
        Update: Partial<Reading>;
        Relationships: [
          {
            foreignKeyName: "readings_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          }
        ];
      };
      reading_sessions: {
        Row: ReadingSession;
        Insert: Partial<ReadingSession> & Pick<ReadingSessionInsert, "reading_id" | "duration_minutes" | "pages_read">;
        Update: Partial<ReadingSession>;
        Relationships: [
          {
            foreignKeyName: "reading_sessions_reading_id_fkey";
            columns: ["reading_id"];
            isOneToOne: false;
            referencedRelation: "readings";
            referencedColumns: ["id"];
          }
        ];
      };
      spaced_reviews: {
        Row: SpacedReview;
        Insert: Partial<SpacedReview> & Pick<SpacedReviewInsert, "reading_id" | "review_date">;
        Update: Partial<SpacedReview>;
        Relationships: [
          {
            foreignKeyName: "spaced_reviews_reading_id_fkey";
            columns: ["reading_id"];
            isOneToOne: false;
            referencedRelation: "readings";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      reading_type: ReadingType;
      review_status: ReviewStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
