import React from "react";
import { Composition } from "remotion";
import { Film, FILM_FRAMES } from "./jungle/Film";
export const Root: React.FC = () => <Composition id="JaduiJungle" component={Film} durationInFrames={FILM_FRAMES} fps={30} width={1920} height={1080} />;
