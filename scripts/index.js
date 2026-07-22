/**
 * WebRadio Release Infrastructure
 *
 * Main entry point.
 *
 * @module Release
 */

'use strict';

const validate = require('./validate');
const semver = require('./semver');
const github = require('./github');
const checksums = require('./checksums');
const releaseNotes = require('./release-notes');

/**
 * Executes the release pipeline.
 *
 * @returns {object}
 */
function run() {

    //
    // Validate the project
    //
    const validation = validate();

    //
    // Parse the version
    //
    const version = semver.parse(
        validation.version
    );

    //
    // Read GitHub context
    //
    const context = github.getContext();

    //
    // Generate release notes
    //
    const notes = releaseNotes.generate(
        validation.version
    );

    //
    // Generate SHA256SUMS.txt
    //
    const checksumFile = checksums.generate();

    //
    // Return the complete release context
    //
    return Object.freeze({

        version,

        validation,

        github: context,

        releaseNotes: notes,

        checksumFile

    });

}

module.exports = Object.freeze({

    run

});