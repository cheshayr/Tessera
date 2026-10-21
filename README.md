# Tessera

## About this version

This is a fork of [Tessera by direkjames](https://github.com/direkjames/Tessera), a calm, infinite canvas for ideas, references, and plans. All credit for the app itself goes to the original project.

This version adds an optional cloud backend (Supabase):

- **Accounts:** register with email, username and password, with email confirmation. Sign in with a username or email.
- **Cloud save:** your boards and images are saved to your account and sync across devices.
- **View-only share links:** anyone can open a link and see your board without logging in.
- **Still works offline:** boards are also kept on your device.

Setup steps are in [SETUP.md](SETUP.md).

## Updating

When you change files, bump `VERSION` in `sw.js` (e.g. `tessera-v2`) so installed copies pick up the new version.
