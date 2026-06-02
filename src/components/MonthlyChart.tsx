import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { fmtCompact } from '@/lib/financial';

interface ChartData {
  month: string;
  receitas: number;
  despesas: number;
}

interface Props {
  data: ChartData[];
}

export default function MonthlyChart({ data }: Props) {
  if (data.every(d => d.receitas === 0 && d.despesas === 0)) {
    return (
      <div className="glass-card rounded-lg p-5 animate-fade-in">
        <h3 className="font-display font-semibold text-lg mb-3">Receitas vs Despesas</h3>
        <p className="text-sm text-muted-foreground">Adicione transações para ver o gráfico.</p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-lg p-5 animate-fade-in">
      <h3 className="font-display font-semibold text-lg mb-4">Receitas vs Despesas</h3>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2}>
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: 'hsl(215, 15%, 55%)' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'hsl(215, 15%, 55%)' }}
              tickFormatter={fmtCompact}
              width={52}
            />
            <Tooltip
              cursor={{ fill: 'hsl(220, 14%, 14%, 0.5)' }}
              contentStyle={{
                backgroundColor: 'hsl(220, 18%, 12%)',
                border: '1px solid hsl(220, 14%, 20%)',
                borderRadius: '8px',
                fontSize: '13px',
              }}
              formatter={(value: number, name: string) => [
                fmtCompact(value),
                name === 'receitas' ? 'Receitas' : 'Despesas',
              ]}
            />
            <Legend
              formatter={(value) => value === 'receitas' ? 'Receitas' : 'Despesas'}
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
            />
            <Bar dataKey="receitas" fill="hsl(152, 60%, 48%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="despesas" fill="hsl(0, 72%, 55%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
