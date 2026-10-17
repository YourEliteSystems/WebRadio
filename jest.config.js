/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  roots: ['<rootDir>/scripts/tests'],
  testMatch: ['**/*.test.js'],
  transform: {},
  moduleNameMapper: {},
  testPathIgnorePatterns: ['node_modules'],
  verbose: true,
  passWithNoTests: true,
};

module.exports = config;
