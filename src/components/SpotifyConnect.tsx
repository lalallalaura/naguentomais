import { useEffect, useState } from "react";
import { Music2, CheckCircle2, RefreshCcw, LogOut } from "lucide-react";
import {
  disconnectSpotify,
  isSpotifyConnected,
  startSpotifyLogin,
} from "../services/spotifyAuth";
import { fetchUserTopTracks } from "../services/spotifyApi";
import { SpotifyTrack } from "../types";

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function SpotifyConnect() {
  const [connected, setConnected] = useState(isSpotifyConnected());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);

  async function loadTracks() {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchUserTopTracks(8);
      setTracks(result);
    } catch (err: any) {
      setError(err?.message ?? "Não foi possível carregar suas músicas do Spotify agora.");
      if (err?.code === "not-connected" || err?.code === "unauthorized" || err?.code === "refresh-failed") {
        setConnected(false);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (connected) {
      loadTracks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  async function handleConnectClick() {
    setError(null);
    try {
      await startSpotifyLogin();
    } catch (err: any) {
      setError(err?.message ?? "Não foi possível iniciar a conexão com o Spotify.");
    }
  }

  function handleDisconnect() {
    disconnectSpotify();
    setConnected(false);
    setTracks([]);
    setError(null);
  }

  return (
    <div className="spotify-card">
      <div className="spotify-card-header">
        <div className="spotify-card-title">
          <Music2 size={18} />
          <span>Spotify</span>
        </div>

        {connected ? (
          <span className="spotify-status connected">
            <CheckCircle2 size={14} /> Spotify conectado ✓
          </span>
        ) : (
          <span className="spotify-status">Não conectado</span>
        )}
      </div>

      <p className="spotify-card-description">
        {connected
          ? "O Harmoody usa suas músicas mais ouvidas no Spotify para enriquecer suas recomendações."
          : "Conecte sua conta do Spotify para o Harmoody conhecer suas músicas."}
      </p>

      {error && <p className="spotify-error">{error}</p>}

      <div className="spotify-actions">
        {connected ? (
          <>
            <button className="spotify-secondary-button" onClick={loadTracks} disabled={loading}>
              <RefreshCcw size={14} /> {loading ? "Atualizando..." : "Atualizar músicas"}
            </button>
            <button className="spotify-secondary-button" onClick={handleDisconnect}>
              <LogOut size={14} /> Desconectar
            </button>
          </>
        ) : (
          <button className="spotify-connect-button" onClick={handleConnectClick}>
            <Music2 size={16} /> Conectar Spotify
          </button>
        )}
      </div>

      {connected && tracks.length > 0 && (
        <div className="spotify-track-list">
          {tracks.map((track) => (
            <article key={track.id} className="song-card">
              {track.cover && <img src={track.cover} alt="" />}
              <div className="song-info">
                <strong>{track.title}</strong>
                <span>{track.artist}</span>
                <div className="song-meta">
                  <span>{track.album}</span>
                  <span>{formatDuration(track.durationMs)}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
