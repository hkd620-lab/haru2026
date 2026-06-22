import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, getFirestore } from "firebase/firestore";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type GrowthMetric = "height" | "weight";

type GrowthPoint = {
  date: string;
  height?: number;
  weight?: number;
};

interface GrowthChartProps {
  userId?: string;
}

const toPositiveNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export function GrowthChart({ userId }: GrowthChartProps) {
  const [data, setData] = useState<GrowthPoint[]>([]);
  const [metric, setMetric] = useState<GrowthMetric>("height");

  useEffect(() => {
    if (!userId) {
      setData([]);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const db = getFirestore();
        const recordsRef = collection(db, "users", userId, "records");
        const snap = await getDocs(recordsRef);
        const points: GrowthPoint[] = [];

        snap.forEach((docSnap) => {
          const record = docSnap.data() as Record<string, unknown>;
          const date = String(record.child_measuredate || record.date || "").slice(0, 10);
          const height = toPositiveNumber(record.child_height);
          const weight = toPositiveNumber(record.child_weight);
          if (!date || (height === null && weight === null)) return;
          points.push({
            date,
            ...(height !== null ? { height } : {}),
            ...(weight !== null ? { weight } : {}),
          });
        });

        if (!cancelled) {
          setData(points.sort((a, b) => a.date.localeCompare(b.date)));
        }
      } catch (error) {
        console.warn("육아 성장 그래프 데이터 로드 실패:", error);
        if (!cancelled) setData([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const heightCount = data.filter((point) => typeof point.height === "number").length;
  const weightCount = data.filter((point) => typeof point.weight === "number").length;
  const resolvedMetric: GrowthMetric = metric === "height" && heightCount >= 2
    ? "height"
    : metric === "weight" && weightCount >= 2
      ? "weight"
      : heightCount >= 2
        ? "height"
        : "weight";
  const chartData = useMemo(
    () => data.filter((point) => typeof point[resolvedMetric] === "number"),
    [data, resolvedMetric],
);
  const hasEnoughData = heightCount >= 2 || weightCount >= 2;

  if (!hasEnoughData) {
    return (
      <div style={{ padding: 12, borderRadius: 8, backgroundColor: "#fff", border: "1px dashed #a7f3d0", color: "#047857", fontSize: 13, lineHeight: 1.5 }}>
        기록이 2개 이상 쌓이면 그래프가 나타납니다
      </div>
    );
  }

  return (
    <div style={{ padding: 12, borderRadius: 8, backgroundColor: "#fff", border: "1px solid #a7f3d0" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {(["height", "weight"] as GrowthMetric[]).map((nextMetric) => (
          <button
            key={nextMetric}
            type="button"
            onClick={() => setMetric(nextMetric)}
            disabled={nextMetric === "height" ? heightCount < 2 : weightCount < 2}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: resolvedMetric === nextMetric ? "1px solid #10b981" : "1px solid #d1d5db",
              backgroundColor: resolvedMetric === nextMetric ? "#ecfdf5" : "#fff",
              color: resolvedMetric === nextMetric ? "#047857" : "#374151",
              fontWeight: 700,
              cursor: nextMetric === "height" ? (heightCount >= 2 ? "pointer" : "not-allowed") : (weightCount >= 2 ? "pointer" : "not-allowed"),
              opacity: nextMetric === "height" ? (heightCount >= 2 ? 1 : 0.45) : (weightCount >= 2 ? 1 : 0.45),
            }}
          >
            {nextMetric === "height" ? "키" : "몸무게"}
          </button>
        ))}
      </div>
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d1fae5" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} width={38} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey={resolvedMetric}
              stroke="#10b981"
              strokeWidth={3}
              dot={{ r: 3 }}
              name={resolvedMetric === "height" ? "키(cm)" : "몸무게(kg)"}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
