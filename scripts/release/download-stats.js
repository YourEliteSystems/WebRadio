#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const owner = "YourEliteSystems";
const repository = "WebRadio";
const apiUrl = "https://api.github.com/repos/" + owner + "/" + repository + "/releases?per_page=100";

const OUTPUT_JSON = path.resolve("docs/downloads.json");
const OUTPUT_MD = path.resolve("docs/DOWNLOAD_STATS.md");

const EXCLUDED = [
  /(^|-)builder-debug\.(json|ya?ml)$/i,
  /\.blockmap$/i,
  /(^|\/)SHA256SUMS\.txt$/i,
  /(^|\/)(latest|beta|alpha)(-linux)?\.ya?ml$/i,
  /(^|\/)(latest|beta|alpha)(-linux)?\.json$/i,
];

const PACKAGE_TYPES = [
  { key: "windows", label: "Windows", test: /(?:win|windows).*\.(?:exe|msi|zip|7z)$/i },
  { key: "appimage", label: "Linux AppImage", test: /\.AppImage$/i },
  { key: "deb", label: "Linux .deb", test: /\.deb$/i },
  { key: "arch", label: "Arch Linux", test: /\.pkg\.tar\.(?:zst|xz|gz)$/i },
  { key: "macos", label: "macOS", test: /(?:mac|darwin).*\.(?:dmg|zip|pkg)$/i },
];

function isExcluded(name) {
  return EXCLUDED.some((pattern) => pattern.test(name));
}

function classify(name) {
  const type = PACKAGE_TYPES.find((item) => item.test.test(name));
  return type ? type.key : "other";
}

async function fetchReleases() {
  const response = await fetch(apiUrl, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2026-03-10",
      "User-Agent": "WebRadio-download-stats",
    },
  });

  if (!response.ok) {
    throw new Error("GitHub API returned " + response.status + ": " + await response.text());
  }

  return response.json();
}

function buildStats(releases) {
  const releaseStats = releases
    .filter((release) => !release.draft)
    .map((release) => {
      const packages = (release.assets || [])
        .filter((asset) => asset.state === "uploaded" && !isExcluded(asset.name))
        .map((asset) => ({
          name: asset.name,
          platform: classify(asset.name),
          downloads: Number(asset.download_count) || 0,
        }));

      const platformDownloads = {};
      for (const pkg of packages) {
        platformDownloads[pkg.platform] =
          (platformDownloads[pkg.platform] || 0) + pkg.downloads;
      }

      return {
        version: release.tag_name,
        name: release.name,
        publishedAt: release.published_at,
        prerelease: Boolean(release.prerelease),
        downloads: packages.reduce((sum, pkg) => sum + pkg.downloads, 0),
        platforms: platformDownloads,
        assets: packages,
      };
    });

  const totals = {};
  let total = 0;

  for (const release of releaseStats) {
    total += release.downloads;
    for (const [platform, count] of Object.entries(release.platforms)) {
      totals[platform] = (totals[platform] || 0) + count;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    repository: owner + "/" + repository,
    definition:
      "Counts only downloadable application packages. GitHub updater metadata, blockmaps, checksums and builder-debug files are excluded.",
    totalDownloads: total,
    platformDownloads: totals,
    releases: releaseStats,
  };
}

function platformLabel(key) {
  const type = PACKAGE_TYPES.find((item) => item.key === key);
  return type ? type.label : key;
}

function renderMarkdown(stats) {
  const lines = [
    "# 📊 WebRadio Download Statistics",
    "",
    "> Automatisch aus den GitHub Release-Assets erzeugt. Stand: " + stats.generatedAt + ".",
    "",
    "Diese Statistik zählt bewusst nur Installations-/Distributionspakete. Update-Metadaten (.yml/.json), Blockmaps, Checksums und Builder-Debug-Dateien werden ausgeschlossen.",
    "",
    "## Gesamt",
    "",
    "**" + stats.totalDownloads + " Downloads**",
    "",
    "| Plattform | Downloads |",
    "| --- | ---: |",
  ];

  for (const [key, count] of Object.entries(stats.platformDownloads).sort(
    ([, a], [, b]) => b - a,
  )) {
    lines.push("| " + platformLabel(key) + " | " + count + " |");
  }

  lines.push(
    "",
    "## Releases",
    "",
    "| Release | Typ | Downloads |",
    "| --- | --- | ---: |",
  );

  for (const release of stats.releases) {
    const type = release.prerelease ? "Pre-release" : "Stable";
    lines.push("| " + release.version + " | " + type + " | " + release.downloads + " |");
  }

  lines.push(
    "",
    "## Methodik",
    "",
    "- Quelle: öffentliche GitHub Releases API.",
    "- Grundlage: download_count pro Release-Asset.",
    "- Mehrfachdownloads derselben Datei werden von GitHub mehrfach gezählt.",
    "- Ein Download entspricht nicht automatisch einer Installation oder einem eindeutigen Nutzer.",
    "- GitHub zählt außerdem keine Tarball-/Zipball-Downloads in diesen Asset-Zahlen.",
    "",
    "Quelle: GitHub Releases API.",
    "",
  );

  return lines.join("\n");
}

async function main() {
  const releases = await fetchReleases();
  const stats = buildStats(releases);

  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(stats, null, 2) + "\n", "utf8");
  fs.writeFileSync(OUTPUT_MD, renderMarkdown(stats), "utf8");

  console.log("WebRadio downloads: " + stats.totalDownloads);
  for (const [platform, count] of Object.entries(stats.platformDownloads)) {
    console.log("  " + platformLabel(platform) + ": " + count);
  }
  console.log("Written: " + OUTPUT_JSON);
  console.log("Written: " + OUTPUT_MD);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
