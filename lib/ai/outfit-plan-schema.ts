import { z } from "zod";
import { MAX_PIECES_PER_LOOK } from "@/lib/chrysty/look-count-constants";

export const perceivedPresentationSchema = z.enum([
  "masculine",
  "feminine",
  "androgynous",
  "child",
  "unknown",
]);

export const subjectAssignmentSchema = z.object({
  bodyRefIndex: z.number().int().min(0).max(4),
  perceivedPresentation: perceivedPresentationSchema,
  personLabel: z.string().min(1),
  wardrobeItemIds: z.array(z.string()),
  assignmentReasoning: z.string().min(1),
});

export const outfitLookPlanSchema = z.object({
  lookIndex: z.number().int().min(1),
  styleDirection: z.string().min(1),
  stylingReasoning: z.string().min(1),
  itemReasoning: z.string().min(1),
  wardrobeItemIds: z.array(z.string()).min(1).max(MAX_PIECES_PER_LOOK),
  rationale: z.string().min(1),
  vibe: z.string().min(1),
  occasionTag: z.string().min(1),
  imagePrompt: z.string().optional(),
  isStylistPick: z.boolean().optional(),
  subjectAssignments: z.array(subjectAssignmentSchema).optional(),
});

export const outfitPlanSchema = z.object({
  planningReasoning: z.string().min(1),
  looks: z.array(outfitLookPlanSchema).min(1).max(7),
  assistantMessage: z.string().min(1),
});

export type OutfitPlan = z.infer<typeof outfitPlanSchema>;
export type OutfitLookPlan = z.infer<typeof outfitLookPlanSchema>;
export type SubjectAssignment = z.infer<typeof subjectAssignmentSchema>;
export type PerceivedPresentation = z.infer<typeof perceivedPresentationSchema>;

