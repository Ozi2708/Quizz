import React from "react";
import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { melangerChoix } from "../pipeline/melange.ts";
import { LIBELLES, type Question, type Quiz } from "../pipeline/types.ts";
import { COULEURS_DIFFICULTE, HABILLAGES, POLICE, ZONE, type Habillage } from "./theme.ts";
import { planCourt } from "./timing.ts";

// Template T1 « paliers de difficulté », format court 9:16 (Shorts, TikTok, Reels).
// Déroulé : accroche, puis pour chaque question minuteur et révélation, puis appel au commentaire.

export interface PropsCourt {
  quiz: Quiz;
  debut: number; // numéro de la première question incluse
  fin: number; // numéro de la dernière question incluse
  [cle: string]: unknown;
}

export function questionsChoisies({ quiz, debut, fin }: PropsCourt): Question[] {
  return quiz.questions.filter((q) => q.numero >= debut && q.numero <= fin);
}

const LETTRES = ["A", "B", "C", "D"];
const LARGEUR_UTILE = 1080 - ZONE.gauche - ZONE.droite;

const Fond: React.FC<{ h: Habillage }> = ({ h }) => {
  const frame = useCurrentFrame();
  const angle = 160 + Math.sin(frame / 90) * 12;
  return <AbsoluteFill style={{ background: `linear-gradient(${angle}deg, ${h.fondHaut}, ${h.fondBas})` }} />;
};

const Zone: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      position: "absolute",
      left: ZONE.gauche,
      top: ZONE.haut,
      width: LARGEUR_UTILE,
      bottom: ZONE.bas,
      display: "flex",
      flexDirection: "column",
      fontFamily: POLICE,
    }}
  >
    {children}
  </div>
);

const Accroche: React.FC<{ quiz: Quiz; total: number; h: Habillage }> = ({ quiz, total, h }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const echelle = spring({ frame, fps, config: { damping: 12 } });
  return (
    <Zone>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", transform: `scale(${echelle})` }}>
        <div style={{ color: h.accent, fontSize: 56, fontWeight: 800, textTransform: "uppercase" }}>{quiz.theme.sujet}</div>
        <div style={{ color: h.texte, fontSize: 96, fontWeight: 900, lineHeight: 1.1, marginTop: 24 }}>
          Tu fais {total}/{total} ?
        </div>
      </div>
    </Zone>
  );
};

const BlocQuestion: React.FC<{ quiz: Quiz; question: Question; rang: number; total: number; timer: number; derniere: boolean; h: Habillage }> = ({
  quiz,
  question,
  rang,
  total,
  timer,
  derniere,
  h,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { choix, indexBonne } = melangerChoix(quiz, question);
  const revele = frame >= timer;
  const libelle = question.libelle_difficulte ?? LIBELLES[question.difficulte];
  const couleur = COULEURS_DIFFICULTE[libelle];
  const entree = spring({ frame, fps, config: { damping: 14 } });
  const restant = interpolate(frame, [0, timer], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const tremble = derniere && !revele ? Math.sin(frame * 1.7) * 4 : 0;
  const secondes = Math.max(0, Math.ceil((timer - frame) / fps));

  return (
    <Zone>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: 80 }}>
        <div style={{ color: h.texte, fontSize: 44, fontWeight: 700, opacity: 0.85 }}>
          {rang}/{total}
        </div>
        <div
          style={{
            background: couleur,
            color: "#111",
            fontSize: 38,
            fontWeight: 900,
            padding: "10px 28px",
            borderRadius: 999,
            textTransform: "uppercase",
            transform: `rotate(${tremble}deg)`,
          }}
        >
          {libelle}
        </div>
      </div>

      <div
        style={{
          color: h.texte,
          fontSize: 66,
          fontWeight: 800,
          lineHeight: 1.15,
          textAlign: "center",
          marginTop: 40,
          minHeight: 300,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: entree,
          transform: `translateY(${(1 - entree) * 40}px)`,
        }}
      >
        {question.enonce}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 24 }}>
        {choix.map((c, i) => {
          const apparition = spring({ frame: frame - 6 - i * 3, fps, config: { damping: 16 } });
          const bonne = i === indexBonne;
          const fond = revele && bonne ? h.correct : h.carte;
          const opacite = revele && !bonne ? 0.35 : 1;
          const pulse = revele && bonne ? 1 + Math.sin((frame - timer) / 3) * 0.02 : 1;
          return (
            <div
              key={c}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 24,
                background: fond,
                borderRadius: 24,
                padding: "22px 30px",
                opacity: opacite * apparition,
                transform: `translateX(${(1 - apparition) * 80}px) scale(${pulse})`,
              }}
            >
              <div style={{ color: h.accent, fontSize: 44, fontWeight: 900, width: 44 }}>{LETTRES[i]}</div>
              <div style={{ color: h.texte, fontSize: 48, fontWeight: 700 }}>{c}</div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 36, height: 120 }}>
        {revele ? (
          question.anecdote ? (
            <div style={{ color: h.texte, fontSize: 34, lineHeight: 1.3, textAlign: "center", opacity: interpolate(frame - timer, [0, 8], [0, 1], { extrapolateRight: "clamp" }) }}>
              {question.anecdote}
            </div>
          ) : null
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ flex: 1, height: 22, borderRadius: 11, background: "rgba(255,255,255,0.15)", overflow: "hidden" }}>
              <div style={{ width: `${restant * 100}%`, height: "100%", background: restant < 0.3 ? "#e74c3c" : h.accent }} />
            </div>
            <div style={{ color: h.texte, fontSize: 48, fontWeight: 900, width: 50, textAlign: "right" }}>{secondes}</div>
          </div>
        )}
      </div>
    </Zone>
  );
};

// Le court ne reprend qu'une partie du quiz : on n'affiche pas question_commentaire,
// qui parle du score sur le quiz entier.
const Appel: React.FC<{ total: number; h: Habillage }> = ({ total, h }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const echelle = spring({ frame, fps, config: { damping: 10 } });
  return (
    <Zone>
      <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", textAlign: "center", transform: `scale(${echelle})` }}>
        <div style={{ color: h.texte, fontSize: 88, fontWeight: 900, lineHeight: 1.15 }}>
          Ton score sur {total} ?
          <div style={{ color: h.accent, fontSize: 60, marginTop: 24 }}>Écris-le en commentaire</div>
        </div>
      </div>
    </Zone>
  );
};

export const QuizCourt: React.FC<PropsCourt> = (props) => {
  const { quiz } = props;
  const questions = questionsChoisies(props);
  const plan = planCourt(questions.map((q) => q.numero));
  const h = HABILLAGES[quiz.parametres_video?.habillage ?? "defaut"] ?? HABILLAGES.defaut;

  return (
    <AbsoluteFill>
      <Fond h={h} />
      <Sequence durationInFrames={plan.accroche}>
        <Accroche quiz={quiz} total={questions.length} h={h} />
      </Sequence>
      {plan.segments.map((seg, i) => (
        <Sequence key={seg.numero} from={seg.debut} durationInFrames={seg.timer + seg.revelation}>
          <BlocQuestion
            quiz={quiz}
            question={questions[i]}
            rang={i + 1}
            total={questions.length}
            timer={seg.timer}
            derniere={i === questions.length - 1}
            h={h}
          />
        </Sequence>
      ))}
      <Sequence from={plan.appelDebut}>
        <Appel total={questions.length} h={h} />
      </Sequence>
    </AbsoluteFill>
  );
};
