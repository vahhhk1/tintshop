"use client";

import * as React from "react";
import { Accordion as A } from "radix-ui";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

/** FAQ accordion with keyboard support from Radix. */
export function FaqAccordion({ items, className }: { items: FaqItem[]; className?: string }) {
  return (
    <A.Root type="single" collapsible className={cn("divide-y divide-white/[0.07] rounded-2xl border border-white/[0.07] bg-card", className)}>
      {items.map((item) => (
        <A.Item key={item.id} value={item.id} className="group">
          <A.Header>
            <A.Trigger className="flex w-full items-center justify-between gap-6 px-5 py-5 text-left text-[15px] font-medium transition-colors hover:text-primary sm:px-6">
              {item.question}
              <span className="grid size-8 shrink-0 place-items-center rounded-full border border-white/10 transition-transform duration-300 group-data-[state=open]:rotate-45 group-data-[state=open]:border-primary/40 group-data-[state=open]:text-primary">
                <Plus className="size-4" aria-hidden />
              </span>
            </A.Trigger>
          </A.Header>
          <A.Content className="overflow-hidden text-[15px] leading-relaxed text-muted-foreground data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <div className="px-5 pb-6 sm:px-6 whitespace-pre-line">{item.answer}</div>
          </A.Content>
        </A.Item>
      ))}
    </A.Root>
  );
}
