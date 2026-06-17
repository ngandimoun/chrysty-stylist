import { z } from "zod";
import { perceivedPresentationSchema } from "@/lib/ai/outfit-plan-schema";

export const intendedWearerSchema = z.enum([
  "masculine",
  "feminine",
  "unisex",
  "child",
  "unknown",
]);

export const falEditPromptSchema = z.object({
  editPrompt: z.string().min(1),
  primaryLookImageIndex: z.number().int().min(0).max(4),
  imageIndexMap: z.array(
    z.object({
      index: z.number().int().min(0),
      role: z.enum(["user_look", "wardrobe_reference"]),
      bodyRefId: z.string().optional(),
      wardrobeItemId: z.string().optional(),
      label: z.string().min(1),
    })
  ),
  subjectStyling: z.array(
    z.object({
      bodyRefIndex: z.number().int().min(0).max(4),
      personLabel: z.string().min(1),
      perceivedPresentation: perceivedPresentationSchema,
      wardrobeItemIds: z.array(z.string()),
      layeringNotes: z.string().min(1),
    })
  ),
  assignmentValidation: z.array(
    z.object({
      bodyRefIndex: z.number().int().min(0).max(4),
      wardrobeItemId: z.string(),
      isValid: z.boolean(),
      mismatchReason: z.string().optional(),
    })
  ),
  preserveInstructions: z.string().min(1),
  sceneType: z.enum(["solo", "couple", "family", "group"]),
  styledImageLayout: z.object({
    mode: z.enum(["hero_only", "detail_insets"]),
    insets: z
      .array(
        z.object({
          cropZone: z.enum(["upper_torso", "mid_outfit", "lower_legs", "feet"]),
          focusLabel: z.string().min(1),
          reasoning: z.string().min(1),
        })
      )
      .max(3),
  }),
});

export type FalEditPrompt = z.infer<typeof falEditPromptSchema>;
export type StyledImageLayout = FalEditPrompt["styledImageLayout"];
export type StyledImageCropZone = StyledImageLayout["insets"][number]["cropZone"];

export type FalBodyRefInput = {
  id: string;
  index: number;
  referenceType: string;
  imageUrl: string;
  storagePath: string;
};

export type FalWardrobePieceInput = {
  id: string;
  sortIndex: number;
  category: string | null;
  description: string;
  colors: string[] | null;
  imageUrl: string;
  storagePath: string;
};

export type CraftFalEditPromptInput = {
  look: import("@/lib/ai/outfit-plan-schema").OutfitLookPlan;
  stylingMessage: string;
  bodyRefs: FalBodyRefInput[];
  wardrobePieces: FalWardrobePieceInput[];
};
