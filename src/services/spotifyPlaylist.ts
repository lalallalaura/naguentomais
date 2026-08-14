import { Mood, Song } from "../types";
import { createPlaylist, addTracksToPlaylist, SpotifyApiError } from "./spotifyApi";
import { recommendSongsFromSpotify } from "./spotifyRecommendations";

export interface CreatedPlaylist {
  url: string | null;
  trackCount: number;
}

/**
 * Cria uma playlist privada no Spotify do usuário com músicas
 * recomendadas para o humor selecionado.
 *
 * `size` permite pedir mais faixas do que as ~12 exibidas na tela (ex:
 * 24 ou 36) — nesse caso busca um lote maior diretamente do Spotify,
 * independente do que está sendo mostrado no momento no app.
 */
export async function createPlaylistFromRecommendations(
  mood: Mood,
  songs: Song[],
  size: number = songs.length
): Promise<CreatedPlaylist> {
  let tracksForPlaylist = songs;

  if (size !== songs.length) {
    const bigger = await recommendSongsFromSpotify(mood.id, { count: size });
    tracksForPlaylist = bigger.songs;
  }

  if (tracksForPlaylist.length === 0) {
    throw new SpotifyApiError("no-tracks", "Não há músicas para adicionar à playlist.");
  }

  const today = new Date().toLocaleDateString("pt-BR");
  const name = `Harmoody · ${mood.emoji} ${mood.label} · ${today}`;
  const description = `Playlist gerada pelo Harmoody para o clima "${mood.label}".`;

  const playlist = await createPlaylist(name, description);

  try {
    await addTracksToPlaylist(playlist.id, tracksForPlaylist.map((s) => s.id));
  } catch (err) {
    if (err instanceof SpotifyApiError) {
      throw new SpotifyApiError(
        err.code,
        `A playlist foi criada no Spotify, mas não conseguimos adicionar as músicas automaticamente. Abra a playlist "${name}" e adicione manualmente, ou tente de novo.`
      );
    }
    throw err;
  }

  return { url: playlist.url, trackCount: tracksForPlaylist.length };
}