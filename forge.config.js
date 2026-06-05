console.log("Loading forge.config.js...");

const path = require("path");
const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    asar:
    {
     unpack: "**/node_modules/ffmpeg-static/**"
    },
    prune: true,
    icon: "build/icon/tray",
    extraResources: [
      { from: path.resolve(__dirname, "themes"), to: "themes" },
      { from: path.resolve(__dirname, "plugins"), to: "plugins" }
    ],
    ignore: (filePath) => {
      if (!filePath) return false;
      const normalizedPath = filePath.replace(/\\/g, '/');
      if (normalizedPath.includes('/.git')) return true;
      if (normalizedPath.includes('/.github')) return true;
      if (normalizedPath.includes('/node_modules/.cache')) return true;
      //if (normalizedPath.includes('/node_modules')) return true;
      if (normalizedPath.endsWith('.jsx')) return true;
      if (normalizedPath.endsWith('.map')) return true;
      if (normalizedPath.endsWith('.log')) return true;
      if (normalizedPath.endsWith('.zip')) return true;
      if (normalizedPath.includes('/tests/')) return true;
      if (normalizedPath.includes('/docs/')) return true;
      if (normalizedPath.includes('/legacy')) return true;
      if (normalizedPath.includes('/data')) return true;
      if (normalizedPath.includes('/renderer/components')) return true;
      if (normalizedPath.includes('/renderer/services')) return true;
      if (normalizedPath.endsWith('forge.config.js')) return true;
      return false;
    }
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        icon: "build/icon/tray.ico",
        setupIcon: "build/icon/tray.ico",
      },
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
  publishers: [
    {
    name: '@electron-forge/publisher-github',
    config: {
      repository: {
        owner: 'YourEliteSystems',
        name: 'webradio'
      },
      prerelease:false,
      draft: true
    }
  }
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
