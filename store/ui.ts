import { create } from "zustand";
import { clampLookCount, DEFAULT_LOOK_COUNT } from "@/lib/chrysty/look-count-constants";

type SheetType = "capture" | "masonry" | "outfit-detail" | "settings" | null;

export type CaptureMode = "body" | "wardrobe";

export type GenerationPhase = "analyzing" | "selecting" | "finishing" | "rendering" | null;

type UIState = {
  activeSheet: SheetType;
  captureMode: CaptureMode | null;
  selectedLookId: string | null;
  generationLooks: OutfitLookUI[];
  isGenerating: boolean;
  generationPhase: GenerationPhase;
  requestedLookCount: number;
  statusMessage: string | null;
  activeGenerationId: string | null;
  openBodyCapture: () => void;
  openWardrobeCapture: () => void;
  openMasonry: (looks: OutfitLookUI[]) => void;
  openSettings: () => void;
  openOutfitDetail: (lookId: string) => void;
  closeSheet: () => void;
  setGenerationLooks: (looks: OutfitLookUI[]) => void;
  setGenerating: (value: boolean, message?: string | null) => void;
  setGenerationPhase: (phase: UIState["generationPhase"]) => void;
  setRequestedLookCount: (count: number) => void;
  setActiveGenerationId: (id: string | null) => void;
};

export type LookWardrobePieceUI = {
  id: string;
  imageUrl: string;
  description?: string | null;
  category?: string | null;
};

export type OutfitLookUI = {
  id: string;
  imageUrl?: string | null;
  renderStatus?: "pending" | "ready";
  downloadUrl?: string;
  rationale: string;
  vibe?: string | null;
  occasionTag?: string | null;
  isStylistPick: boolean;
  wardrobeItemIds?: string[] | null;
  selectedItems?: LookWardrobePieceUI[];
  styleDirection?: string;
  stylingReasoning?: string;
  itemReasoning?: string;
};

export type OutfitGenerationUI = {
  generationId: string;
  userPrompt: string;
  createdAt?: string;
  generationStatus?: string | null;
  looks: OutfitLookUI[];
};

export const useUIStore = create<UIState>((set) => ({
  activeSheet: null,
  captureMode: null,
  selectedLookId: null,
  generationLooks: [],
  isGenerating: false,
  generationPhase: null,
  requestedLookCount: DEFAULT_LOOK_COUNT,
  statusMessage: null,
  activeGenerationId: null,
  openBodyCapture: () => set({ activeSheet: "capture", captureMode: "body" }),
  openWardrobeCapture: () => set({ activeSheet: "capture", captureMode: "wardrobe" }),
  openMasonry: (looks) => set({ activeSheet: "masonry", generationLooks: looks }),
  openSettings: () => set({ activeSheet: "settings" }),
  openOutfitDetail: (lookId) =>
    set({ activeSheet: "outfit-detail", selectedLookId: lookId }),
  closeSheet: () => set({ activeSheet: null, selectedLookId: null, captureMode: null }),
  setGenerationLooks: (looks) => set({ generationLooks: looks }),
  setGenerating: (value, message = null) =>
    set({ isGenerating: value, statusMessage: message }),
  setGenerationPhase: (phase) => set({ generationPhase: phase }),
  setRequestedLookCount: (count) => set({ requestedLookCount: clampLookCount(count) }),
  setActiveGenerationId: (id) => set({ activeGenerationId: id }),
}));
