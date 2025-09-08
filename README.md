# GeoLARP

A location-based Live Action Role Playing game with D7 dice mechanics.

## Project Status

🧹 **Clean Slate** - Ready for fresh implementation

The Next.js prototype has been removed to make way for a proper implementation that aligns with the Product Requirement Plans.

## D7 System Features

### Dice Pool Mechanics
- Attributes use dice pools (1D7 to 7D7) instead of static values
- West End Games style pips system (+1, +2, converts to dice at +3)
- Maximum of 7D7 for heroic-level characters
- Skills add dice to attribute pools
- Exponential advancement with level progression

### Core Attributes
- **Strength** - Physical prowess
- **Agility** - Speed and dexterity  
- **Intellect** - Mental acuity
- **Spirit** - Willpower and awareness
- **Luck** - Fortune and fate

### Location-Based Classes
- **Rogue** - Urban environments
- **Ranger** - Parks and forests
- **Merchant** - Commercial districts
- **Guardian** - Residential areas
- **Artificer** - Industrial zones
- **Mariner** - Waterfront areas

## Development Philosophy: PRP-Driven

This project uses **Product Requirement Plans (PRPs)** - specifications that guide implementation through a clear lifecycle.

### PRP Workflow
```
1. Create PRP in /docs/prp/queue/
2. Activate (move to /docs/prp/active/)
3. Implement in code
4. Validate with tests
5. Archive and extract decisions
```

## Project Structure

```
geolarp/
├── docs/
│   └── prp/              # Product Requirement Plans
│       ├── active/       # Currently implementing
│       ├── archive/      # Completed PRPs
│       └── queue/        # Backlog
├── .git/                 # Version control
├── .github/              # GitHub workflows
├── LICENSE               # MIT License
└── README.md            # You are here
```

## Product Requirement Plans

All PRPs are preserved in `/docs/prp/`:

### Completed PRPs (Archive)
- **PRP-001**: Project Setup ✅
- **PRP-002**: Offline Database ✅
- **PRP-003**: Service Worker ✅
- **PRP-004**: Geolocation System ✅
- **PRP-005**: D7 Dice System ✅

### Active PRPs
- **PRP-006**: Character System 🚧

### Queued PRPs
- PRP-007: Encounter Engine
- PRP-008: Quest System
- PRP-009: Map System
- PRP-010: PWA Configuration
- PRP-011: Email Capture
- PRP-012: Drag & Drop Inventory
- PRP-013: Game State Management
- PRP-014: Privacy UI
- PRP-015: Onboarding Flow
- PRP-016: Performance Optimization
- PRP-017: Testing Setup
- PRP-018: Deployment Pipeline
- PRP-019: Analytics Without Tracking
- PRP-020: Migration Strategy

## Next Steps

1. **Choose Technology Stack**
   - Select framework that aligns with D7 dice pool system
   - Consider mobile-first, offline-capable architecture
   - Ensure privacy-first approach

2. **Implement Core Mechanics**
   - D7 dice pool system (not static values!)
   - Pips system (+1, +2, converts at +3)
   - Proper attribute scaling (1D7 to 7D7)

3. **Build Character System**
   - Dice pool attributes
   - Location-based class detection
   - Skill system with dice additions

4. **Develop Location Features**
   - Privacy-respecting geolocation
   - Zone-based gameplay
   - Offline capability

## Contributing

1. Review the PRPs in `/docs/prp/queue/`
2. Understand the D7 dice pool system
3. Ensure any implementation uses dice pools, not static values
4. Follow the PRP workflow for new features

## License

MIT - See [LICENSE](LICENSE) file for details

---

*Built with Product Requirement Plans - where specifications guide proper implementation.*