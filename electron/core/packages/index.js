"use strict";

const PackageManager = require("./PackageManager");
const PackageInstaller = require("./PackageInstaller");
const PackageRegistry = require("./PackageRegistry");
const PackageValidator = require("./PackageValidator");
const PackageModel = require("./PackageModel");
const LocalSource = require("./LocalSource");
const { PackageSource, GitHubSource, HTTPSource, StoreSource } = require("./LocalSource");
const { PACKAGE_EVENTS } = require("./events");

module.exports = {
  PackageManager,
  PackageInstaller,
  PackageRegistry,
  PackageValidator,
  PackageModel,
  LocalSource,
  PackageSource,
  GitHubSource,
  HTTPSource,
  StoreSource,
  PACKAGE_EVENTS,
  FilesPolicy: PackageRegistry.FilesPolicy,
  InstallationError: PackageInstaller.InstallationError
};
