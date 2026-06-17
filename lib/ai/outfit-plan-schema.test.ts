import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  coercePerceivedPresentation,
  parseOutfitPlan,
} from "./outfit-plan-schema.ts";

describe("coercePerceivedPresentation", () => {
  it("accepts canonical enum values case-insensitively", () => {
    assert.equal(coercePerceivedPresentation("Masculine"), "masculine");
    assert.equal(coercePerceivedPresentation("FEMININE"), "feminine");
  });

  it("maps outfit descriptions to unknown", () => {
    assert.equal(
      coercePerceivedPresentation(
        "wearing a white tuxedo jacket, black trousers, a white dress shirt, and a black bow tie"
      ),
      "unknown"
    );
    assert.equal(coercePerceivedPresentation("wearing"), "unknown");
  });

  it("infers presentation from short labels", () => {
    assert.equal(coercePerceivedPresentation("the man on the left"), "masculine");
    assert.equal(coercePerceivedPresentation("young girl"), "child");
  });
});

describe("parseOutfitPlan", () => {
  const baseLook = {
    lookIndex: 1,
    styleDirection: "Wedding formal",
    stylingReasoning: "Classic black-tie styling.",
    itemReasoning: "Tuxedo pieces from closet.",
    wardrobeItemIds: ["wardrobe-1"],
    rationale: "A polished wedding look.",
    vibe: "Formal",
    occasionTag: "Wedding",
    isStylistPick: true,
  };

  it("parses solo looks when perceivedPresentation contains outfit text", () => {
    const plan = parseOutfitPlan(
      {
        planningReasoning: "Plan for wedding.",
        assistantMessage: "Here is your wedding look.",
        looks: [
          {
            ...baseLook,
            subjectAssignments: [
              {
                bodyRefIndex: 0,
                perceivedPresentation:
                  "wearing a white tuxedo jacket, black trousers, a white dress shirt, and a black bow tie",
                personLabel: "the user",
                wardrobeItemIds: ["wardrobe-1"],
                assignmentReasoning: "",
              },
            ],
          },
        ],
      },
      { bodyRefCount: 1 }
    );

    assert.equal(plan.looks.length, 1);
    assert.equal(plan.looks[0].subjectAssignments, undefined);
  });

  it("coerces multi-person subjectAssignments and preserves swapped outfit text", () => {
    const plan = parseOutfitPlan(
      {
        planningReasoning: "Couple styling.",
        assistantMessage: "Looks for both of you.",
        looks: [
          {
            ...baseLook,
            subjectAssignments: [
              {
                bodyRefIndex: 0,
                perceivedPresentation: "wearing a burgundy blazer",
                personLabel: "the man",
                wardrobeItemIds: ["wardrobe-1"],
                assignmentReasoning: "",
              },
              {
                bodyRefIndex: 1,
                perceivedPresentation: "feminine",
                personLabel: "the woman",
                wardrobeItemIds: ["wardrobe-2"],
                assignmentReasoning: "Dress for her.",
              },
            ],
          },
        ],
      },
      { bodyRefCount: 2 }
    );

    const assignments = plan.looks[0].subjectAssignments;
    assert.equal(assignments?.length, 2);
    assert.equal(assignments?.[0].perceivedPresentation, "unknown");
    assert.equal(assignments?.[0].assignmentReasoning, "wearing a burgundy blazer");
    assert.equal(assignments?.[1].perceivedPresentation, "feminine");
  });
});
