# Tactical Mech Sandbox

Audio-first, accessible turn-based tactical combat. Prototype 0.13.

## Combat foundation

- engine.js owns unit creation, movement, line of sight, attack previews, action resolution, seeded randomness and AI.
- createUnit defines per-unit maximum AP/MP, equipped weapon IDs, accuracy/evasion modifiers, damage resistances and controller/profile metadata.
- attackPreview is the shared authority for legal attacks, reasons, cost, hit probability and damage. resolveAction returns structured results for movement and attacks.
- All teams use the same rules; existing starting AP/MP and weapons remain unchanged for baseline playtesting.
- Cover is directional: adjacent terrain on the attack-facing side reduces accuracy by 20 percentage points and damage to 65%; blocked LOS still prevents attacks.
- AI evaluates legal firing positions and targets using expected damage, kill potential, exposure, movement cost, cover and profile-specific range preferences. Scout, defender and sniper profiles are provisional weights.
- main.js owns the accessible UI, cursor, contextual menus, ARIA announcements and sound dispatch. Do not duplicate combat rules here.
- audio.js synthesizes sound effects with Web Audio.
- No fog of war, energy, ammunition, heat, shields, reactions or garage yet.

## Testing

Use Node.js 22 or newer:
`node --experimental-default-type=module engine.test.mjs`

## Next milestone

Data-driven chassis and equipment catalog, derived stats, per-unit weapon loadouts and an accessible garage. Keep the existing battlefield interactions stable.
