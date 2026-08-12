"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = ["#1d4ed8", "#0f766e", "#c2410c", "#7c3aed", "#b45309", "#0369a1", "#be123c", "#365314"];

function moneyTick(v: number) {
  return `$${v.toLocaleString()}`;
}

export function MonthlySpendChart({ data }: { data: Array<{ month: string; total: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="month" fontSize={12} />
        <YAxis fontSize={12} tickFormatter={moneyTick} />
        <Tooltip formatter={(v) => moneyTick(Number(v))} />
        <Bar dataKey="total" name="Spend" fill="#1d4ed8" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function VehicleSpendChart({ data }: { data: Array<{ label: string; total: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" fontSize={12} tickFormatter={moneyTick} />
        <YAxis type="category" dataKey="label" fontSize={12} width={70} />
        <Tooltip formatter={(v) => moneyTick(Number(v))} />
        <Bar dataKey="total" name="Repair cost" fill="#0f766e" radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CategorySpendChart({
  data,
}: {
  data: Array<{ name: string; total: number; parts: number; labor: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" fontSize={11} interval={0} angle={-25} textAnchor="end" height={70} />
        <YAxis fontSize={12} tickFormatter={moneyTick} />
        <Tooltip formatter={(v) => moneyTick(Number(v))} />
        <Legend />
        <Bar dataKey="parts" name="Parts" stackId="a" fill="#1d4ed8" />
        <Bar dataKey="labor" name="Labor" stackId="a" fill="#0f766e" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PartsLaborPie({ data }: { data: Array<{ name: string; value: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => moneyTick(Number(v))} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function CategoryCountChart({ data }: { data: Array<{ name: string; count: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" fontSize={11} interval={0} angle={-25} textAnchor="end" height={70} />
        <YAxis allowDecimals={false} fontSize={12} />
        <Tooltip />
        <Bar dataKey="count" name="Repair lines" fill="#7c3aed" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MileageCostScatter({
  data,
}: {
  data: Array<{ label: string; mileage: number; cost: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ScatterChart>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="mileage" name="Mileage" fontSize={12} tickFormatter={(v) => Number(v).toLocaleString()} />
        <YAxis dataKey="cost" name="Cost" fontSize={12} tickFormatter={moneyTick} />
        <Tooltip
          formatter={(v, name) => (name === "cost" ? moneyTick(Number(v)) : Number(v).toLocaleString())}
          labelFormatter={(_, payload) => payload?.[0]?.payload?.label}
        />
        <Scatter data={data} fill="#c2410c" />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export function MileageLineChart({ data }: { data: Array<{ date: string; mileage: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" fontSize={12} />
        <YAxis fontSize={12} tickFormatter={(v) => Number(v).toLocaleString()} />
        <Tooltip formatter={(v) => Number(v).toLocaleString()} />
        <Line type="monotone" dataKey="mileage" stroke="#1d4ed8" strokeWidth={2} dot />
      </LineChart>
    </ResponsiveContainer>
  );
}
