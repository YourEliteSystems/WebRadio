/**
 * WebRadio Release Infrastructure
 *
 * Validates whether a release can be created.
 *
 * @module Release/Validate
 */

'use strict';

const path = require('node:path');

const semver = require('./semver');

const utils = require('./utils');

const constants = require('./constants');

const {
    ValidationError,
    VersionError,
    ChangelogError,
    PackageError
} = require('./errors');

/**
 * Validates the current release.
 *
 * @returns {object}
 * @throws {ValidationError}
 */
function validate() {

    //
    // package.json
    //
    if (!utils.fileExists(constants.PATHS.PACKAGE_JSON)) {

        throw new PackageError(
            'package.json could not be found.'
        );

    }

    //
    // CHANGELOG.md
    //
    if (!utils.fileExists(constants.PATHS.CHANGELOG)) {

        throw new ChangelogError(
            'CHANGELOG.md could not be found.'
        );

    }

    const packageJson = utils.readJson(
        constants.PATHS.PACKAGE_JSON
    );

    const version = packageJson.version;

    if (!version) {

        throw new VersionError(
            'No version specified in package.json.'
        );

    }

    if (!semver.isValid(version)) {

        throw new VersionError(
            `"${version}" is not a valid Semantic Version.`
        );

    }

    const changelog = utils.readFile(
        constants.PATHS.CHANGELOG
    );

    if (!changelog.includes(version)) {

        throw new ChangelogError(
            `Version "${version}" is missing from CHANGELOG.md.`
        );

    }

    return Object.freeze({

        version,

        packageJson,

        valid: true

    });

}

module.exports = validate;