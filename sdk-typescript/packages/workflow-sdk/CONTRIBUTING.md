# Contributing to @wave-av/workflow-sdk

Thanks for your interest in contributing to the WAVE Workflow SDK.

## Getting started

1. Fork this repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes
4. Run type check: `pnpm type-check`
5. Commit with a descriptive message
6. Open a pull request against `main`

## Development

```bash
pnpm install
pnpm build
pnpm dev
```

## Code standards

- TypeScript strict mode (no `any`, no `@ts-ignore`)
- All public APIs must have Zod validation at boundaries
- Use `ServiceResult<T>` pattern for error handling

## Pull request guidelines

- One logical change per PR
- Include tests for new functionality
- Update README.md if adding new features
- All CI checks must pass before merge

## Reporting issues

- Use GitHub Issues for bugs and feature requests
- For security issues, see [SECURITY.md](SECURITY.md)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
