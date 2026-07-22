/**
 * WebRadio Release Infrastructure
 *
 * CHANGELOG parser.
 *
 * @module Release/Changelog
 */

'use strict';

const constants = require('./constants');
const utils = require('./utils');

const {
    ChangelogError
} = require('./errors');

/**
 * Returns the changelog section for a specific version.
 *
 * @param {string} version
 * @returns {string}
 */
function getVersion(version) {

    const markdown = utils.readFile(
        constants.PATHS.CHANGELOG
    );

    const heading = `## [${version}]`;

    const start = markdown.indexOf(
        heading
    );

    if (start === -1) {

        throw new ChangelogError(
            `Version "${version}" was not found in CHANGELOG.md.`
        );

    }

    const next = markdown.indexOf(
        '\n## [',
        start + heading.length
    );

    if (next === -1) {

        return markdown
            .substring(start)
            .trim();

    }

    return markdown
        .substring(start, next)
        .trim();

}

/**
 * Returns true if a version exists.
 *
 * @param {string} version
 * @returns {boolean}
 */
function hasVersion(version) {

    const markdown = utils.readFile(
        constants.PATHS.CHANGELOG
    );

    return markdown.includes(
        `## [${version}]`
    );

}

module.exports = Object.freeze({

    getVersion,

    hasVersion

});