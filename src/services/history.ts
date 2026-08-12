import { MoodId } from "../types";

export interface HistoryItem {
  id: string;
  mood: MoodId;
  createdAt: string;
}

const KEY = "harmoody_history";

export function getHistory(): HistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveHistory(mood: MoodId) {
  const history = getHistory();
  history.unshift({
    id: crypto.randomUUID(),
    mood,
    createdAt: new Date().toISOString(),
  });
  localStorage.setItem(KEY, JSON.stringify(history.slice(0, 30)));
}