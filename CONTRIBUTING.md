# Contributing to SpecKit Companion

Thank you for your interest in contributing to SpecKit Companion!

## Getting Started

### Prerequisites

- Node.js 18+
- VS Code 1.84+
- Claude Code CLI (for testing SpecKit features)

### Development Setup

1. Fork and clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Open in VS Code:
   ```bash
   code .
   ```
4. Press `F5` to launch the Extension Development Host

### Building

```bash
# Compile TypeScript
npm run compile

# Watch mode
npm run watch

# Package as VSIX
npm run package
```

### Testing

```bash
npm test
```

## Making Changes

### Code Style

- Use TypeScript for all new code
- Follow existing patterns in the codebase
- Use constants from `src/constants/` instead of magic strings
- Add JSDoc comments for public APIs

### Commit Messages

Use clear, descriptive commit messages:
- `feat: add new feature`
- `fix: resolve bug in X`
- `docs: update README`
- `refactor: reorganize module structure`

### Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Ensure tests pass
4. Update documentation if needed
5. Submit a PR with a clear description

## Reporting Issues

Use GitHub Issues with the provided templates:
- **Bug Report**: For unexpected behavior
- **Feature Request**: For new functionality

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
