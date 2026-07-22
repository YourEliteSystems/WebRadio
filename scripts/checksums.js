/**
 * WebRadio Release Infrastructure
 *
 * Generates SHA256 checksum files for release assets.
 *
 * @module Release/Checksums
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const constants = require('./constants');
const utils = require('./utils');

const {
    ChecksumError
} = require('./errors');

/**
 * Generates SHA256SUMS.txt for all release assets.
 *
 * @param {string} directory
 * @returns {string}
 */
function generate(directory = constants.PATHS.DIST) {

    if (!utils.fileExists(directory)) {

        throw new ChecksumError(
            `Release directory "${directory}" does not exist.`
        );

    }

    const files = fs.readdirSync(directory);

    const assets = files.filter(file => {

        return constants.ASSET_EXTENSIONS.some(extension => {

            return file.endsWith(extension);

        });

    });

    if (assets.length === 0) {

        throw new ChecksumError(
            'No release assets were found.'
        );

    }

    const output = [];

    for (const asset of assets) {

        const file = path.join(directory, asset);

        const hash = utils.hashFile(file);

        output.push(
            `${hash}  ${asset}`
        );

    }

    const checksumFile = path.join(
        directory,
        'SHA256SUMS.txt'
    );

    utils.writeFile(
        checksumFile,
        output.join('\n')
    );

    return checksumFile;

}

module.exports = Object.freeze({

    generate

});