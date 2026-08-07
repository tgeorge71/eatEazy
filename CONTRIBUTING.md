# Contributing to eatEazy

Thanks for your interest in improving eatEazy.

## Getting started

1. Fork and clone the repository.
2. Install dependencies:
   ```
   npm install
   ```
3. Start the Expo dev server:
   ```
   npm start
   ```
4. Run on a platform:
   ```
   npm run ios      # iOS simulator
   npm run android   # Android emulator
   npm run web       # Browser
   ```

## Workflow

1. Create a branch off `main`: `git checkout -b feature/short-description`.
2. Make your changes, keeping commits focused and descriptive.
3. Run type checking before opening a PR:
   ```
   npm run typecheck
   ```
4. Open a pull request describing what changed and why.

## Code style

- TypeScript for all new source files.
- Keep components in `src/components/` and screens in `src/screens/`.
- Prefer small, focused components over large ones.

## Reporting issues

Open a GitHub issue with steps to reproduce, expected behavior, and actual behavior.
