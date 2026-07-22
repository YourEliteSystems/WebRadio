/**
 * WebRadio Release Infrastructure
 *
 * Semantic Version helper utilities.
 *
 * @module Release/SemVer
 */

'use strict';

/**
 * Semantic Version Regular Expression.
 *
 * Supports:
 *
 * 1.0.0
 * 1.0.0-alpha.1
 * 1.0.0-beta.2
 * 1.0.0-rc.1
 * 1.0.0+build.15
 * 1.0.0-alpha.1+build.15
 */
const SEMVER_REGEX =
    /^(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)(?:-(?<prerelease>[0-9A-Za-z.-]+))?(?:\+(?<build>[0-9A-Za-z.-]+))?$/;