import { describe, expect, it } from "vitest";
import { coverUrlHiRes } from "@/lib/cover-url";

describe("coverUrlHiRes", () => {
  it("aumenta o zoom das capas do Google Books", () => {
    expect(coverUrlHiRes("https://books.google.com/books/content?id=abc&zoom=1"))
      .toBe("https://books.google.com/books/content?id=abc&zoom=2");
  });

  it("prefere a imagem grande da Open Library", () => {
    expect(coverUrlHiRes("https://covers.openlibrary.org/b/id/123-M.jpg"))
      .toBe("https://covers.openlibrary.org/b/id/123-L.jpg");
    expect(coverUrlHiRes("https://covers.openlibrary.org/b/id/123-S.jpg"))
      .toBe("https://covers.openlibrary.org/b/id/123-L.jpg");
  });

  it("preserva URLs desconhecidas", () => {
    expect(coverUrlHiRes("https://cdn.example.com/book.png?size=small"))
      .toBe("https://cdn.example.com/book.png?size=small");
  });

  it("força HTTPS e remove edge=curl", () => {
    expect(coverUrlHiRes("http://cdn.example.com/book.jpg?zoom=1&edge=curl"))
      .toBe("https://cdn.example.com/book.jpg?zoom=1");
  });

  it("mantém capa ausente como null", () => {
    expect(coverUrlHiRes(null)).toBeNull();
  });
});
