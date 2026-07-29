# Temporary Plan: Fix GoReleaser GPG Key Mismatch Checklist

This is a temporary checklist to track detailed progress on the GPG key mismatch fix.

## File Progress

- [x] **`.github/workflows/scripts/goreleaser.sh`** (Detect primary secret key ID)

## Implementation Progress

### Step 1: Update `.github/workflows/scripts/goreleaser.sh`
- [x] Auto-detect primary secret key ID from the imported GPG key.
- [x] Override `GPG_KEY_ID` with the detected key ID.

### Step 2: Verification & Testing
- [x] Run `shellcheck` on `.github/workflows/scripts/goreleaser.sh`.
- [x] Run `actionlint` on modified workflows.
