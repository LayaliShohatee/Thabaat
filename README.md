# Thabaat

This branch contains the **complete mobile and backend projects**, including unchanged files inherited from the original code, plus the Expo SDK 57 fixes. It is not just a review document or a patch.

## Two separate versions

- [Original code: main](https://github.com/LayaliShohatee/Thabaat/tree/main)
- [Updated code: codex/expo57-mobile-fixes](https://github.com/LayaliShohatee/Thabaat/tree/codex/expo57-mobile-fixes)
- [Compare every change](https://github.com/LayaliShohatee/Thabaat/compare/main...codex/expo57-mobile-fixes)

Publishing this branch does not merge it into main. Keep the pull request unmerged while reviewing the two versions separately.

## Project files

| Folder | Contents |
|---|---|
| [thabaat-mobile](thabaat-mobile/) | Expo app screens, components, hooks, services, assets, configuration, dependency lockfile, and tests |
| [thabaat-backend](thabaat-backend/) | Express notification service, authentication middleware, configuration, dependency lockfile, and tests |
| [Database files](thabaat-mobile/database/) | Reference schema, integrity migration, and synthetic staging seed; applied to separate staging, with the original hosted database unchanged |
| [Review](docs/mobile-sdk57-review.md) | What changed, verification evidence, requirement coverage, and remaining work |
| [Complete team setup](docs/TEAM_SETUP.md) | Everything from cloning and environment configuration through database setup, iPhone signing, tests, troubleshooting, and the change summary |

## Get the updated version

```bash
git clone --branch codex/expo57-mobile-fixes https://github.com/LayaliShohatee/Thabaat.git
cd Thabaat
```

Start with the [complete team setup guide](docs/TEAM_SETUP.md). It covers both projects and the physical iPhone setup from beginning to end. Dependencies are reproduced with `npm ci` using the included lockfiles.

Environment values, Apple certificates/profiles, device identifiers, generated native projects, compiled apps, caches, and installed dependencies stay local. Example environment files and reproducible setup instructions are included instead. The supplied planning ZIP was reviewed for requirements; its original attachments are not republished here.
