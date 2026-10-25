// ============================================================
// Lithium — Database Types (mirrors Supabase schema v1.4)
// ============================================================

export type ReadingType = "book" | "article";
export type ReviewStatus = "pending" | "done";

// ---- Row types ----

export interface Subject {
  id: string;
  name: string;
  professor: string;
  syllabus: string | null;
  objectives: string | null;
  methodology: string | null;
  assessment: string | null;
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
  chapter_title: string | null;
  author: string | null;
  type: ReadingType;
  isbn: string | null;
  doi: string | null;
  full_book_pages: number | null;
  target_pages: number;
  read_full_book: boolean;
  deadline: string;
  is_read: boolean;
  current_speed_pph: number;
  cover_url: string | null;
  publisher: string | null;
  published_year: number | null;
  metadata_source: string | null;
  metadata_fetched_at: string | null;
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

export interface ReadingSpeedStat {
  reading_type: ReadingType;
  sessions: number;
  total_pages: number;
  total_minutes: number;
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

export type ReadingInsert = Omit<
  Reading,
  | "id"
  | "created_at"
  | "updated_at"
  | "current_speed_pph"
  | "cover_url"
  | "publisher"
  | "published_year"
  | "metadata_source"
  | "metadata_fetched_at"
> &
  Partial<
    Pick<
      Reading,
      | "current_speed_pph"
      | "cover_url"
      | "publisher"
      | "published_year"
      | "metadata_source"
      | "metadata_fetched_at"
    >
  >;
export type ReadingUpdate = Partial<ReadingInsert>;

export type ReadingSessionInsert = Omit<ReadingSession, "id" | "created_at">;

export type SpacedReviewInsert = Omit<SpacedReview, "id" | "created_at">;
export type SpacedReviewUpdate = Partial<Pick<SpacedReview, "status">>;

// ---- Joined / view types ----

export type ReadingWithProgress = Reading & { pages_read: number };

export interface ReadingWithSubject extends Reading {
  subject: Subject;
  pages_read: number;
}

export interface SpacedReviewWithReading extends SpacedReview {
  reading: ReadingWithSubject;
}

export interface ReadingSessionWithReading extends ReadingSession {
  reading: {
    title: string;
    chapter_title: string | null;
    author: string | null;
    type: ReadingType;
    subject: {
      name: string;
      theme_color: string;
    };
  };
}

export interface SubjectStat {
  id: string;
  name: string;
  professor: string;
  theme_color: string;
  is_autonomous: boolean;
  totalReadings: number;
  completedReadings: number;
  progressPercent: number;
  totalMinutes: number;
  totalPages: number;
}
