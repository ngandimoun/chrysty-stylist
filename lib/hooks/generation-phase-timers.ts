import { UI_COPY } from "@/lib/chrysty/ui-copy";
import type { GenerationPhase } from "@/store/ui";

const PHASE_SEQUENCE: Exclude<GenerationPhase, null>[] = [
  "analyzing",
  "selecting",
  "finishing",
  "rendering",
];

/** Delay before each phase starts (ms from submit). */
const PHASE_DELAYS_MS: Record<Exclude<GenerationPhase, null>, number> = {
  analyzing: 0,
  selecting: 4000,
  finishing: 9000,
  rendering: 14000,
};

export function runGenerationPhaseTimers(params: {
  setGenerationPhase: (phase: GenerationPhase) => void;
  setGenerating: (value: boolean, message?: string | null) => void;
}): () => void {
  const { setGenerationPhase, setGenerating } = params;
  const timeouts: number[] = [];

  for (const phase of PHASE_SEQUENCE) {
    const delayMs = PHASE_DELAYS_MS[phase];
    if (delayMs === 0) {
      setGenerationPhase(phase);
      setGenerating(true, UI_COPY.generation.phases[phase]);
      continue;
    }

    const id = window.setTimeout(() => {
      setGenerationPhase(phase);
      setGenerating(true, UI_COPY.generation.phases[phase]);
    }, delayMs);
    timeouts.push(id);
  }

  return () => {
    for (const id of timeouts) window.clearTimeout(id);
  };
}
