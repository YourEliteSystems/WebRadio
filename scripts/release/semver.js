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

/**
 * Returns true if the given string is a valid Semantic Version.
 *
 * @param {string} version
 * @returns {boolean}
 */
function isValid(version) {

    return SEMVER_REGEX.test(version);

}

/**
 * Parses a Semantic Version string into its component parts.
 *
 * Returns an object with:
 *   major, minor, patch  – numeric version components
 *   prerelease           – prerelease identifier string (e.g. "rc.4") or null
 *   build                – build metadata string or null
 *   stage                – release stage: "rc" | "beta" | "alpha" | "nightly" | "stable"
 *
 * @param {string} version
 * @returns {object}
 * @throws {TypeError} if version is not a valid Semantic Version
 */
function parse(version) {

    const match = SEMVER_REGEX.exec(version);

    if (!match) {

        throw new TypeError(
            `"${version}" is not a valid Semantic Version.`
        );

    }

    const { major, minor, patch, prerelease, build } = match.groups;

    const stage = resolveStage(prerelease || null);

    return Object.freeze({

        major: Number(major),
        minor: Number(minor),
        patch: Number(patch),
        prerelease: prerelease || null,
        build: build || null,
        stage

    });

}

/**
 * Resolves the release stage from a prerelease identifier.
 *
 * @param {string|null} prerelease
 * @returns {string}
 */
function resolveStage(prerelease) {

    if (!prerelease) {
        return 'stable';
    }

    const lower = prerelease.toLowerCase();

    if (lower.startsWith('rc')) {
        return 'rc';
    }

    if (lower.startsWith('beta')) {
        return 'beta';
    }

    if (lower.startsWith('alpha')) {
        return 'alpha';
    }

    if (lower.startsWith('nightly')) {
        return 'nightly';
    }

    return 'stable';

}

module.exports = {

    SEMVER_REGEX,
    isValid,
    parse

};