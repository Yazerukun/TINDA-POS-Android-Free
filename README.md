# TINDA POS Android Free v1.0.12

Planning workspace for a separate Android APK build of the free TINDA POS feature set.

The existing Windows/Electron application remains the source of truth and is not modified by this workspace.

## Target

Build an offline-first Android app for phones and tablets with the same core behavior as the v1.0.12 free desktop release:

- POS checkout with Cash, GCash, Maya, and credit
- Inventory, products, and categories
- Cash Count before Z-Read
- Correct cash and expected-cash reconciliation
- Basic reports
- Local data storage and offline operation

## Not in the first APK

Cloud sync, multi-branch support, subscriptions, advanced analytics, employee permissions, and premium-only features.

See [`PLAN.md`](PLAN.md) for the proposed implementation phases.
