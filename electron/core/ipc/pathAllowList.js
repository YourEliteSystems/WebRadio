"use strict";

const fs = require("fs");
const path = require("path");

function isInside(parent, candidate) {
  const parentResolved = path.resolve(parent);
  const candidateResolved = path.resolve(candidate);
  // Strikte Pfadkomponenten-Pruefung (kein String-Prefix-Trick wie
  // "/tmp/foo" vs. "/tmp/foo-bar"): nur echte Nachfahren (oder das
  // Verzeichnis selbst) gelten als "inside".
  if (candidateResolved === parentResolved) return true;
  const prefix = parentResolved.endsWith(path.sep)
    ? parentResolved
    : parentResolved + path.sep;
  return candidateResolved.startsWith(prefix);
}

function realPathOrResolved(value) {
  try {
    return fs.realpathSync(value);
  } catch {
    return path.resolve(value);
  }
}

function isAllowedDirectory(candidate, allowedDirectories) {
  if (typeof candidate !== "string" || !candidate.trim() || !Array.isArray(allowedDirectories)) {
    return false;
  }

  let realCandidate;
  try {
    realCandidate = fs.realpathSync(candidate.trim());
    if (!fs.statSync(realCandidate).isDirectory()) {
      return false;
    }
  } catch {
    return false;
  }

  return allowedDirectories.some((directory) => {
    if (typeof directory !== "string" || !directory.trim()) {
      return false;
    }
    return isInside(realPathOrResolved(directory), realCandidate);
  });
}

module.exports = {
  isInside,
  isAllowedDirectory
};
