"use client";

import { DayPicker, type DayPickerProps } from "react-day-picker";
import { ptBR } from "react-day-picker/locale";
import { cn } from "cn";
import { ChevronLeft, ChevronRight } from "lucide-react";

const flatCalendarClassNames: NonNullable<DayPickerProps["classNames"]> = {
  root: "w-fit border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900",
  months: "flex flex-col",
  month: "space-y-3",
  month_caption: "relative flex h-8 items-center justify-center",
  caption_label: "text-xs font-bold capitalize text-gray-900 dark:text-gray-100",
  nav: "flex items-center gap-1",
  button_previous: "absolute left-0 flex h-7 w-7 items-center justify-center border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800",
  button_next: "absolute right-0 flex h-7 w-7 items-center justify-center border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800",
  month_grid: "w-full border-collapse",
  weekdays: "flex",
  weekday: "w-9 text-center text-[10px] font-medium capitalize text-gray-500",
  week: "mt-1 flex w-full",
  day: "relative flex h-9 w-9 flex-1 items-center justify-center p-0 text-xs",
  day_button: "relative z-0 flex h-8 w-8 items-center justify-center border border-transparent text-xs text-gray-800 outline-none hover:border-gray-300 hover:bg-gray-50 focus-visible:border-indigo-500 dark:text-gray-200 dark:hover:border-gray-600 dark:hover:bg-gray-800",
  today: "font-bold text-indigo-700 dark:text-indigo-300",
  selected: "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900",
  outside: "text-gray-300 dark:text-gray-700",
  disabled: "text-gray-300 opacity-40 dark:text-gray-700",
  hidden: "invisible",
  chevron: "h-4 w-4",
};

export function Calendar({ className, classNames, ...props }: DayPickerProps) {
  return (
    <DayPicker
      locale={ptBR}
      className={cn("text-gray-900 dark:text-gray-100", className)}
      classNames={{ ...flatCalendarClassNames, ...classNames }}
      components={{
        Chevron: ({ orientation, className: iconClassName }) =>
          orientation === "left" ? (
            <ChevronLeft className={cn("h-4 w-4", iconClassName)} />
          ) : (
            <ChevronRight className={cn("h-4 w-4", iconClassName)} />
          ),
        ...props.components,
      }}
      {...props}
    />
  );
}
