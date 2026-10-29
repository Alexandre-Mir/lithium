import {
  buildHeatmapWeekGrid,
  heatmapDayLabel,
  type ConsistencyHeatmapModel,
  type HeatmapLevel,
} from "@/lib/consistency-heatmap";
import { formatDateBR } from "@/lib/dates";

const WEEKDAY_LABELS = ["S", "T", "Q", "Q", "S", "S", "D"] as const;

const LEVEL_CLASS: Record<HeatmapLevel, string> = {
  0: "bg-gray-100 dark:bg-gray-800",
  1: "bg-gray-300 dark:bg-gray-600",
  2: "bg-gray-500 dark:bg-gray-500",
  3: "bg-gray-700 dark:bg-gray-400",
  4: "bg-gray-900 dark:bg-gray-200",
};

interface ConsistencyHeatmapProps {
  model: ConsistencyHeatmapModel;
}

export function ConsistencyHeatmap({ model }: ConsistencyHeatmapProps) {
  const weeks = buildHeatmapWeekGrid(model.days);
  const activeLabel = model.activeDays === 1
    ? "1 dia ativo"
    : `${model.activeDays} dias ativos`;

  return (
    <section className="rounded-md border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-700 dark:text-gray-200">
            Consistência — últimos 28 dias
          </h2>
          <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
            {formatDateBR(model.windowStart, { day: "2-digit", month: "2-digit" })}
            {" – "}
            {formatDateBR(model.windowEnd, { day: "2-digit", month: "2-digit" })}
            {" · "}
            {activeLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
          <span>Menos</span>
          {([0, 1, 2, 3, 4] as const).map((level) => (
            <span
              key={level}
              className={`inline-block h-2.5 w-2.5 rounded-sm ${LEVEL_CLASS[level]}`}
              aria-hidden
            />
          ))}
          <span>Mais</span>
        </div>
      </div>

      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2">
        <div className="flex flex-col gap-1 text-[9px] font-medium text-gray-400" aria-hidden>
          {WEEKDAY_LABELS.map((label, index) => (
            <span key={`${label}-${index}`} className="flex h-2.5 w-2 items-center leading-none">
              {index % 2 === 1 ? label : "\u00a0"}
            </span>
          ))}
        </div>

        <div
          className="flex gap-1"
          role="img"
          aria-label={`Mapa de consistência: ${activeLabel} nos últimos 28 dias`}
        >
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-1">
              {week.map((day, dayIndex) => (
                day ? (
                  <span
                    key={day.date}
                    title={heatmapDayLabel(day)}
                    className={`h-2.5 w-2.5 rounded-sm ${LEVEL_CLASS[day.level]}`}
                  />
                ) : (
                  <span
                    key={`pad-${weekIndex}-${dayIndex}`}
                    className="h-2.5 w-2.5 rounded-sm bg-transparent"
                    aria-hidden
                  />
                )
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
