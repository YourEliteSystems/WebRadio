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

* Normalizes a version string by removing an optional leading "v".
*
* Examples:
* v1.0.5-rc.4 -> 1.0.5-rc.4
* 1.0.5-rc.4  -> 1.0.5-rc.4
*
* @param {string} version
* @returns {string}
  */
  function normalizeVersion(version) {
  return String(version).replace(/^v/, '');
  }

/**

* Returns all supported CHANGELOG headings for a version.
*
* Both of the following formats are supported:
*
* ## [1.0.5-rc.4]
* ## [v1.0.5-rc.4]
*
* @param {string} version
* @returns {string[]}
  */
  function getHeadings(version) {
  const normalizedVersion = normalizeVersion(version);

  return [
  `## [${normalizedVersion}]`,
  `## [v${normalizedVersion}]`
  ];
  }

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

  const headings = getHeadings(version);

  let start = -1;
  let matchedHeading = null;

  for (const heading of headings) {
  const index = markdown.indexOf(heading);

  ```
   if (index !== -1 && (start === -1 || index < start)) {
       start = index;
       matchedHeading = heading;
   }
  ```

  }

  if (start === -1) {
  throw new ChangelogError(
  `Version "${version}" was not found in CHANGELOG.md.`
  );
  }

  const next = markdown.indexOf(
  '\n## [',
  start + matchedHeading.length
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

  return getHeadings(version).some(
  heading => markdown.includes(heading)
  );
  }

module.exports = Object.freeze({
getVersion,
hasVersion
});
