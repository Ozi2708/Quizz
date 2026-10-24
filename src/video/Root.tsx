import React from "react";
import { Composition } from "remotion";
import exemple from "../../templates/exemples/harry-potter-10q.json" with { type: "json" };
import type { Quiz } from "../pipeline/types.ts";
import { QuizCourt, questionsChoisies, type PropsCourt } from "./QuizCourt.tsx";
import { FPS, HAUTEUR_COURT, LARGEUR_COURT, planCourt } from "./timing.ts";

const parDefaut: PropsCourt = { quiz: exemple as Quiz, debut: 1, fin: 5 };

export const Root: React.FC = () => (
  <Composition
    id="QuizCourt"
    component={QuizCourt}
    width={LARGEUR_COURT}
    height={HAUTEUR_COURT}
    fps={FPS}
    durationInFrames={planCourt([1, 2, 3, 4, 5]).total}
    defaultProps={parDefaut}
    calculateMetadata={({ props }) => ({
      durationInFrames: planCourt(questionsChoisies(props).map((q) => q.numero)).total,
    })}
  />
);
