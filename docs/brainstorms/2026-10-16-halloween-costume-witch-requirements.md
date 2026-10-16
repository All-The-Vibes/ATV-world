---
date: 2026-10-16
topic: halloween-costume-witch
---

# Halloween Costume Witch

## Problem Frame

ATV World needs a playful Halloween encounter that changes how people look without interrupting exploration. A seated witch near the portal to hell gives nearby visitors a temporary costume and turns the existing spooky area into a more interactive destination.

## Requirements

* R1. A clearly recognizable witch sits in a Halloween corner near the portal to hell.
* R2. The witch detects both the player and wandering townspeople who approach her.
* R3. Each approaching person receives a random costume from a varied, playful Halloween set.
* R4. A sparkle burst marks the moment a costume is applied.
* R5. The costume remains visible while the person stays near the witch and disappears after they walk away.
* R6. A person who leaves and returns receives a newly randomized costume.

## Success Criteria

* Players can discover the witch through normal exploration.
* Both player and non-player characters visibly transform on approach.
* Costumes apply once per visit rather than flickering or repeatedly changing within range.
* Leaving restores the person's normal appearance.
* Existing world interactions continue to work.

## Scope Boundaries

* Costumes are temporary and do not persist across visits or page reloads.
* The witch does not open a costume-selection interface.
* The encounter has no dialogue, inventory, scoring, or multiplayer synchronization.

## Key Decisions

* Costume both players and townspeople to make the encounter feel alive.
* Use a random costume on every visit for replay value without adding interface complexity.
* Restore the normal look on departure so the feature does not permanently override character identity.
* Use sparkles without a speech bubble to keep the interaction quick and visual.
* Place the witch near the portal to create a coherent Halloween corner.

## Next Steps

Proceed directly to implementation.
