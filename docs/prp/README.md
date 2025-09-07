# Punk Rock Prompts (PRPs)

## What are PRPs?
PRPs are temporary, actionable specifications that guide feature implementation. They're "punk rock" because they:
- Challenge conventional documentation
- Focus on action over perfection  
- Rotate into code, not documents
- Die gracefully when complete

## Directory Structure

```
/prp/
├── active/     # 1-3 PRPs currently being built
├── queue/      # Backlog of PRPs waiting
├── PRP-TEMPLATE.md
└── README.md   # You are here
```

## The PRP Flow

```mermaid
graph LR
    A[Queue] -->|Start Work| B[Active]
    B -->|Implement| C[Code]
    C -->|Validate| D[Tests]
    D -->|Complete| E[Archive]
    E -->|Extract| F[ADRs]
```

## Quick Start

### Creating a New PRP
1. Copy `PRP-TEMPLATE.md` to `queue/XXX-feature-name.md`
2. Fill out requirements and success criteria
3. Keep it actionable and measurable

### Activating a PRP
1. Move from `queue/` to `active/`
2. Maximum 3 active PRPs (WIP limit)
3. Assign to developer/team

### Completing a PRP
1. Ensure all tests pass
2. Add completion notes
3. Move to `/archive/prp/YYYY-QQ/`
4. Extract decisions to ADRs

## Key Principles

### 1. Temporary by Design
PRPs aren't permanent documentation. They guide implementation then archive.

### 2. Code is Truth
Once implemented, the code (with its tests and comments) becomes the source of truth.

### 3. Test-Driven Validation
PRP requirements become test specifications:

```typescript
// tests/features/theme-system.test.ts
describe('Theme System (PRP-001)', () => {
  it('switches themes in <100ms', () => {
    // Validates PRP performance requirement
  });
});
```

### 4. Rotation Over Accumulation
PRPs rotate into:
- **Source code** (implementation)
- **Tests** (validation)
- **Comments** (context)
- **ADRs** (decisions)
- **Archive** (history)

## Current Status

### Active PRPs
- None (starting fresh)

### Queued PRPs
- None (starting fresh)

### Completed This Quarter
- None (starting fresh)

## Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Active PRPs | 0 | ≤3 |
| Avg Cycle Time | - | <2 weeks |
| Completion Rate | - | >90% |
| Test Coverage | - | 100% |

## Common Patterns

### Good PRP Titles
- ✅ `001-user-authentication.md`
- ✅ `002-theme-system.md`
- ✅ `003-map-integration.md`

### Bad PRP Titles
- ❌ `update-stuff.md`
- ❌ `fix-things.md`
- ❌ `misc-changes.md`

## Tools & Scripts

```bash
# Future automation
npm run prp:new          # Create new PRP from template
npm run prp:activate     # Move PRP to active
npm run prp:complete     # Archive completed PRP
npm run prp:validate     # Check PRP test coverage
```

## FAQ

**Q: How long should a PRP be?**
A: Long enough to be clear, short enough to implement in 1-2 weeks.

**Q: Can PRPs change after activation?**
A: Minor clarifications yes, major changes should be a new PRP.

**Q: What if a PRP fails?**
A: Archive with failure notes, create new PRP with lessons learned.

**Q: Who can create PRPs?**
A: Anyone, but activation requires team agreement.

## Links

- [PRP Lifecycle Guide](../PRP_LIFECYCLE.md)
- [Archive Index](../archive/INDEX.md)
- [ADR Template](../decisions/ADR-TEMPLATE.md)

---

*Remember: PRPs are scaffolding. Once the building stands, the scaffolding comes down.*