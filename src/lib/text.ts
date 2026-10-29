const LOWERCASE_PARTICLES = new Set([
  "a", "as", "ao", "aos", "da", "das", "de", "do", "dos", "e", "em",
  "na", "nas", "no", "nos", "num", "numa", "o", "os", "ou", "para",
  "pela", "pelo", "por", "umas", "uns", "uma", "um", "com", "à", "às",
]);

const PRESERVED_ACRONYMS = new Set(["DOI", "ISBN"]);

export function toTitleCaseBR(text: string): string {
  return text.replace(/[\p{L}\p{M}\p{N}]+/gu, (word, offset: number) => {
    const upperWord = word.toLocaleUpperCase("pt-BR");
    if (PRESERVED_ACRONYMS.has(upperWord)) return upperWord;

    const lowerWord = word.toLocaleLowerCase("pt-BR");
    const hasPreviousWord = /[\p{L}\p{N}]/u.test(text.slice(0, offset));
    if (hasPreviousWord && LOWERCASE_PARTICLES.has(lowerWord)) return lowerWord;

    const [firstCharacter, ...remainingCharacters] = Array.from(lowerWord);
    return `${firstCharacter?.toLocaleUpperCase("pt-BR") ?? ""}${remainingCharacters.join("")}`;
  });
}
