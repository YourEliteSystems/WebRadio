# Documentation Versioning

WebRadio documentation uses **ReadTheDocs** for multi-version documentation deployment.

## How It Works

ReadTheDocs automatically builds documentation for:

* **Tags** – Stable releases (e.g., `v1.0.0`, `v1.1.0`)
* **Branches** – Development versions (e.g., `main`, `develop`)
* **Pull Requests** – Preview versions

The version selector in the documentation header is automatically managed by ReadTheDocs.

## Configuration

Versioning is configured in `.readthedocs.yml`:

```yaml
version: 2

build:
  os: ubuntu-22.04
  tools:
    python: "3.14"

mkdocs:
  configuration: mkdocs.yml
  fail_on_warning: false

python:
  install:
    - requirements: docs/requirements.txt
```

## Version Types

### Stable Versions

Created from Git tags:

```bash
git tag v1.0.0
git push origin v1.0.0
```

ReadTheDocs automatically builds version `v1.0.0` and marks it as stable.

### Development Versions

Created from branches:

* `main` – Latest development version
* `develop` – Feature development branch (if used)
* Custom branches – Any branch in the repository

### Pull Request Versions

Every PR gets a temporary preview build for testing documentation changes.

## Setting Default Version

In the ReadTheDocs dashboard:

1. Go to **Admin** → **Versions**
2. Select the version you want as default
3. Click **Make default**

Typically, the latest stable tag is set as default.

## Version Aliases

ReadTheDocs supports version aliases:

* `latest` – Usually points to the most recent stable version
* `stable` – Points to the most recent stable release
* `dev` – Points to the development branch

Configure aliases in the ReadTheDocs dashboard under **Admin** → **Versions**.

## Pre-release Versions

For alpha, beta, or rc releases:

```bash
# Tag pre-release versions
git tag v1.1.0-alpha.1
git push origin v1.1.0-alpha.1

git tag v1.1.0-beta.1
git push origin v1.1.0-beta.1

git tag v1.1.0-rc.1
git push origin v1.1.0-rc.1
```

ReadTheDocs will build these as separate versions. You can configure aliases in the dashboard.

## Local Development

To serve the documentation locally:

```bash
mkdocs serve
```

This serves the current branch without versioning.

## Deleting Old Versions

In the ReadTheDocs dashboard:

1. Go to **Admin** → **Versions**
2. Select the version to delete
3. Click **Deactivate** → **Delete**

## Best Practices

* Tag stable releases with semantic versioning (`v1.0.0`, `v1.1.0`)
* Keep the last 2-3 stable versions for reference
* Delete very old versions to save space
* Test documentation changes in PR previews before merging
* Use descriptive branch names for long-lived development branches

## More Information

See the [ReadTheDocs Versioning Documentation](https://docs.readthedocs.io/en/stable/versioning.html) for more details.
