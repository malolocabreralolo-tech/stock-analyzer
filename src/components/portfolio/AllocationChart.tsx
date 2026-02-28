'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface AllocationChartProps {
  sectorBreakdown: Record<string, number>;
}

const COLORS = [
  '#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
  '#84cc16', '#e11d48',
];

export default function AllocationChart({ sectorBreakdown }: AllocationChartProps) {
  const data = Object.entries(sectorBreakdown)
    .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(1)) }))
    .sort((a, b) => b.value - a.value);

  if (data.length === 0) {
    return <div className="h-[300px] flex items-center justify-center text-muted-foreground">No allocation data</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={350}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={120}
          paddingAngle={2}
          dataKey="value"
          label={({ name, value }) => `${name}: ${value}%`}
          labelLine={true}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => [`${value}%`, 'Weight']} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
