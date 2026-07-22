/**
 * WebRadio Release Infrastructure
 *
 * Shared constants used throughout the release system.
 *
 * @module Release/Constants
 */

'use strict';

/**
 * Supported release stages.
 *
 * @readonly
 * @enum {string}
 */
const RELEASE_STAGE = Object.freeze({
    NIGHTLY: 'nightly',
    ALPHA: 'alpha',
    BETA: 'beta',
    RC: 'rc',
    STABLE: 'stable'
});

/**
 * Supported hash algorithms.
 *
 * @readonly
 * @enum {string}
 */
const HASH_ALGORITHM = Object.freeze({
    SHA256: 'sha256'
});

/**
 * Default file locations.
 *
 * @readonly
 */
const PATHS = Object.freeze({
    PACKAGE_JSON: 'package.json',
    CHANGELOG: 'CHANGELOG.md',
    DIST: 'dist',
    RELEASE: 'release'
});

/**
 * Supported release asset extensions.
 *
 * @readonly
 */
const ASSET_EXTENSIONS = Object.freeze([
    '.exe',
    '.zip',
    '.7z',
    '.AppImage',
    '.deb',
    '.rpm',
    '.tar.gz',
    '.dmg'
]);

module.exports = Object.freeze({
    RELEASE_STAGE,
    HASH_ALGORITHM,
    PATHS,
    ASSET_EXTENSIONS
});