// Estimativa de energy / valence / bpm a partir do GÊNERO real do artista
// (obtido via Spotify /v1/artists, que continua disponível).
//
// Por que isso existe:
// Em 27/11/2024 o Spotify descontinuou permanentemente, para qualquer app
// novo, os endpoints "Audio Features" e "Audio Analysis" — que eram a
// forma oficial de obter energy/valence/tempo reais de uma faixa. Como o
// Harmoody precisa desses três eixos para o algoritmo de recomendação,
// esta é uma classificação heurística PRÓPRIA (não fornecida pelo
// Spotify), construída a partir de características amplamente
// documentadas de cada gênero musical. Os valores devem ser tratados
// como uma ESTIMATIVA, não como um dado medido pelo Spotify — isso é
// importante deixar claro em qualquer texto/documentação do TCC.
//
// Os valores (0 a 1 para energy/valence, bpm aproximado) podem ser
// recalibrados livremente aqui, em um único lugar.

export interface GenreProfile {
  energy: number;
  valence: number;
  bpm: number;
}

interface GenreRule {
  matchers: string[];
  profile: GenreProfile;
}

const GENRE_RULES: GenreRule[] = [
  { matchers: ["edm", "house", "techno", "electro", "dubstep", "dance pop", "big room"], profile: { energy: 0.9, valence: 0.75, bpm: 128 } },
  { matchers: ["pop rock", "power pop", "dance"], profile: { energy: 0.82, valence: 0.78, bpm: 118 } },
  { matchers: ["pop"], profile: { energy: 0.7, valence: 0.72, bpm: 112 } },
  { matchers: ["hip hop", "trap", "rap"], profile: { energy: 0.78, valence: 0.55, bpm: 95 } },
  { matchers: ["r&b", "soul", "neo soul"], profile: { energy: 0.5, valence: 0.6, bpm: 88 } },
  { matchers: ["romantic", "love song", "singer-songwriter"], profile: { energy: 0.42, valence: 0.75, bpm: 85 } },
  { matchers: ["indie pop", "indie folk", "bedroom pop"], profile: { energy: 0.55, valence: 0.7, bpm: 100 } },
  { matchers: ["indie", "alternative"], profile: { energy: 0.6, valence: 0.6, bpm: 105 } },
  { matchers: ["folk", "acoustic"], profile: { energy: 0.35, valence: 0.65, bpm: 90 } },
  { matchers: ["lo-fi", "lofi", "chillhop"], profile: { energy: 0.25, valence: 0.55, bpm: 80 } },
  { matchers: ["ambient", "downtempo", "chill"], profile: { energy: 0.2, valence: 0.5, bpm: 75 } },
  { matchers: ["piano", "classical", "instrumental"], profile: { energy: 0.22, valence: 0.55, bpm: 78 } },
  { matchers: ["jazz"], profile: { energy: 0.4, valence: 0.6, bpm: 92 } },
  { matchers: ["sad", "emo", "melancholic"], profile: { energy: 0.35, valence: 0.3, bpm: 85 } },
  { matchers: ["rock", "punk", "metal"], profile: { energy: 0.85, valence: 0.5, bpm: 130 } },
  { matchers: ["workout", "gym"], profile: { energy: 0.92, valence: 0.7, bpm: 140 } },
];

const DEFAULT_BPM_RANGE: [number, number] = [70, 140];

/**
 * Estima energy/valence/bpm de uma faixa a partir dos gêneros reais do
 * artista. Se nenhum gênero bater com as regras conhecidas, usa o perfil
 * do humor selecionado como base (ainda assim uma estimativa, nunca um
 * valor "medido").
 */
export function estimateProfile(
  genres: string[],
  fallback: { energy: number; valence: number }
): GenreProfile {
  const matches: GenreProfile[] = [];

  for (const genre of genres) {
    const lower = genre.toLowerCase();
    for (const rule of GENRE_RULES) {
      if (rule.matchers.some((m) => lower.includes(m))) {
        matches.push(rule.profile);
        break; // uma regra por gênero é suficiente
      }
    }
  }

  if (matches.length === 0) {
    const bpm = Math.round(
      DEFAULT_BPM_RANGE[0] + fallback.energy * (DEFAULT_BPM_RANGE[1] - DEFAULT_BPM_RANGE[0])
    );
    return { energy: fallback.energy, valence: fallback.valence, bpm };
  }

  const avg = matches.reduce(
    (acc, m) => ({
      energy: acc.energy + m.energy / matches.length,
      valence: acc.valence + m.valence / matches.length,
      bpm: acc.bpm + m.bpm / matches.length,
    }),
    { energy: 0, valence: 0, bpm: 0 }
  );

  return {
    energy: Math.min(1, Math.max(0, avg.energy)),
    valence: Math.min(1, Math.max(0, avg.valence)),
    bpm: Math.round(avg.bpm),
  };
}
