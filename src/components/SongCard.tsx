import { Play } from "lucide-react";
import { Song } from "../types";

export function SongCard({ song }: { song: Song }) {
  function openInSpotify() {
    if (song.spotifyUrl) {
      window.open(song.spotifyUrl, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <article className="song-card">
      <img src={song.cover} alt="" />
      <div className="song-info">
        <strong>{song.title}</strong>
        <span>{song.artist}</span>
        <div className="song-meta">
          <span>{song.estimated ? "~" : ""}{song.bpm} BPM</span>
          <span>Valência {Math.round(song.valence * 100)}%</span>
        </div>
      </div>
      <button
        className="play-button"
        title={song.spotifyUrl ? "Ouvir no Spotify" : "Ouvir"}
        onClick={openInSpotify}
        disabled={!song.spotifyUrl}
      >
        <Play size={18} fill="currentColor" />
      </button>
    </article>
  );
}
