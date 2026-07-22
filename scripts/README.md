# Release Infrastructure

The **Release Infrastructure** is responsible for validating, preparing, packaging and publishing every WebRadio release.

It provides a centralized and automated workflow for building the application, generating release assets and publishing releases through GitHub Actions.

The Release Infrastructure is designed to be independent from GitHub Actions whenever possible. All release logic is implemented in JavaScript modules, while GitHub Actions only orchestrates the execution.

---

# Goals

The Release Infrastructure has the following objectives:

* Fully automated release process
* Semantic Versioning validation
* Automatic release type detection
* Automatic changelog integration
* Automatic release notes generation
* Automatic checksum generation
* Reproducible builds
* Cross-platform support
* Minimal GitHub Actions configuration
* Easy extensibility

---

# Design Principles

The Release Infrastructure follows the same principles as the rest of the WebRadio project.

## Documentation First

Every release component is documented before implementation.

## Separation of Concerns

Each module has exactly one responsibility.

## Automation

Manual work should be minimized wherever possible.

## Platform Independence

Release logic should not depend on GitHub Actions and should be reusable in other CI systems.

## Maintainability

The release pipeline should remain simple, modular and easy to extend.

---

# Architecture

```text
Git Tag
   │
   ▼
Release Manager
   │
   ├── Version Validation
   ├── Release Detection
   ├── Changelog Parsing
   ├── Release Notes
   ├── Build
   ├── Checksum Generation
   └── GitHub Release
```

The Release Manager coordinates the complete release process while delegating work to specialized modules.

---

# Release Pipeline

The standard release workflow is:

1. Validate project version
2. Detect release stage
3. Verify CHANGELOG entry
4. Build WebRadio
5. Generate release assets
6. Generate checksums
7. Generate release notes
8. Create GitHub Release
9. Upload release assets

---

# Release Stages

WebRadio supports multiple release stages.

| Stage             | Description                                                |
| ----------------- | ---------------------------------------------------------- |
| Nightly           | Automatic development builds.                              |
| Alpha             | Early development releases with possible breaking changes. |
| Beta              | Feature-complete testing releases.                         |
| Release Candidate | Production candidate awaiting final validation.            |
| Stable            | Official production release.                               |

---

# Directory Structure

```text
scripts/
└── release/
    ├── README.md
    ├── index.js
    ├── validate.js
    ├── detect-release.js
    ├── semver.js
    ├── changelog.js
    ├── release-notes.js
    ├── checksums.js
    ├── github.js
    ├── constants.js
    ├── utils.js
    └── errors.js
```

---

# Module Overview

## index.js

Coordinates the complete release workflow.

## validate.js

Validates project configuration, version numbers and release requirements.

## detect-release.js

Determines the release stage based on Semantic Versioning.

## semver.js

Provides utilities for Semantic Version validation and comparison.

## changelog.js

Reads and parses the project's CHANGELOG.

## release-notes.js

Generates release notes from the changelog.

## checksums.js

Creates SHA256 checksum files for all generated release assets.

## github.js

Handles GitHub Release creation and asset uploads.

## constants.js

Stores shared constants used by the release system.

## utils.js

Contains reusable helper functions.

## errors.js

Defines custom error classes used by the release infrastructure.

---

# Release Flow

```text
Developer

↓

Create Git Tag

↓

Push Tag

↓

GitHub Actions

↓

Release Infrastructure

↓

GitHub Release

↓

Release Assets
```

---

# Supported Version Formats

The Release Infrastructure supports the following version formats.

```text
1.1.0-nightly

1.1.0-alpha.1

1.1.0-beta.1

1.1.0-rc.1

1.1.0
```

---

# Future Improvements

Planned future features include:

* Code Signing
* Winget publishing
* Chocolatey publishing
* Scoop publishing
* Homebrew publishing
* Flatpak publishing
* Snap publishing
* Automatic GitHub Discussions announcements
* Discord release notifications
* Automatic documentation publishing

---

# Contributing

Contributors adding new release functionality should ensure:

* Documentation is updated first.
* Modules remain independent.
* Public interfaces remain stable.
* Release automation remains reproducible.
* All new functionality follows the existing architecture.
