"use client";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MetricPoint, TimeRange } from "@/lib/types";

export interface Series {
  key: keyof Omit<MetricPoint, "t">;
  label: string;
  color: string;
}

const fmtTime = (range: TimeRange) => (t: number) => {
  const d = new Date(t);
  return range === "7d" || range === "30d"
    ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
    : d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};

export function MetricChart({ data, series, range, unit = "%", height = 180 }: { data: MetricPoint[]; series: Series[]; range: TimeRange; unit?: string; height?: number }) {
  const tf = fmtTime(range);
  return (
    <div style={{ height }} className="w-full text-muted-foreground">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="t" tickFormatter={tf} tick={{ fontSize: 10, fill: "currentColor" }} tickLine={false} axisLine={false} minTickGap={40} />
          <YAxis tick={{ fontSize: 10, fill: "currentColor" }} tickLine={false} axisLine={false} domain={unit === "%" ? [0, 100] : ["auto", "auto"]} />
          <Tooltip
            contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
            labelFormatter={(v) => tf(Number(v))}
            formatter={(v, name) => [`${Number(v).toFixed(1)} ${unit}`, name]}
          />
          {series.map((s) => (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={1.5} fill={`url(#g-${s.key})`} isAnimationActive={false} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export const TIME_RANGES: TimeRange[] = ["1h", "6h", "24h", "7d", "30d"];

export function RangePicker({ value, onChange }: { value: TimeRange; onChange: (r: TimeRange) => void }) {
  return (
    <div className="inline-flex rounded-lg border bg-card p-0.5" role="radiogroup" aria-label="Time range">
      {TIME_RANGES.map((r) => (
        <button
          key={r}
          role="radio"
          aria-checked={value === r}
          onClick={() => onChange(r)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium uppercase transition-colors ${value === r ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          {r}
        </button>
      ))}
    </div>
  );
}
