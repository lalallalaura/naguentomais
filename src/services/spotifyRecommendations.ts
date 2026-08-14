import { moods } from "../data";
import { MoodId, Song, SpotifyTrack } from "../types";
import { fetchArtistsGenres, searchTracks, SpotifyApiError } from "./spotifyApi";
import { estimateProfile } from "./moodProfile";

const MOOD_QUERIES: Record<MoodId, string[]> = {
  energized: ["upbeat pop", "dance workout", "edm hits", "energetic pop rock", "power pop"],
  calm: ["acoustic chill", "ambient calm", "lo-fi chill", "soft piano", "downtempo"],
  romantic: ["romantic r&b", "love songs", "soul love songs", "acoustic love songs", "singer songwriter love"],
  light: ["feel good indie", "happy indie pop", "chill pop good vibes", "sunny day pop", "indie folk happy"],
};

const RESULTS_PER_QUERY = 10; // máximo permitido pelo /search desde fev/2026
const TARGET_COUNT = 12;
const MAX_PER_ARTIST = 2;

function distance(a: number, b: number) {
  return Math.abs(a - b);
}

function normalizeKey(track: SpotifyTrack): string {
  return `${track.title.toLowerCase().trim()}|${track.artist.toLowerCase().trim()}`;
}

async function collectCandidates(moodId: MoodId, offset: number): Promise<SpotifyTrack[]> {
  const queries = MOOD_QUERIES[moodId];

  const settled = await Promise.allSettled(
    queries.map((q) => searchTracks(q, RESULTS_PER_QUERY, offset))
  );

  const seen = new Set<string>();
  const candidates: SpotifyTrack[] = [];
  let firstError: unknown = null;

  for (const outcome of settled) {
    if (outcome.status === "rejected") {
      firstError = firstError ?? outcome.reason;
      continue;
    }
    for (const track of outcome.value) {
      const key = normalizeKey(track);
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push(track);
    }
  }

  const allFailed = settled.every((s) => s.status === "rejected");
  if (allFailed && firstError) {
    throw firstError;
  }

  return candidates;
}

export async function recommendSongsFromSpotify(
  moodId: MoodId,
  options?: { excludeIds?: string[]; count?: number }
): Promise<{ songs: Song[]; score: number }> {
  const mood = moods.find((m) => m.id === moodId)!;
  const excludeIds = new Set(options?.excludeIds ?? []);
  const targetCount = options?.count ?? TARGET_COUNT;

  const baseOffset = excludeIds.size > 0 ? Math.floor(Math.random() * 30) : 0;

  const extraOffsets =
    targetCount <= 12 ? [] : targetCount <= 24 ? [baseOffset + 10] : [baseOffset + 10, baseOffset + 20];

  const batches = await Promise.all(
    [baseOffset, ...extraOffsets].map((offset) => collectCandidates(moodId, offset))
  );

  const seenIds = new Set<string>();
  let candidates: SpotifyTrack[] = [];
  for (const batch of batches) {
    for (const track of batch) {
      if (excludeIds.has(track.id) || seenIds.has(track.id)) continue;
      seenIds.add(track.id);
      candidates.push(track);
    }
  }

  if (candidates.length < targetCount && baseOffset !== 0) {
    const fallbackBatch = (await collectCandidates(moodId, 0)).filter(
      (t) => !excludeIds.has(t.id) && !seenIds.has(t.id)
    );
    for (const track of fallbackBatch) {
      candidates.push(track);
      seenIds.add(track.id);
    }
  }

  if (candidates.length === 0) {
    throw new SpotifyApiError(
      "no-tracks",
      excludeIds.size > 0
        ? "Não encontramos músicas novas para esse clima agora. Tente de novo em instantes."
        : "Não encontramos músicas no Spotify para esse clima agora."
    );
  }

  const artistIds = candidates.flatMap((t) => t.artistIds);
  const genresByArtist = await fetchArtistsGenres(artistIds).catch(() => ({} as Record<string, string[]>));

  const scored = candidates.map((track) => {
    const genres = track.artistIds.flatMap((id) => genresByArtist[id] ?? []);
    const profile = estimateProfile(genres, { energy: mood.energy, valence: mood.valence });

    const energyFit = 1 - distance(profile.energy, mood.energy);
    const valenceFit = 1 - distance(profile.valence, mood.valence);
    const bpmTarget =
      moodId === "energized" ? 120 : moodId === "calm" ? 80 : moodId === "romantic" ? 95 : 100;
    const bpmFit = 1 - Math.min(distance(profile.bpm, bpmTarget) / 100, 1);

    const score = energyFit * 0.45 + valenceFit * 0.4 + bpmFit * 0.15;

    const song: Song = {
      id: track.id,
      title: track.title,
      artist: track.artist,
      cover: track.cover,
      bpm: profile.bpm,
      energy: profile.energy,
      valence: profile.valence,
      moods: [moodId],
      spotifyUrl: track.spotifyUrl,
      estimated: true,
    };

    return { song, score, primaryArtistId: track.artistIds[0] ?? track.artist };
  });

  scored.sort((a, b) => b.score - a.score);

  const maxPerArtist = Math.max(MAX_PER_ARTIST, Math.ceil(targetCount / 6));

  const artistCount = new Map<string, number>();
  const selected: { song: Song; score: number }[] = [];

  for (const item of scored) {
    if (selected.length >= targetCount) break;
    const count = artistCount.get(item.primaryArtistId) ?? 0;
    if (count >= maxPerArtist) continue;
    artistCount.set(item.primaryArtistId, count + 1);
    selected.push(item);
  }

  if (selected.length < targetCount) {
    const selectedIds = new Set(selected.map((s) => s.song.id));
    for (const item of scored) {
      if (selected.length >= targetCount) break;
      if (selectedIds.has(item.song.id)) continue;
      selected.push(item);
      selectedIds.add(item.song.id);
    }
  }

  const avgScore =
    selected.reduce((total, item) => total + item.score, 0) / Math.max(selected.length, 1);

  return {
    songs: selected.map((item) => item.song),
    score: Math.round(Math.min(Math.max(avgScore * 100, 30), 99)),
  };
}