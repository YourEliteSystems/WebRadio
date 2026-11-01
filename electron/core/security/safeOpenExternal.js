"use strict";

function isAllowedHttpsUrl(value, allowedHosts) {
  if (typeof value !== "string" || !Array.isArray(allowedHosts)) {
    return false;
  }

  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      allowedHosts.includes(url.hostname)
    );
  } catch {
    return false;
  }
}

async function openExternalHttps(shell, value, allowedHosts) {
  if (!isAllowedHttpsUrl(value, allowedHosts)) {
    throw new Error("Externe URL ist nicht freigegeben.");
  }
  return shell.openExternal(value);
}

module.exports = {
  isAllowedHttpsUrl,
  openExternalHttps
};
