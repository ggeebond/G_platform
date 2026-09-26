import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import type { MetricStat } from '../../lib/types';

interface MetricChartProps {
  stats: MetricStat[];
  baselineLabel: string;
  treatmentLabel: string;
}

/** baseline vs treatment 对照柱状图（含 ±1 std 误差棒） */
export function MetricChart({ stats, baselineLabel, treatmentLabel }: MetricChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    chartRef.current = echarts.init(ref.current, undefined, { renderer: 'canvas' });
    return () => {
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || stats.length === 0) return;

    const categories: string[] = [];
    const values: number[] = [];
    const colors: string[] = [];
    const errData: Array<[number, number, number]> = [];

    stats.forEach((s) => {
      categories.push(`${s.metric}\n${baselineLabel}`);
      values.push(s.baseline.mean);
      colors.push('#9C7A58');
      errData.push([categories.length - 1, s.baseline.mean, s.baseline.std]);

      categories.push(`${s.metric}\n${treatmentLabel}`);
      values.push(s.treatment.mean);
      colors.push('#73DDF7');
      errData.push([categories.length - 1, s.treatment.mean, s.treatment.std]);
    });

    chart.setOption(
      {
        backgroundColor: 'transparent',
        grid: { left: 56, right: 18, top: 24, bottom: 56 },
        tooltip: {
          trigger: 'axis',
          backgroundColor: 'rgba(11,59,46,0.95)',
          borderColor: 'rgba(121,222,248,0.28)',
          textStyle: { color: '#EAF6F1', fontSize: 12 },
        },
        xAxis: {
          type: 'category',
          data: categories,
          axisLine: { lineStyle: { color: 'rgba(134,239,172,0.28)' } },
          axisLabel: { color: '#9BB6AA', fontSize: 10, interval: 0, lineHeight: 13 },
        },
        yAxis: {
          type: 'value',
          axisLine: { lineStyle: { color: 'rgba(134,239,172,0.28)' } },
          axisLabel: { color: '#9BB6AA', fontSize: 10 },
          splitLine: { lineStyle: { color: 'rgba(134,239,172,0.10)' } },
        },
        series: [
          {
            type: 'bar',
            data: values.map((v, i) => ({
              value: v,
              itemStyle: { color: colors[i], borderRadius: [4, 4, 0, 0] },
            })),
            barWidth: '46%',
          },
          {
            type: 'custom',
            data: errData,
            z: 10,
            renderItem: (params: any, api: any) => {
              const cat = api.value(0);
              const mean = api.value(1);
              const std = api.value(2);
              if (!Number.isFinite(std) || std === 0) return null;
              const lo = api.coord([cat, mean - std]);
              const hi = api.coord([cat, mean + std]);
              const w = api.size([1, 0])[0] * 0.1;
              const style = { stroke: '#EAF6F1', lineWidth: 1.3, opacity: 0.72 };
              return {
                type: 'group',
                children: [
                  { type: 'line', shape: { x1: lo[0], y1: lo[1], x2: hi[0], y2: hi[1] }, style },
                  { type: 'line', shape: { x1: lo[0] - w, y1: hi[1], x2: lo[0] + w, y2: hi[1] }, style },
                  { type: 'line', shape: { x1: lo[0] - w, y1: lo[1], x2: lo[0] + w, y2: lo[1] }, style },
                ],
              };
            },
          },
        ],
      },
      true,
    );
  }, [stats, baselineLabel, treatmentLabel]);

  return <div ref={ref} style={{ width: '100%', height: 260 }} />;
}
