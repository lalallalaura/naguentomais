import { moods } from "../data";
import { MoodId, Song, SpotifyTrack } from "../types";
import { fetchArtistsGenres, searchTracks, SpotifyApiError } from "./spotifyApi";
import { estimateProfile } from "./moodProfile";

// Termos de busca por humor. Como /recommendations (por seed de gênero)
// também foi restringido pelo Spotify para apps novos, usamos o endpoint
// de busca (/search), que continua disponível, com termos que já
// carregam uma forte associação musical com cada humor.
//
// Desde fev/2026 o /search retorna no máximo 10 resultados por chamada
// (antes eram 50), então usamos mais termos por humor para manter um
// pool de candidatos razoável.
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

async function collectCandidates(moodId: MoodId): Promise<SpotifyTrack[]> {
  const queries = MOOD_QUERIES[moodId];

  const settled = await Promise.allSettled(queries.map((q) => searchTracks(q, RESULTS_PER_QUERY)));

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

  // Se TODAS as buscas falharam (não apenas vieram vazias), o problema é
  // outro (token expirado, rede, etc.) — repropaga o erro real em vez de
  // disfarçar tudo como "sem músicas encontradas".
  const allFailed = settled.every((s) => s.status === "rejected");
  if (allFailed && firstError) {
    throw firstError;
  }

  return candidates;
}

export async function recommendSongsFromSpotify(
  moodId: MoodId
): Promise<{ songs: Song[]; score: number }> {
  const mood = moods.find((m) => m.id === moodId)!;

  const candidates = await collectCandidates(moodId);
  if (candidates.length === 0) {
    throw new SpotifyApiError(
      "no-tracks",
      "Não encontramos músicas no Spotify para esse clima agora."
    );
  }

  // Busca os gêneros reais dos artistas envolvidos (uma única chamada em lote)
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

    // Obs: o campo "popularity" da faixa foi removido pela API do
    // Spotify em fev/2026, então o ranking usa só energy/valence/bpm.
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

  // Seleção gulosa com limite por artista, para garantir variedade
  const artistCount = new Map<string, number>();
  const selected: Song[] = [];

  for (const item of scored) {
    if (selected.length >= TARGET_COUNT) break;
    const count = artistCount.get(item.primaryArtistId) ?? 0;
    if (count >= MAX_PER_ARTIST) continue;
    artistCount.set(item.primaryArtistId, count + 1);
    selected.push(item.song);
  }

  // Se ainda faltarem músicas (pouca variedade de artistas), completa
  // ignorando o limite por artista, mas sem repetir a mesma faixa.
  if (selected.length < TARGET_COUNT) {
    const selectedIds = new Set(selected.map((s) => s.id));
    for (const item of scored) {
      if (selected.length >= TARGET_COUNT) break;
      if (selectedIds.has(item.song.id)) continue;
      selected.push(item.song);
      selectedIds.add(item.song.id);
    }
  }

  const avgFit =
    selected.reduce((total, song) => {
      return total + (1 - distance(song.energy, mood.energy)) * 50 + (1 - distance(song.valence, mood.valence)) * 50;
    }, 0) / Math.max(selected.length, 1);

  return {
    songs: selected,
    score: Math.round(Math.min(Math.max(avgFit, 50), 98)),
  };
}
