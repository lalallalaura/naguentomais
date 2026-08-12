import { Mood, Song } from "../types";
import { createPlaylist, addTracksToPlaylist, SpotifyApiError } from "./spotifyApi";

export interface CreatedPlaylist {
  url: string | null;
  trackCount: number;
}

/**
 * Cria uma playlist privada no Spotify do usuário com as músicas
 * recomendadas pelo Harmoody para o humor selecionado.
 *
 * Desde fev/2026 a criação usa POST /me/playlists (não precisa mais
 * buscar o id do usuário antes).
 *
 * Só funciona com faixas reais do Spotify (song.id precisa ser um id de
 * faixa válido) — não use com o fallback local.
 */
export async function createPlaylistFromRecommendations(
  mood: Mood,
  songs: Song[]
): Promise<CreatedPlaylist> {
  if (songs.length === 0) {
    throw new SpotifyApiError("no-tracks", "Não há músicas para adicionar à playlist.");
  }

  const today = new Date().toLocaleDateString("pt-BR");
  const name = `Harmoody · ${mood.emoji} ${mood.label} · ${today}`;
  const description = `Playlist gerada pelo Harmoody para o clima "${mood.label}".`;

  const playlist = await createPlaylist(name, description);

  try {
    await addTracksToPlaylist(playlist.id, songs.map((s) => s.id));
  } catch (err) {
    // A playlist já foi criada; melhor avisar isso do que dizer que falhou tudo.
    if (err instanceof SpotifyApiError) {
      throw new SpotifyApiError(
        err.code,
        `A playlist foi criada no Spotify, mas não conseguimos adicionar as músicas automaticamente. Abra a playlist "${name}" e adicione manualmente, ou tente de novo.`
      );
    }
    throw err;
  }

  return { url: playlist.url, trackCount: songs.length };
}
