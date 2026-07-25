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

* Removes an optional leading "v" from a version.
*
* @param {string} version
* @returns {string}
  */
  function normalizeVersion(version) {
  return String(version).replace(/^v/, '');
  }

/**

* Returns the changelog section for a specific version.
*
* Supports:
*
* ## [1.0.5-rc.4]
* ## [v1.0.5-rc.4]
* ## [v1.0.5-rc.4] – 2026-07-24
*
* @param {string} version
* @returns {string}
  */
  function getVersion(version) {
  const markdown = utils.readFile(
  constants.PATHS.CHANGELOG
  );

  const normalizedVersion = normalizeVersion(version);

  const versionPattern = new RegExp(
  '^## [v?' +
  normalizedVersion.replace(/[.*+?^${}()|[]\]/g, '\$&') +
  '\].*$',
  'm'
  );

  const match = versionPattern.exec(markdown);

  if (!match) {
  throw new ChangelogError(
  `Version "${version}" was not found in CHANGELOG.md.`
  );
  }

  const start = match.index;

  const nextHeadingPattern = /^## \[/gm;
  nextHeadingPattern.lastIndex = start + match[0].length;

  const nextMatch = nextHeadingPattern.exec(markdown);

  if (!nextMatch) {
  return markdown
  .substring(start)
  .trim();
  }

  return markdown
  .substring(start, nextMatch.index)
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

  const normalizedVersion = normalizeVersion(version);

  const versionPattern = new RegExp(
  '^## [v?' +
  normalizedVersion.replace(/[.*+?^${}()|[]\]/g, '\$&') +
  '\].*$',
  'm'
  );

  return versionPattern.test(markdown);
  }

module.exports = Object.freeze({
getVersion,
hasVersion
});
