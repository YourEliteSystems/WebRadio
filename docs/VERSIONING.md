# Documentation Versioning

WebRadio documentation uses [mike](https://github.com/jimporter/mike) for multi-version documentation deployment.

## Installation

```bash
pip install -r docs/requirements.txt
```

This installs `mike` alongside MkDocs and Material for MkDocs.

## Local Development

To serve the documentation locally (without versioning):

```bash
mkdocs serve
```

To serve a specific version locally:

```bash
mike serve <version>
```

## Deploying Versions

### Deploy Latest Version

```bash
mike deploy --push latest
```

This builds and deploys the documentation as the `latest` version, which is the default alias.

### Deploy a Specific Version

```bash
mike deploy --push 1.0.0
```

This deploys version `1.0.0` and creates a version selector in the documentation header.

### Deploy with Aliases

You can deploy a version with multiple aliases:

```bash
mike deploy --push 1.0.0 --update-aliases
```

### Deploy Pre-release Versions

For alpha, beta, or rc releases:

```bash
# Alpha release
mike deploy --push 1.1.0-alpha.1 --alias alpha

# Beta release
mike deploy --push 1.1.0-beta.1 --alias beta

# RC release
mike deploy --push 1.1.0-rc.1 --alias rc
```

Users can then select the `alpha`, `beta`, or `rc` version from the version selector.

### Set Default Version

To change the default version (e.g., from `latest` to `stable`):

1. Update `mkdocs.yml`:

```yaml
extra:
  version:
    provider: mike
    default: stable
```

2. Redeploy:

```bash
mike deploy --push --update-aliases
```

### Delete a Version

To remove an old version:

```bash
mike delete 1.0.0 --push
```

## Version Aliases

The default configuration uses `latest` as the default alias. You can configure additional aliases in `mkdocs.yml`:

```yaml
extra:
  version:
    provider: mike
    default: latest
    # Uncomment to enable additional aliases:
    # - alpha
    # - beta
    # - rc
```

When deploying, you can assign aliases:

```bash
mike deploy --push 1.0.0 --alias latest stable
```

## Version Selector

When versioning is enabled, a version selector appears in the documentation header, allowing users to switch between different documentation versions.

## Best Practices

* Always deploy stable releases as `latest`
* Use descriptive aliases for pre-releases (`alpha`, `beta`, `rc`)
* Keep at least the last 2-3 stable versions for reference
* Delete very old versions to save space
* Test locally before deploying with `mike serve <version>`

## More Information

See the [mike documentation](https://github.com/jimporter/mike) for more advanced usage and configuration options.
