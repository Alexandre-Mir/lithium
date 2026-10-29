import type { ReadingMilestone } from "@/types/database";

const TRAILING_PAGE_PATTERN =
  /^(.*?)(?:\s*(?:\.{2,}|…+|[-–—:])\s*|\s+)(?:p(?:á|a)?g(?:ina)?s?\.?\s*)?(\d+)\s*$/iu;

/** Extrai títulos e páginas iniciais de um sumário colado em linhas separadas. */
export function parseRawTocToMilestones(rawText: string): ReadingMilestone[] {
  const milestones: ReadingMilestone[] = [];

  for (const rawLine of rawText.split(/\r?\n/u)) {
    const line = rawLine.trim().replace(/^[•*▪◦\s]+/u, "");
    if (!line) continue;

    const match = TRAILING_PAGE_PATTERN.exec(line);
    if (!match) continue;

    const title = match[1]
      .trim()
      .replace(/[.·…\-–—:]+$/u, "")
      .trim();
    const page = Number(match[2]);
    if (!title || !/\p{L}/u.test(title) || !Number.isSafeInteger(page) || page < 1) {
      continue;
    }

    milestones.push({ title, page });
  }

  return milestones
    .map((milestone, index) => ({ milestone, index }))
    .sort((left, right) => left.milestone.page - right.milestone.page || left.index - right.index)
    .map(({ milestone }) => milestone);
}

/** Retorna o último marco cujo início já foi alcançado na página atual. */
export function getCurrentMilestone<T extends ReadingMilestone>(
  currentPage: number,
  milestones: readonly T[],
): T | null {
  if (!Number.isFinite(currentPage)) return null;

  let current: T | null = null;
  for (const milestone of milestones) {
    if (!Number.isFinite(milestone.page) || milestone.page > currentPage) continue;
    if (!current || milestone.page >= current.page) current = milestone;
  }

  return current;
}

/** Converte marcos absolutos do livro para o intervalo relativo de um trecho. */
export function milestonesForSegment<T extends ReadingMilestone>(
  milestones: readonly T[],
  segmentStartPage: number | null,
  targetPages: number,
): Array<T & { originalPage?: number }> {
  const ordered = milestones
    .filter((milestone) => Number.isInteger(milestone.page) && milestone.page > 0)
    .slice()
    .sort((left, right) => left.page - right.page);
  if (segmentStartPage === null) return ordered;
  if (!Number.isInteger(segmentStartPage) || segmentStartPage < 1) return [];

  const priorMilestones = ordered.filter((milestone) => milestone.page < segmentStartPage);
  const priorMilestone = priorMilestones[priorMilestones.length - 1];
  const inSegment = ordered.filter((milestone) =>
    milestone.page >= segmentStartPage &&
    milestone.page <= segmentStartPage + targetPages,
  );
  return [
    ...(priorMilestone ? [{ ...priorMilestone, page: 0, originalPage: priorMilestone.page }] : []),
    ...inSegment.map((milestone) => ({
      ...milestone,
      page: milestone.page - segmentStartPage,
      originalPage: milestone.page,
    })),
  ];
}
