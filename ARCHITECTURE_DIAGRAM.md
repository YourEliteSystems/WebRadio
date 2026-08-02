# WebRadio Architecture Diagram

## Overview
WebRadio is a cross-platform desktop radio player built with Electron, React 19, and FFmpeg. It features a plugin system, theme engine, and extensible architecture.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WebRadio Application                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        Electron Main Process                          │  │
│  │                        (Backend / Node.js)                            │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │                                                                      │  │
│  │  ┌──────────────────────────────────────────────────────────────┐   │  │
│  │  │                     Application.js                           │   │  │
│  │  │              (Lifecycle & Initialization)                     │   │  │
│  │  └──────────────────────────────────────────────────────────────┘   │  │
│  │           │                    │                    │                │  │
│  │           ▼                    ▼                    ▼                │  │
│  │  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐            │  │
│  │  │   Storage    │   │   Plugins    │   │    Themes    │            │  │
│  │  │   Manager    │   │   Manager    │   │   Manager    │            │  │
│  │  └──────────────┘   └──────────────┘   └──────────────┘            │  │
│  │           │                    │                    │                │  │
│  │           ▼                    ▼                    ▼                │  │
│  │  ┌──────────────────────────────────────────────────────────────┐   │  │
│  │  │                    IPC Handlers                              │   │  │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │   │  │
│  │  │  │  Radio   │ │ Favorites│ │ History  │ │ Settings │         │   │  │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘         │   │  │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │   │  │
│  │  │  │  Plugins │ │  Themes  │ │ Updater  │ │Diagnostics│         │   │  │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘         │   │  │
│  │  └──────────────────────────────────────────────────────────────┘   │  │
│  │           │                    │                                     │  │
│  │           ▼                    ▼                                     │  │
│  │  ┌──────────────┐   ┌──────────────┐                                 │  │
│  │  │   Stream     │   │   Window     │                                 │  │
│  │  │   Manager    │   │   Manager    │                                 │  │
│  │  │   (FFmpeg)   │   │              │                                 │  │
│  │  └──────────────┘   └──────────────┘                                 │  │
│  │                                                                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    │                                       │
│                                    │ IPC (Inter-Process Communication)     │
│                                    │                                       │
│                                    ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      preload.js (IPC Bridge)                          │  │
│  │           Exposes secure APIs to renderer process                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    │                                       │
│                                    ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    Electron Renderer Process                          │  │
│  │                        (Frontend / React)                             │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │                                                                      │  │
│  │  ┌──────────────────────────────────────────────────────────────┐   │  │
│  │  │                       App.jsx                                 │   │  │
│  │  │              (Main React Component)                           │   │  │
│  │  └──────────────────────────────────────────────────────────────┘   │  │
│  │           │                    │                    │                │  │
│  │           ▼                    ▼                    ▼                │  │
│  │  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐            │  │
│  │  │   Sidebar    │   │ StationGrid  │   │  PlayerBar  │            │  │
│  │  │  Component   │   │  Component   │   │  Component  │            │  │
│  │  └──────────────┘   └──────────────┘   └──────────────┘            │  │
│  │           │                    │                    │                │  │
│  │           ▼                    ▼                    ▼                │  │
│  │  ┌──────────────────────────────────────────────────────────────┐   │  │
│  │  │                    Plugin UI System                          │   │  │
│  │  │  ┌──────────┐ ┌──────────┐                                 │   │  │
│  │  │  │PluginView│ │PluginSlot│                                 │   │  │
│  │  │  └──────────┘ └──────────┘                                 │   │  │
│  │  └──────────────────────────────────────────────────────────────┘   │  │
│  │                                                                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagram

