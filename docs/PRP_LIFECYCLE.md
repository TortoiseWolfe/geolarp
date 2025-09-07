# PRP (Punk Rock Prompts) Lifecycle

## Philosophy
PRPs are **temporary specifications** that guide implementation, not permanent documentation. They are scaffolding - necessary during construction but archived once the building stands.

## Directory Structure

```
/docs/
├── prp/
│   ├── active/          # PRPs currently being implemented
│   ├── queue/           # PRPs waiting for implementation
│   └── README.md        # PRP process guide
├── archive/
│   ├── prp/            # Completed PRPs (historical record)
│   ├── decisions/      # Extracted architectural decisions
│   └── learnings/      # Lessons learned from implementations
└── decisions/          # Active ADRs (Architecture Decision Records)
```

## Lifecycle Stages

### 1. Creation (Queue)
- New PRPs start in `/docs/prp/queue/`
- Numbered sequentially: `001-feature-name.md`
- Contains detailed specifications and success criteria

### 2. Activation (Active)
- Move to `/docs/prp/active/` when work begins
- Only 1-3 PRPs active at once (WIP limit)
- Team actively implementing these specs

### 3. Implementation (Code)
- PRP requirements become:
  - Source code with reference comments
  - Test specifications
  - Storybook stories
  - Type definitions

### 4. Validation (Tests)
```typescript
// Tests validate PRP requirements
describe('Feature X - PRP-001', () => {
  it('meets performance requirement (<100ms)', () => {
    // Test implementation
  });
});
```

### 5. Archival (Complete)
- Move to `/docs/archive/prp/YYYY-QQ/`
- Add completion notes
- Extract decisions to ADRs
- Code becomes source of truth

## The Rotation Pattern

```
Queue → Active → Implementation → Tests → Archive
         ↓           ↓              ↓        ↓
      (1-3 WIP)   (Code)        (Specs)  (History)
```

## Key Principles

1. **PRPs are temporary** - They guide but don't persist as documentation
2. **Code is truth** - Implementation supersedes specification
3. **Tests validate** - PRP requirements become test cases
4. **History matters** - Archive shows what was planned vs built
5. **Decisions extract** - Important choices become ADRs

## Example Flow

### Week 1: PRP Created
```
/docs/prp/queue/001-theme-system.md
```

### Week 2: PRP Active
```
/docs/prp/active/001-theme-system.md
Developer implements theme system
```

### Week 3: PRP Implemented
```typescript
// src/components/ThemeProvider.tsx
/**
 * Theme System Implementation
 * @prp 001-theme-system
 * @implemented 2024-01-15
 */
```

### Week 4: PRP Archived
```
/docs/archive/prp/2024-Q1/001-theme-system.md
Status: COMPLETED
Notes: Exceeded requirements, added dark mode
```

## Success Metrics

- **No documentation drift** - Code stays current
- **Clear history** - Can trace decisions
- **Fast development** - No duplicate documentation
- **Quality gates** - Tests enforce PRP requirements

## Anti-patterns to Avoid

❌ Keeping PRPs as permanent documentation
❌ Not archiving completed PRPs
❌ Skipping test validation
❌ Not extracting architectural decisions
❌ Having too many active PRPs (>3)

## Commands & Automation

```bash
# Move PRP from queue to active
./scripts/prp-activate.sh 001

# Archive completed PRP
./scripts/prp-complete.sh 001

# Validate PRP requirements
npm run test:prp-001
```