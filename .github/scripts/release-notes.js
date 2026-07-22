/**
 * WebRadio Release Infrastructure
 *
 * Generates GitHub release notes from CHANGELOG.md.
 *
 * @module Release/ReleaseNotes
 */

'use strict';

const semver = require('./semver');
const changelog = require('./changelog');

/**
 * Generates release notes for a specific version.
 *
 * @param {string} version
 * @returns {string}
 */
function generate(version) {

    const info = semver.parse(version);

    const notes = changelog.getVersion(version);

    const lines = [];

    lines.push(`# WebRadio ${version}`);
    lines.push('');

    lines.push(`**Release Stage:** ${capitalize(info.stage)}`);
    lines.push(`**Version:** ${version}`);
    lines.push(`**Release Date:** ${new Date().toISOString().split('T')[0]}`);
    lines.push('');

    lines.push('---');
    lines.push('');

    lines.push(notes.trim());

    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('Thank you for supporting WebRadio ❤️');

    return lines.join('\n');

}

/**
 * Capitalizes the first character.
 *
 * @param {string} value
 * @returns {string}
 */
function capitalize(value) {

    return value.charAt(0).toUpperCase() + value.slice(1);

}

module.exports = Object.freeze({

    generate

});