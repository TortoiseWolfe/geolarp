# PRP-006: Character System

## Status

Active

## Priority

High

## Overview

Build a character management system with rapid generation, D7-based attributes (1-7 scale), location-based classes, and multiple backup/restore options. The D7 system provides balanced character progression with meaningful attribute modifiers.

## Success Criteria

- [ ] Random character generation < 10 seconds
- [ ] D7 system for attributes (1-7 scale with modifiers)
- [ ] Attribute generation methods (standard array, random, point buy)
- [ ] Location-based classes with unique abilities
- [ ] Character sheet UI with D7 mechanics display
- [ ] Inventory management with encumbrance
- [ ] Skill specialization system (untrained/trained/expert/master)
- [ ] LocalStorage persistence with versioning
- [ ] JSON export/import working
- [ ] QR code generation functional
- [ ] Data persistence warnings clear

## Technical Requirements

### Character Model

```typescript
interface Character {
  id: string;
  name: string;
  class: CharacterClass;
  level: number;
  experience: number;
  attributes: {
    strength: number; // 1-7 scale
    agility: number; // 1-7 scale
    intellect: number; // 1-7 scale
    spirit: number; // 1-7 scale
    luck: number; // 1-7 scale
  };
  attributeModifiers: {
    strength: number; // -1 to +2 based on attribute
    agility: number;
    intellect: number;
    spirit: number;
    luck: number;
  };
  derivedStats: {
    hitPoints: number; // 7 + (level * strength modifier)
    defense: number; // 4 + (level/3) + agility modifier
    initiative: number; // agility modifier
    carryCapacity: number; // 7 * strength
  };
  inventory: Item[];
  equipment: Equipment;
  skills: Skill[];
  skillSpecializations: Map<string, SkillLevel>; // untrained/trained/expert/master
  position: Coordinates;
  created: Date;
  lastPlayed: Date;
}

interface AttributeModifiers {
  '1-2': -1; // Weak
  '3-4': 0; // Average
  '5-6': 1; // Strong
  '7': 2; // Exceptional
}
```

### Location-Based Classes

- **Urban area → Rogue**: +1 Agility, Advantage on stealth in cities
- **Park/Forest → Ranger**: +1 Spirit, Advantage on nature/tracking
- **Commercial → Merchant**: +1 Intellect, Advantage on negotiation
- **Residential → Guardian**: +1 Strength, +2 Defense when protecting
- **Industrial → Artificer**: +1 Intellect, Can craft/repair items
- **Waterfront → Mariner**: +1 Agility, Advantage near water

### Attribute Generation Methods

1. **Standard Array**: [5, 5, 4, 4, 3] - assign as desired
2. **Random Roll**: Roll 3D7, drop lowest, for each attribute
3. **Point Buy**: 20 points, costs:
   - Score 3: 0 points
   - Score 4: 2 points
   - Score 5: 5 points
   - Score 6: 9 points
   - Score 7: 14 points (max 1 at creation)

### Character Sheet Features

- Drag-drop inventory slots with weight tracking
- Equipment management with D7 bonuses
- Skill specialization display (1d7 → 1d7+mod → 2d7)
- Quest log integration with difficulty indicators
- D7 roll calculator for all checks
- Level progression with XP thresholds (70, 210, 490, 980...)
- Advantage/Disadvantage toggle for rolls
- Critical success (7) and failure (1) tracking

### Backup Methods

1. JSON file download
2. QR code generation
3. Clipboard copy
4. Email (via EmailJS)
5. Local browser storage

## Testing Requirements

- Generation speed tests (<10s)
- Attribute modifier calculations
- D7 probability validation for rolls
- Class ability triggers by location
- Skill specialization progression
- Persistence tests
- Export/import validation
- UI interaction tests
- Data recovery tests

## Acceptance Criteria

1. Characters generated quickly with valid D7 attributes
2. Attribute modifiers calculated correctly (-1 to +2)
3. Classes assigned by location with unique abilities
4. Skill specializations affect dice pools appropriately
5. Defense values scale properly (4-7 range)
6. XP progression follows D7 scaling (×7 multiplier)
7. Backup methods working
8. Clear data warnings shown

## Rotation Plan

- Extract class system to game docs
- Attribute formulas to ADR
- Archive after implementation
- Tests validate generation

---

_Created: 2024-12-07_
_Updated: 2025-01-08_
_Estimated effort: 4 days_
