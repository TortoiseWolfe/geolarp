# PRP-004: Geolocation System

## Status

Active

## Priority

High

## Overview

Build a privacy-first geolocation system that respects user privacy, handles permissions gracefully, and provides multiple fallback strategies.

## Success Criteria

- [ ] Permission request with clear explanation
- [ ] Battery-aware tracking implemented
- [ ] Three fallback strategies working
- [ ] 100m grid rounding for privacy
- [ ] Efficient location watching
- [ ] Distance calculations accurate
- [ ] Geofencing functional
- [ ] All errors handled gracefully
- [ ] Offline mode using last position

## Technical Requirements

### Location Service API

```typescript
interface LocationService {
  requestPermission(): Promise<PermissionState>;
  getCurrentPosition(): Promise<Position>;
  watchPosition(callback: PositionCallback): number;
  clearWatch(id: number): void;
  getDistanceTo(target: Coordinates): number;
  enterGeofence(area: GeofenceArea): Observable<boolean>;
  setAccuracy(mode: 'high' | 'balanced' | 'low'): void;
}
```

### Fallback Strategies

1. **Browser Geolocation API** (primary)
2. **IP-based geolocation** (fallback 1)
3. **Manual coordinate entry** (fallback 2)
4. **Zone selection from list** (fallback 3)

### Privacy Features

- Round to 100m grid: `Math.floor(coord * 10) / 10`
- No exact coordinates stored
- No location history kept
- Clear permission explanations
- Opt-in only tracking

### Battery Optimization

```typescript
if (battery.level < 0.2) {
  setAccuracy('low');
  setUpdateInterval(60000); // 1 minute
} else if (battery.level < 0.5) {
  setAccuracy('balanced');
  setUpdateInterval(30000); // 30 seconds
} else {
  setAccuracy('high');
  setUpdateInterval(10000); // 10 seconds
}
```

## Testing Requirements

- Permission flow tests
- Fallback strategy tests
- Privacy rounding validation
- Battery optimization tests
- Offline mode tests

## Acceptance Criteria

1. Location works without permission
2. Privacy preserved (100m rounding)
3. Battery drain minimal
4. All fallbacks functional
5. Offline mode working

## Rotation Plan

- Extract privacy approach to ADR
- Document fallback strategy
- Archive after implementation
- Tests validate privacy features

---

_Created: 2024-12-07_
_Estimated effort: 3 days_
