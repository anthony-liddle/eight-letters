# Contributing

Thanks for your interest. This is a small, personal project, but contributions and ideas are welcome.

## Development setup

Requires Node 22 and pnpm.

```bash
pnpm install
pnpm dev
```

The baked word data under `public/data` is committed, so you do not need to run
the data pipeline to develop. See the Data pipeline section in the README if you
are rebuilding it.

## Useful scripts

- `pnpm test` run the unit tests
- `pnpm lint` and `pnpm typecheck` check the code
- `pnpm build` type-check and build the static site
- `pnpm format` format with Prettier
- `pnpm data:build` rebuild the baked word data
- `pnpm icons:build` regenerate the favicons and Open Graph image

## Commit conventions

This repo uses [Conventional Commits](https://www.conventionalcommits.org/),
enforced by commitlint via a git hook.

```
<type>(<scope>): <subject>
```

Allowed types: feat, fix, docs, style, refactor, test, chore, build, ci, perf, revert.

## Code style

- The engine stays pure and unit-tested. The UI is thin over it.
- Match the existing letterpress tokens and the owner's voice: plain, direct,
  sentence case in the UI, and no em dashes anywhere.
- A pre-commit hook runs lint-staged and a type check. Keep both green.

## Pull requests

1. Branch from `main` using `type/kebab-case-description`.
2. Make your change with tests where it makes sense.
3. Ensure `pnpm test`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` pass.
4. Open a PR against `main` and fill in the template.
