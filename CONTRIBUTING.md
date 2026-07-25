# Contributing to TechBench

Thank you for your interest in contributing to TechBench! This document provides guidelines and information for contributors.

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Set up the development environment: `./scripts/setup-dev.sh`
4. Create a feature branch: `git checkout -b feature/amazing-feature`
5. Make your changes
6. Test your changes
7. Commit with a descriptive message
8. Push to your fork and submit a Pull Request

## Development Setup

### Prerequisites
- Ubuntu 22.04+ or Debian 12+
- 8GB+ RAM recommended
- USB devices for testing (optional but helpful)

### Quick Start
```bash
./scripts/setup-dev.sh
cd gui && npm install
```

## Project Structure

- `base/` - Kernel configuration and live USB builder
- `packages/` - Tool packages (electronics, mobile, etc.)
- `gui/` - BenchPanel unified GUI (Tauri + React)
- `detection/` - Auto-detection engine
- `hal/` - Hardware abstraction layer (Rust)
- `ai/` - AI/ML components
- `database/` - Collaborative repair database
- `containers/` - Containerized toolchains
- `hardware/` - Custom hardware designs

## Coding Standards

### Rust (HAL)
- Follow `rustfmt` formatting
- Use `clippy` for linting
- Document public APIs with `///` comments

### TypeScript/React (GUI)
- Use TypeScript strictly
- Follow ESLint configuration
- Component files in PascalCase
- Use functional components with hooks

### Python (Detection, AI)
- Follow PEP 8
- Use type hints
- Document with docstrings

### Shell Scripts
- Use `shellcheck` for linting
- Include error handling
- Make scripts executable

## Testing

### Unit Tests
```bash
# Rust
cd hal && cargo test

# TypeScript
cd gui && npm test

# Python
python -m pytest tests/
```

### Integration Tests
```bash
./scripts/test-containers.sh
```

### Hardware Tests
If you have access to test devices, please test:
- Device detection with various phones
- USB passthrough to containers
- UART/JTAG communication

## Pull Request Process

1. Update documentation if needed
2. Add tests for new functionality
3. Ensure all tests pass
4. Update the changelog
5. Request review from maintainers

## Reporting Issues

- Use GitHub Issues for bug reports
- Include system information (OS, hardware)
- Provide steps to reproduce
- Include relevant logs

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help newcomers learn
- Celebrate contributions of all sizes

## License

By contributing, you agree that your contributions will be licensed under the GPLv3.

## Questions?

Join our Discord server or open a Discussion on GitHub.
