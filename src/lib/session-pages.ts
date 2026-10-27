export interface SessionPageRecord {
  id: string;
  pages_read: number;
  started_at: string | null;
  created_at: string;
}

export function pagesReadFromEndPage(
  currentPage: number,
  endPage: number,
  totalPages: number | null,
): number | null {
  if (!Number.isInteger(currentPage) || currentPage < 0) return null;
  if (!Number.isInteger(endPage) || endPage <= currentPage) return null;
  if (totalPages !== null && (!Number.isInteger(totalPages) || totalPages < 1 || endPage > totalPages)) return null;
  return endPage - currentPage;
}

function sessionStartTime(session: SessionPageRecord): number {
  const timestamp = Date.parse(session.started_at ?? session.created_at);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function pagesBeforeSession(
  sessions: readonly SessionPageRecord[],
  sessionId: string,
): number {
  const chronological = [...sessions].sort((left, right) =>
    sessionStartTime(left) - sessionStartTime(right) ||
    Date.parse(left.created_at) - Date.parse(right.created_at) ||
    left.id.localeCompare(right.id),
  );
  let pagesRead = 0;

  for (const session of chronological) {
    if (session.id === sessionId) return pagesRead;
    pagesRead += Math.max(0, Number(session.pages_read) || 0);
  }

  return 0;
}