```
┌──────────────┐
│   User       │
│  Interaction │
└──────┬───────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│                         React UI                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ Sidebar  │  │ Station  │  │ Player   │  │ Settings │      │
│  │          │  │   Grid   │  │   Bar    │  │          │      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘      │
│       │             │             │             │              │
│       └─────────────┴─────────────┴─────────────┘              │
│                     │                                          │
│                     ▼                                          │
│            ┌─────────────────┐                                 │
│            │  App.jsx State  │                                 │
│            │  Management     │                                 │
│            └────────┬────────┘                                 │
└─────────────────────┼──────────────────────────────────────────┘
                      │
                      │ IPC Calls (via preload.js)
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Electron Main Process                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    IPC Handlers                            │  │
│  │  • radio:start/stop  • favorites:add/remove               │  │
│  │  • history:add/get   • plugins:toggle                     │  │
│  │  • theme:setActive   • updater:check                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│           │                    │                                 │
│           ▼                    ▼                                 │
│  ┌──────────────┐   ┌──────────────┐                           │
│  │   Stream     │   │   Storage    │                           │
│  │   Manager    │   │   Manager    │                           │
│  │   (FFmpeg)   │   │              │                           │
│  └──────┬───────┘   └──────┬───────┘                           │
│         │                   │                                   │
│         ▼                   ▼                                   │
│  ┌──────────────┐   ┌──────────────┐                           │
│  │ Radio Browser│  │   JSON Files  │                           │
│  │     API      │  │   (Local)     │                           │
│  └──────────────┘   └──────────────┘                           │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────┐                                               │
│  │   FFmpeg     │                                               │
│  │   Process    │                                               │
│  └──────┬───────┘                                               │
│         │ PCM Audio Data                                        │
│         │ Metadata (StreamTitle, Artist, Song)                  │
│         ▼                                                       │
└─────────┼───────────────────────────────────────────────────────┘
          │ IPC Events (radio:pcm, radio:metadata)
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    React UI (Renderer)                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Web Audio API (AudioContext)                   │  │
│  │                    Receives PCM                             │  │
│  └──────────────────────────────────────────────────────────┘  │
│           │                                                       │
│           ▼                                                       │
│  ┌──────────────┐                                                │
│  │   PlayerBar  │  Updates now playing info                      │
│  │   Component  │  Displays metadata                             │
│  └──────────────┘                                                │
└─────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### Main Process (Backend)

```
electron/
├── main.js                          # Entry point
├── preload.js                       # IPC bridge
└── core/
    ├── Application.js               # App lifecycle manager
    ├── app/
    │   └── WindowManager.js         # Window management
    ├── audio/
    │   ├── streamManager.js        # FFmpeg stream handling
    │   └── metadataParser.js       # ICY metadata parsing
    ├── ipc/
    │   ├── registerIpcHandlers.js  # IPC handler registry
    │   ├── radioHandlers.js        # Radio stream IPC
    │   ├── storageHandlers.js      # Favorites/history IPC
    │   ├── pluginHandlers.js       # Plugin management IPC
    │   ├── themeHandlers.js        # Theme management IPC
    │   ├── updaterHandlers.js      # Auto-update IPC
    │   ├── diagnosticsHandlers.js # Logging/crash reports IPC
    │   └── windowHandlers.js       # Window control IPC
    ├── plugins/
    │   ├── PluginManager.js        # Plugin lifecycle
    │   ├── PluginLoader.js         # Plugin discovery
    │   ├── PluginRuntime.js        # Plugin execution
    │   ├── PluginAPI.js            # Plugin API surface
    │   └── PluginContext.js        # Plugin context
    ├── themes/
    │   └── ThemeManager.js         # Theme management
    ├── storage/
    │   └── StorageManager.js       # Data persistence
    ├── diagnostics/
    │   ├── logging/                # Log management
    │   ├── crash/                  # Crash handling
    │   └── health/                 # Health checks
    └── system/
        └── tray.js                 # System tray
```

### Renderer Process (Frontend)

```
renderer/
├── App.jsx                         # Main React component
├── renderer.jsx                    # Renderer entry
├── index.html                      # HTML template
├── components/
│   ├── Sidebar.jsx                 # Navigation & search
│   ├── StationGrid.jsx             # Station display grid
│   └── PlayerBar.jsx               # Playback controls
├── services/
│   └── playerService.js            # Audio playback logic
├── ui/
│   ├── PluginView.jsx              # Plugin page container
│   └── PluginSlot.jsx              # Plugin widget container
├── plugins/                        # Renderer-side plugins
└── styles/                         # Global styles
```

### Extension System

```
plugins/
└── discordRPC/                     # Discord Rich Presence
    ├── plugin.json                 # Plugin manifest
    ├── main.js                     # Main process plugin
    └── renderer.js                 # Renderer process plugin

themes/
├── default/                        # Default theme
├── dark/                           # Dark theme
└── neon/                           # Neon theme
    └── theme.css                   # CSS variables
```

## Key Data Flows

### 1. Radio Station Playback

```
User clicks station
    ↓
App.jsx handlePlay()
    ↓
radioAPI.startStream(url) via IPC
    ↓
radioHandlers.js → StreamManager.start(url)
    ↓
FFmpeg decodes stream to PCM
    ↓
StreamManager sends PCM via IPC (radio:pcm)
    ↓
Web Audio API receives and plays audio
    ↓
Metadata parsed and sent via IPC (radio:metadata)
    ↓
PlayerBar updates with song info
```

### 2. Plugin System

```
Application.start()
    ↓
PluginManager.loadPlugins()
    ↓
PluginLoader.discoverPlugins()
    ↓
Plugins loaded from plugins/ directory
    ↓
PluginRuntime.start(plugin) for enabled plugins
    ↓
Plugin receives PluginAPI context
    ↓
Plugin can:
    - Register views (registerView)
    - Register slots (registerSlot)
    - Listen to events
    - Access storage
```

### 3. Theme System

```
User selects theme
    ↓
themeAPI.setActiveTheme(id) via IPC
    ↓
themeHandlers.js → ThemeManager.setActive(id)
    ↓
Theme CSS loaded and applied
    ↓
IPC event sent (theme:changed)
    ↓
React UI updates with new CSS variables
```

### 4. Favorites Management

```
User adds favorite
    ↓
api.addFavorite(station) via IPC
    ↓
storageHandlers.js → StorageManager.save()
    ↓
JSON file updated locally
    ↓
React state updated with new favorite
```

## Technology Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Electron 40.7.0 |
| **UI** | React 19.2.6 |
| **Build** | esbuild 0.28.1, Electron Forge |
| **Audio** | fluent-ffmpeg, ffmpeg-static, Web Audio API |
| **Storage** | fs-extra, JSON files |
| **Plugins** | Vanilla JavaScript (ES Modules) |
| **Theming** | CSS Variables |
| **Installer** | Electron Builder |

## External Dependencies

- **Radio Browser API**: Station search and discovery
- **Discord RPC**: Discord Rich Presence (via plugin)
- **FFmpeg**: Audio stream decoding (bundled via ffmpeg-static)

## Security Architecture

- **Context Bridge**: preload.js exposes limited, secure APIs to renderer
- **IPC Validation**: All IPC handlers validate inputs
- **Plugin Permissions**: Plugin system includes permission framework
- **Sandboxed Renderer**: Renderer process runs with reduced privileges
