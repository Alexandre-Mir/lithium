interface ReadingUpdateFields {
  title?: unknown;
  target_pages?: unknown;
  deadline?: unknown;
}

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

  if (input.deadline !== undefined && input.deadline !== null && !isValidDateISO(input.deadline)) {
    return "Informe um prazo válido no formato AAAA-MM-DD.";
  }

  return null;
}
