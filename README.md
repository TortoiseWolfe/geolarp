# GeoLARP

A location-based Live Action Role Playing game built with Next.js using PRP-driven development.

## 🔗 Demo Pages

- [Database Demo](http://localhost:3000/database-demo) - IndexedDB integration demo
- [Dice Demo](http://localhost:3000/dice-demo) - D7 Dice System (Boggle-style dice roller)
- [Geolocation Demo](http://localhost:3000/geolocation-demo) - Privacy-first geolocation system
- [Offline Page](http://localhost:3000/offline) - Offline functionality demo

## Development Philosophy: PRP-Driven

This project uses **Punk Rock Prompts (PRPs)** - temporary specifications that guide implementation then rotate into code, tests, and archives. 

### Why PRPs?
- **No documentation drift** - Code is the source of truth
- **Clear lifecycle** - Specs → Code → Tests → Archive
- **Fast iteration** - No duplicate documentation
- **Quality gates** - Tests validate requirements

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
│   ├── prp/              # Punk Rock Prompts
│   │   ├── active/       # Currently implementing
│   │   └── queue/        # Backlog
│   ├── archive/          # Completed PRPs
│   └── decisions/        # Architecture Decision Records
├── src/                  # Source code (when created)
├── tests/                # Test specifications (when created)
└── README.md            # You are here
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Git

### Installation
```bash
# Clone the repository
git clone https://github.com/TortoiseWolfe/geolarp.git
cd geolarp

# Install Next.js (when ready)
npx create-next-app@latest . --typescript --tailwind --app
```

### Development Process

1. **Check active PRPs**: `ls docs/prp/active/`
2. **Pick a PRP**: Move from queue to active
3. **Implement**: Build the feature
4. **Test**: Validate PRP requirements
5. **Archive**: Complete the cycle

## Resources

### Saved Components
Located in backup:
- `SpinningDice/` - Animated dice component
- `images/` - Global map and assets

### Documentation
- [PRP Lifecycle Guide](docs/PRP_LIFECYCLE.md)
- [PRP Directory](docs/prp/)
- [Architecture Decisions](docs/decisions/)
- [Archive](docs/archive/)

## Tech Stack (Planned)

- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS + DaisyUI
- **Testing**: Vitest + Testing Library
- **Maps**: Mapbox/Leaflet
- **Database**: TBD via PRP
- **Auth**: TBD via PRP

## Contributing

1. Create a PRP for your feature
2. Get PRP approved
3. Move to active and implement
4. Ensure tests validate PRP
5. Archive on completion

## License

MIT - See [LICENSE](LICENSE)

## Status

🚧 **Project Restructuring** - Setting up PRP-driven development workflow

---

*Built with Punk Rock Prompts - where specifications become code, not documentation.*