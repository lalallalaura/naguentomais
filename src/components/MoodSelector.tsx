import { moods } from "../data";
import { MoodId } from "../types";

interface Props {
  selected: MoodId | null;
  onSelect: (mood: MoodId) => void;
}

export function MoodSelector({ selected, onSelect }: Props) {
  return (
    <div className="mood-grid">
      {moods.map((mood) => (
        <button
          key={mood.id}
          className={`mood-card ${selected === mood.id ? "selected" : ""}`}
          onClick={() => onSelect(mood.id)}
        >
          <span className="mood-emoji">{mood.emoji}</span>
          <strong>{mood.label}</strong>
          <small>{mood.description}</small>
        </button>
      ))}
    </div>
  );
}