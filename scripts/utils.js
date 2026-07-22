/**
 * WebRadio Release Infrastructure
 *
 * Common utility functions used throughout the release system.
 *
 * @module Release/Utils
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execSync } = require('node:child_process');

/**
 * Checks whether a file exists.
 *
 * @param {string} file
 * @returns {boolean}
 */
function fileExists(file) {

    return fs.existsSync(file);

}

/**
 * Reads a UTF-8 text file.
 *
 * @param {string} file
 * @returns {string}
 */
function readFile(file) {

    return fs.readFileSync(file, 'utf8');

}

/**
 * Writes a UTF-8 text file.
 *
 * @param {string} file
 * @param {string} contents
 */
function writeFile(file, contents) {

    fs.writeFileSync(
        file,
        contents,
        'utf8'
    );

}

/**
 * Reads and parses a JSON file.
 *
 * @param {string} file
 * @returns {object}
 */
function readJson(file) {

    return JSON.parse(
        readFile(file)
    );

}

/**
 * Creates a directory if it does not exist.
 *
 * @param {string} directory
 */
function ensureDirectory(directory) {

    fs.mkdirSync(
        directory,
        {
            recursive: true
        }
    );

}

/**
 * Calculates the SHA256 hash of a file.
 *
 * @param {string} file
 * @returns {string}
 */
function hashFile(file) {

    return crypto
        .createHash('sha256')
        .update(
            fs.readFileSync(file)
        )
        .digest('hex');

}

/**
 * Executes a shell command.
 *
 * @param {string} command
 * @returns {string}
 */
function execute(command) {

    return execSync(
        command,
        {
            encoding: 'utf8'
        }
    ).trim();

}

/**
 * Returns true if the current platform is Windows.
 */
function isWindows() {

    return process.platform === 'win32';

}

/**
 * Returns true if the current platform is Linux.
 */
function isLinux() {

    return process.platform === 'linux';

}

/**
 * Returns true if the current platform is macOS.
 */
function isMacOS() {

    return process.platform === 'darwin';

}

module.exports = Object.freeze({

    fileExists,

    readFile,

    writeFile,

    readJson,

    ensureDirectory,

    hashFile,

    execute,

    isWindows,

    isLinux,

    isMacOS

});