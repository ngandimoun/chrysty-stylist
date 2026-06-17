import { MAX_PIECES_PER_LOOK } from "@/lib/chrysty/look-count-constants";

export function buildOutfitPlanningRules(maxPieces = MAX_PIECES_PER_LOOK): string {
  return [
    `- Return exactly the requested number of looks. Each look must have a DISTINCT styleDirection.`,
    `- Each look must include: styleDirection, stylingReasoning, itemReasoning, wardrobeItemIds (1..${maxPieces}), rationale (user-facing), vibe, occasionTag.`,
    `- wardrobeItemIds MUST be chosen from the provided wardrobe items by id. Never invent ids.`,
    `- Each look may use 1 to ${maxPieces} closet items. When the request implies a full outfit (separates, layering, shoes, accessories) and multiple relevant items exist in the closet, prefer combining 2-${maxPieces} items rather than defaulting to a single photo.`,
    `- When the closet has multiple distinct pieces, combine them into cohesive outfits instead of selecting one item unless a single photo already shows a complete outfit.`,
    `- rationale, itemReasoning, and assistantMessage must ONLY describe garments represented by wardrobeItemIds for that look. Never mention shirts, shoes, or other pieces that are not in the list.`,
    `- If the user asks for something not in the closet (e.g. a dress but no dress item), say that clearly and build the closest look from available items.`,
    `- Body references are identity-only. Never treat body refs as wardrobe items.`,
    `- Mark exactly one look as isStylistPick=true.`,
    `- imagePrompt (optional): describe a full-body editorial lookbook hero — head-to-toe, entire outfit and shoes visible, neutral studio/boutique background.`,
  ].join("\n");
}

export function buildMultiPersonPlanningRules(bodyRefCount: number): string {
  if (bodyRefCount <= 1) return "";
  return [
    ``,
    `Multi-person styling (${bodyRefCount} look reference photos):`,
    `- Visually identify each person in every look photo (gender presentation, adult vs child, position in group shots).`,
    `- For each look, include subjectAssignments: one entry per person being styled, with bodyRefIndex (0-based, matching look photo order), perceivedPresentation (masculine|feminine|androgynous|child|unknown), personLabel (e.g. "the man", "the woman on the right"), wardrobeItemIds (ONLY items for that person), and assignmentReasoning.`,
    `- Match wardrobe to person: suits/blazers → masculine-presenting; dresses/skirts/heels → feminine-presenting; unisex items (sneakers, jackets) → either with reasoning.`,
    `- NEVER assign clearly gendered garments to the wrong person (e.g. skirt on a man unless user explicitly requests).`,
    `- Split wardrobeItemIds across subjectAssignments for couple/family requests — do not put all items on one person.`,
    `- itemReasoning must state who wears what and why.`,
  ].join("\n");
}

export function buildOpenAIPlanningUserRules(maxPieces = MAX_PIECES_PER_LOOK): string {
  return [
    `Each look may use 1 to ${maxPieces} wardrobe item IDs.`,
    `When multiple relevant closet pieces exist, prefer combining 2-${maxPieces} items for full outfits.`,
    `rationale, itemReasoning, and assistantMessage must only describe items in wardrobeItemIds for that look.`,
    `If the request cannot be met with the closet, explain that and use the closest available pieces.`,
  ].join(" ");
}
