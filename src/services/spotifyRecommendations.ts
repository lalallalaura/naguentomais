import { MoodId, Song } from "../types";

const MOOD_GENRES: Record<string, string[]> = {
  energized: ["pop", "dance", "edm", "rock", "work-out"],
  calm: ["acoustic", "chill", "ambient", "sleep", "piano"],
  happy: ["pop", "happy", "indie-pop", "disco", "groove"],
  sad: ["sad", "indie", "acoustic", "emo", "singer-songwriter"],
  focused: ["study", "ambient", "classical", "chill", "piano"],
  romantic: ["romance", "r-n-b", "soul", "acoustic", "pop"],
};

export async function recommendSongsFromSpotify(
  moodId: MoodId,
  page: number = 0
): Promise<{ songs: Song[]; score: number }> {
  // Busca o token do Spotify diretamente do localStorage sem depender de import de outro arquivo
  const token =
    localStorage.getItem("spotify_access_token") ||
    localStorage.getItem("spotify_token") ||
    localStorage.getItem("spotify_auth");

  if (!token) {
    throw new Error("Sessão do Spotify não encontrada. Conecte sua conta novamente.");
  }

  const genresList = MOOD_GENRES[moodId as string] || ["pop", "rock"];

  // Rotaciona as sementes de gênero com base na página para variar o resultado do Spotify
  const rotated = [...genresList];
  for (let i = 0; i < page % genresList.length; i++) {
    rotated.push(rotated.shift()!);
  }
  const selectedGenres = rotated.slice(0, 2).join(",");

  const response = await fetch(
    `https://api.spotify.com/v1/recommendations?limit=30&seed_genres=${encodeURIComponent(selectedGenres)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Erro na API do Spotify (${response.status})`);
  }

  const data = await response.json();
  const rawTracks = data.tracks || [];

  const allSongs: Song[] = rawTracks.map((track: any) => ({
    id: track.id,
    title: track.name,
    artist: track.artists?.map((a: any) => a.name).join(", ") || "Artista Desconhecido",
    album: track.album?.name || "",
    coverUrl: track.album?.images?.[0]?.url || "",
    previewUrl: track.preview_url || null,
    spotifyUrl: track.external_urls?.spotify || "",
    bpm: 120,
    energy: 0.8,
    valence: 0.8,
    moods: [moodId],
  }));

  const limit = 12;
  const startIndex = (page * limit) % Math.max(allSongs.length - limit + 1, 1);
  const slicedSongs = allSongs.slice(startIndex, startIndex + limit);

  return {
    songs: slicedSongs.length > 0 ? slicedSongs : allSongs.slice(0, limit),
    score: Math.floor(Math.random() * 10) + 85,
  };
}