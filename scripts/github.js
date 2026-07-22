/**
 * WebRadio Release Infrastructure
 *
 * GitHub Actions environment utilities.
 *
 * @module Release/GitHub
 */

'use strict';

/**
 * Returns true if the current process is running inside GitHub Actions.
 *
 * @returns {boolean}
 */
function isGitHubActions() {

    return process.env.GITHUB_ACTIONS === 'true';

}

/**
 * Returns the current Git reference.
 *
 * @returns {string|null}
 */
function getRef() {

    return process.env.GITHUB_REF || null;

}

/**
 * Returns the current Git tag.
 *
 * Example:
 * refs/tags/v1.1.0-alpha.1
 *
 * ->
 *
 * v1.1.0-alpha.1
 *
 * @returns {string|null}
 */
function getTag() {

    const ref = getRef();

    if (!ref) {

        return null;

    }

    if (!ref.startsWith('refs/tags/')) {

        return null;

    }

    return ref.replace(
        'refs/tags/',
        ''
    );

}

/**
 * Returns the current commit SHA.
 *
 * @returns {string|null}
 */
function getCommit() {

    return process.env.GITHUB_SHA || null;

}

/**
 * Returns the current repository.
 *
 * owner/repository
 *
 * @returns {string|null}
 */
function getRepository() {

    return process.env.GITHUB_REPOSITORY || null;

}

/**
 * Returns the workflow name.
 *
 * @returns {string|null}
 */
function getWorkflow() {

    return process.env.GITHUB_WORKFLOW || null;

}

/**
 * Returns the current runner operating system.
 *
 * @returns {string|null}
 */
function getRunnerOS() {

    return process.env.RUNNER_OS || null;

}

/**
 * Returns basic GitHub Actions context.
 *
 * @returns {object}
 */
function getContext() {

    return Object.freeze({

        actions: isGitHubActions(),

        repository: getRepository(),

        workflow: getWorkflow(),

        ref: getRef(),

        tag: getTag(),

        commit: getCommit(),

        runner: getRunnerOS()

    });

}

module.exports = Object.freeze({

    isGitHubActions,

    getContext,

    getRef,

    getTag,

    getCommit,

    getRepository,

    getWorkflow,

    getRunnerOS

});