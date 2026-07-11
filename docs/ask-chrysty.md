# Ask Chrysty — Stylist

Host integration for the Ask Chrysty Live embed. Full sibling-app guide:

→ Astra: `docs/embed/ask-chrysty-sibling-apps.md`  
→ Learning pilot: `docs/ask-chrysty-sibling-apps.md`

Do not invent a second Live stack. Mic / WebSocket / Gemini run only inside `https://chrysty.chrysty.dev/embed/live`.

## This app

| Piece | Value / location |
|-------|------------------|
| Worker | `stylist` |
| Env | `NEXT_PUBLIC_ASTRA_EMBED_URL` (default `https://chrysty.chrysty.dev`) |
| Provider | `app/layout.tsx` — one `ChrystyLiveEmbedProvider` |
| Shell FAB + context | `components/stylist/stylist-app.tsx` — `source="stylist_workspace"`, `#workspace-content`, one `AskChrystyButton` |
| Nested context | `components/masonry/outfit-detail-sheet.tsx` — `source="stylist_look"`, `#look-content` (no second FAB) |
| Package | `packages/live-embed` (vendored from Astra) |

## Smoke test

1. Signed-in user on `*.chrysty.dev`
2. FAB visible on the main workspace (not `/welcome`)
3. Open Ask Chrysty → docked panel, not full-screen
4. Allow mic → Connect → speak / hear
5. Open a look while panel is open → context/capture upgrades to look content
6. Close panel → mic released
7. Side-by-side: full Live on `chrysty.chrysty.dev` still works

## Prod gate

Run the device-gate checklist on real devices before production. Desktop Chrome embed speaker→mic hiss is an Astra-only issue — do not ship `mode: 'direct'` or patch frozen Live files from this host app.
