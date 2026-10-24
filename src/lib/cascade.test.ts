import { describe, expect, it } from "vitest";
import { findLinkedDeliverable } from "@/lib/cascade";

interface TestDeliverable {
  id: string;
  date: string;
}

const deliveries: TestDeliverable[] = [
  { id: "first", date: "2026-10-10" },
  { id: "second", date: "2026-10-20" },
];

describe("findLinkedDeliverable", () => {
  it("retorna null com a lista vazia", () => {
    expect(findLinkedDeliverable([], "2026-10-15")).toBeNull();
  });

  it("retorna null quando o prazo vem antes da primeira entrega", () => {
    expect(findLinkedDeliverable(deliveries, "2026-10-09")).toBeNull();
  });

  it("vincula o prazo à entrega seguinte quando está entre duas datas", () => {
    expect(findLinkedDeliverable(deliveries, "2026-10-15")?.id).toBe("second");
  });

  it("inclui o dia da entrega no intervalo correspondente", () => {
    expect(findLinkedDeliverable(deliveries, "2026-10-20")?.id).toBe("second");
  });

  it("retorna null quando o prazo vem depois da última entrega", () => {
    expect(findLinkedDeliverable(deliveries, "2026-10-21")).toBeNull();
  });

  it("escolhe a primeira entrega quando duas têm a mesma data", () => {
    const sameDay = [
      { id: "first-on-day", date: "2026-10-10" },
      { id: "second-on-day", date: "2026-10-10" },
    ];

    expect(findLinkedDeliverable(sameDay, "2026-10-10")?.id).toBe("first-on-day");
  });
});
