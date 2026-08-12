import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, AlertTriangle } from "lucide-react";
import { completeSpotifyLogin } from "../services/spotifyAuth";

export default function SpotifyCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    completeSpotifyLogin(params)
      .then(() => {
        // volta para a Home já com o Spotify conectado
        navigate("/", { replace: true });
      })
      .catch((err) => {
        setError(err?.message ?? "Não foi possível conectar ao Spotify.");
      });
  }, [navigate]);

  return (
    <div className="app-shell">
      <div className="spotify-callback-screen">
        {error ? (
          <>
            <div className="spotify-callback-icon error">
              <AlertTriangle size={26} />
            </div>
            <h2>Não foi possível conectar</h2>
            <p>{error}</p>
            <button className="spotify-connect-button" onClick={() => navigate("/", { replace: true })}>
              Voltar para o Harmoody
            </button>
          </>
        ) : (
          <>
            <div className="spotify-callback-icon">
              <Loader2 size={26} className="spin" />
            </div>
            <h2>Conectando ao Spotify...</h2>
            <p>Só um instante enquanto confirmamos sua autorização.</p>
          </>
        )}
      </div>
    </div>
  );
}
