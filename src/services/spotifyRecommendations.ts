import { moods } from "../data";
import { MoodId, Song, SpotifyTrack } from "../types";
import {
  fetchArtistsGenres,
  searchTracks,
  SpotifyApiError,
} from "./spotifyApi";
import { estimateProfile } from "./moodProfile";

const MOOD_QUERIES: Record<MoodId, string[]> = {
  energized: [
    "upbeat pop",
    "dance workout",
    "edm hits",
    "energetic pop rock",
    "power pop",
    "dance pop",
    "party hits",
    "high energy pop",
    "feel good dance",
    "summer party hits",
  ],

  calm: [
    "acoustic chill",
    "ambient calm",
    "lo-fi chill",
    "soft piano",
    "downtempo",
    "chill acoustic",
    "relaxing indie",
    "dreamy chill",
    "peaceful music",
    "soft indie",
  ],

  romantic: [
    "romantic r&b",
    "love songs",
    "soul love songs",
    "acoustic love songs",
    "singer songwriter love",
    "romantic pop",
    "slow love songs",
    "romantic indie",
    "love ballads",
    "romantic soul",
  ],

  light: [
    "feel good indie",
    "happy indie pop",
    "chill pop good vibes",
    "sunny day pop",
    "indie folk happy",
    "feel good songs",
    "positive indie",
    "happy acoustic",
    "good vibes pop",
    "light indie",
  ],
};

const RESULTS_PER_QUERY = 10;
const TARGET_COUNT = 12;
const MAX_PER_ARTIST = 2;

function distance(a: number, b: number) {
  return Math.abs(a - b);
}

function normalizeKey(track: SpotifyTrack): string {
  return `${track.title.toLowerCase().trim()}|${track.artist
    .toLowerCase()
    .trim()}`;
}

async function collectCandidates(
  moodId: MoodId,
  excludeTrackIds: string[] = []
): Promise<SpotifyTrack[]> {
  const queries = MOOD_QUERIES[moodId];

  const settled = await Promise.allSettled(
    queries.map((q) => searchTracks(q, RESULTS_PER_QUERY))
  );

  const excluded = new Set(excludeTrackIds);

  const seen = new Set<string>();
  const candidates: SpotifyTrack[] = [];

  let firstError: unknown = null;

  for (const outcome of settled) {
    if (outcome.status === "rejected") {
      firstError = firstError ?? outcome.reason;
      continue;
    }

    for (const track of outcome.value) {
      // Nunca trazer uma música que já apareceu anteriormente.
      if (excluded.has(String(track.id))) {
        continue;
      }

      const key = normalizeKey(track);

      // Evita duplicação dentro da própria busca.
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      candidates.push(track);
    }
  }

  const allFailed = settled.every(
    (result) => result.status === "rejected"
  );

  if (allFailed && firstError) {
    throw firstError;
  }

  return candidates;
}

export async function recommendSongsFromSpotify(
  moodId: MoodId,
  excludeTrackIds: string[] = []
): Promise<{ songs: Song[]; score: number }> {
  const mood = moods.find((m) => m.id === moodId)!;

  const candidates = await collectCandidates(
    moodId,
    excludeTrackIds
  );

  if (candidates.length === 0) {
    throw new SpotifyApiError(
      "no-tracks",
      "Não encontramos mais músicas inéditas para esse clima agora."
    );
  }

  const artistIds = candidates.flatMap((track) => track.artistIds);

  const genresByArtist = await fetchArtistsGenres(artistIds).catch(
    () => ({} as Record<string, string[]>)
  );

  const scored = candidates.map((track) => {
    const genres = track.artistIds.flatMap(
      (id) => genresByArtist[id] ?? []
    );

    const profile = estimateProfile(genres, {
      energy: mood.energy,
      valence: mood.valence,
    });

    const energyFit =
      1 - distance(profile.energy, mood.energy);

    const valenceFit =
      1 - distance(profile.valence, mood.valence);

    const bpmTarget =
      moodId === "energized"
        ? 120
        : moodId === "calm"
          ? 80
          : moodId === "romantic"
            ? 95
            : 100;

    const bpmFit =
      1 - Math.min(
        distance(profile.bpm, bpmTarget) / 100,
        1
      );

    const score =
      energyFit * 0.45 +
      valenceFit * 0.4 +
      bpmFit * 0.15;

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

    return {
      song,
      score,
      primaryArtistId:
        track.artistIds[0] ?? track.artist,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  // Limita a quantidade de músicas por artista
  // para aumentar a variedade.
  const artistCount = new Map<string, number>();
  const selected: Song[] = [];

  for (const item of scored) {
    if (selected.length >= TARGET_COUNT) {
      break;
    }

    const count =
      artistCount.get(item.primaryArtistId) ?? 0;

    if (count >= MAX_PER_ARTIST) {
      continue;
    }

    artistCount.set(
      item.primaryArtistId,
      count + 1
    );

    selected.push(item.song);
  }

  // Se ainda não houver 12, completa com os candidatos restantes.
  if (selected.length < TARGET_COUNT) {
    const selectedIds = new Set(
      selected.map((song) => String(song.id))
    );

    for (const item of scored) {
      if (selected.length >= TARGET_COUNT) {
        break;
      }

      const songId = String(item.song.id);

      if (selectedIds.has(songId)) {
        continue;
      }

      selected.push(item.song);
      selectedIds.add(songId);
    }
  }

  const avgFit =
    selected.reduce((total, song) => {
      return (
        total +
        (1 - distance(song.energy, mood.energy)) * 50 +
        (1 - distance(song.valence, mood.valence)) * 50
      );
    }, 0) / Math.max(selected.length, 1);

  return {
    songs: selected,
    score: Math.round(
      Math.min(Math.max(avgFit, 50), 98)
    ),
  };
}