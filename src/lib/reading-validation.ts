interface ReadingUpdateFields {
  title?: unknown;
  target_pages?: unknown;
  segment_start_page?: unknown;
  deadline?: unknown;
  milestones?: unknown;
}

export interface ReadingCreateFields {
  title: unknown;
  subject_id: unknown;
  target_pages: unknown;
  full_book_pages?: unknown;
  segment_start_page?: unknown;
  deadline?: unknown;
  hasDeadline?: boolean;
}

export type ReadingCreateFieldErrors = Partial<
  Record<"title" | "subject_id" | "target_pages" | "full_book_pages" | "segment_start_page" | "deadline", string>
>;

function isValidDateISO(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;

  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysPerMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysPerMonth[month - 1];
}

export function validateReadingUpdate(input: ReadingUpdateFields): string | null {
  if (input.title !== undefined && (typeof input.title !== "string" || !input.title.trim())) {
    return "O título da leitura é obrigatório.";
  }

  if (
    input.target_pages !== undefined &&
    (typeof input.target_pages !== "number" || !Number.isInteger(input.target_pages) || input.target_pages < 1)
  ) {
    return "A meta deve ser um número inteiro de pelo menos 1 página.";
  }

  if (
    input.segment_start_page !== undefined &&
    input.segment_start_page !== null &&
    (typeof input.segment_start_page !== "number" ||
      !Number.isInteger(input.segment_start_page) ||
      input.segment_start_page < 1)
  ) {
    return "A página inicial do trecho deve ser um número inteiro positivo ou ficar vazia.";
  }

  if (input.deadline !== undefined && input.deadline !== null && !isValidDateISO(input.deadline)) {
    return "Informe um prazo válido no formato AAAA-MM-DD.";
  }

  if (input.milestones !== undefined) {
    if (!Array.isArray(input.milestones)) {
      return "Os marcos da leitura são inválidos.";
    }

    for (const milestone of input.milestones as unknown[]) {
      if (typeof milestone !== "object" || milestone === null || Array.isArray(milestone)) {
        return "Os marcos da leitura são inválidos.";
      }
      const fields = milestone as Record<string, unknown>;
      if (
        typeof fields.title !== "string" ||
        !fields.title.trim() ||
        typeof fields.page !== "number" ||
        !Number.isInteger(fields.page) ||
        fields.page < 1 ||
        (fields.completed !== undefined && typeof fields.completed !== "boolean")
      ) {
        return "Cada marco precisa ter um título e uma página válida.";
      }
    }
  }

  return null;
}

export function getReadingCreateErrors(input: ReadingCreateFields): ReadingCreateFieldErrors {
  const errors: ReadingCreateFieldErrors = {};

  if (typeof input.title !== "string" || !input.title.trim()) {
    errors.title = "Informe o título da leitura.";
  }

  if (typeof input.subject_id !== "string" || !input.subject_id.trim()) {
    errors.subject_id = "Escolha uma disciplina.";
  }

  if (
    typeof input.target_pages !== "number" ||
    !Number.isInteger(input.target_pages) ||
    input.target_pages < 1
  ) {
    errors.target_pages = "Informe um número inteiro de páginas (mínimo: 1).";
  }

  if (
    input.full_book_pages !== undefined &&
    input.full_book_pages !== null &&
    input.full_book_pages !== "" &&
    (typeof input.full_book_pages !== "number" ||
      !Number.isInteger(input.full_book_pages) ||
      input.full_book_pages < 1)
  ) {
    errors.full_book_pages = "O total do livro deve ser um número inteiro de pelo menos 1 página.";
  }

  if (
    input.segment_start_page !== undefined &&
    input.segment_start_page !== null &&
    input.segment_start_page !== "" &&
    (typeof input.segment_start_page !== "number" ||
      !Number.isInteger(input.segment_start_page) ||
      input.segment_start_page < 1)
  ) {
    errors.segment_start_page = "A página inicial do trecho deve ser um número inteiro positivo.";
  }

  if (input.hasDeadline && (typeof input.deadline !== "string" || !isValidDateISO(input.deadline))) {
    errors.deadline = "Informe uma data válida para o prazo.";
  }

  return errors;
}
