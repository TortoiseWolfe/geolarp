# PRP-006: Character System

## Status
Queue

## Priority
High

## Overview
Build a character management system with rapid generation, D7-based attributes, location-based classes, and multiple backup/restore options.

## Success Criteria
- [ ] Random character generation < 10 seconds
- [ ] D7 system for attributes (Strength, Agility, Intellect, Spirit, Luck)
- [ ] Location-based classes working
- [ ] Character sheet UI complete
- [ ] Inventory management functional
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
    strength: number;     // 1-7
    agility: number;      // 1-7
    intellect: number;    // 1-7
    spirit: number;       // 1-7
    luck: number;         // 1-7
  };
  inventory: Item[];
  equipment: Equipment;
  skills: Skill[];
  position: Coordinates;
  created: Date;
  lastPlayed: Date;
}
```

### Location-Based Classes
- Urban area → Rogue
- Park/Forest → Ranger
- Commercial → Merchant
- Residential → Guardian
- Industrial → Artificer
- Waterfront → Mariner

### Character Sheet Features
- Drag-drop inventory slots
- Equipment management
- Skill tree visualization
- Quest log integration
- Stats calculation
- Level progression

### Backup Methods
1. JSON file download
2. QR code generation
3. Clipboard copy
4. Email (via EmailJS)
5. Local browser storage

## Testing Requirements
- Generation speed tests (<10s)
- Persistence tests
- Export/import validation
- UI interaction tests
- Data recovery tests

## Acceptance Criteria
1. Characters generated quickly
2. All attributes functional
3. Classes assigned by location
4. Backup methods working
5. Clear data warnings shown

## Rotation Plan
- Extract class system to game docs
- Attribute formulas to ADR
- Archive after implementation
- Tests validate generation

---
*Created: 2024-12-07*
*Estimated effort: 4 days*