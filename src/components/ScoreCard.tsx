import { HeartPulse } from "lucide-react";

export function ScoreCard({ score }: { score: number }) {
  return (
    <div className="score-card">
      <div className="score-icon"><HeartPulse size={22} /></div>
      <div>
        <span className="eyebrow">Compatibilidade emocional</span>
        <strong>{score}%</strong>
        <p>As músicas combinam com a experiência que você escolheu.</p>
      </div>
    </div>
  );
}