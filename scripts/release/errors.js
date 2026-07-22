/**
 * WebRadio Release Infrastructure
 *
 * Custom error classes used throughout the release system.
 *
 * @module Release/Errors
 */

'use strict';

/**
 * Base class for all release related errors.
 */
class ReleaseError extends Error {

    /**
     * @param {string} message
     */
    constructor(message) {

        super(message);

        this.name = this.constructor.name;

        Error.captureStackTrace?.(
            this,
            this.constructor
        );

    }

}

/**
 * Thrown when release validation fails.
 */
class ValidationError extends ReleaseError {}

/**
 * Thrown when Semantic Version validation fails.
 */
class VersionError extends ReleaseError {}

/**
 * Thrown when the changelog is invalid.
 */
class ChangelogError extends ReleaseError {}

/**
 * Thrown when a build fails.
 */
class BuildError extends ReleaseError {}

/**
 * Thrown when checksum generation fails.
 */
class ChecksumError extends ReleaseError {}

/**
 * Thrown when GitHub release creation fails.
 */
class GitHubReleaseError extends ReleaseError {}

/**
 * Thrown when release assets are invalid.
 */
class AssetError extends ReleaseError {}

/**
 * Thrown when package.json is invalid.
 */
class PackageError extends ReleaseError {}

module.exports = Object.freeze({

    ReleaseError,

    ValidationError,

    VersionError,

    ChangelogError,

    BuildError,

    ChecksumError,

    GitHubReleaseError,

    AssetError,

    PackageError

});