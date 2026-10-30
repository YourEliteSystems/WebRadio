# Drittanbieter-Hinweise

WebRadio wird unter der Apache License 2.0 veröffentlicht. Das gilt nicht automatisch für eingebundene Bibliotheken oder mitgelieferte Programme; diese können eigene Lizenzbedingungen haben.

Diese Übersicht ist eine **erste Bestandsaufnahme der direkten Abhängigkeiten** aus `package-lock.json` für den Quellstand `1.0.7-beta.3`. Sie ersetzt noch keine vollständige, automatisiert geprüfte Lizenzliste aller transitiven Abhängigkeiten und keine rechtliche Prüfung. Die angegebenen Lizenzkennzeichen stammen aus den Paketmetadaten und sollten vor Releases erneut überprüft werden.

## Direkte Laufzeitabhängigkeiten

| Paket | Version im Lockfile | Lizenzangabe | Quelle |
|---|---:|---|---|
| `discord-rpc` | 4.0.1 | MIT | [npm](https://www.npmjs.com/package/discord-rpc) |
| `electron-updater` | 6.8.9 | MIT | [npm](https://www.npmjs.com/package/electron-updater) |
| `ffmpeg-static` | 5.3.0 | GPL-3.0-or-later (Paketmetadaten) | [npm](https://www.npmjs.com/package/ffmpeg-static) |
| `fluent-ffmpeg` | 2.1.3 | MIT | [npm](https://www.npmjs.com/package/fluent-ffmpeg) |
| `fs-extra` | 11.4.0 | MIT | [npm](https://www.npmjs.com/package/fs-extra) |
| `react` | 19.3.0 | MIT | [npm](https://www.npmjs.com/package/react) |
| `react-dom` | 19.3.0 | MIT | [npm](https://www.npmjs.com/package/react-dom) |

## Build- und Entwicklungswerkzeuge

Die folgenden direkten Entwicklungsabhängigkeiten stehen im Lockfile. Ob und in welcher Form sie in ein Release-Artefakt gelangen, ist vom Packaging abhängig.

| Paket | Version im Lockfile | Lizenzangabe | Quelle |
|---|---:|---|---|
| `@eslint/js` | 9.39.5 | MIT | [npm](https://www.npmjs.com/package/@eslint/js) |
| `@types/node` | 25.9.7 | MIT | [npm](https://www.npmjs.com/package/@types/node) |
| `electron` | 44.4.1 | MIT | [npm](https://www.npmjs.com/package/electron) |
| `electron-builder` | 26.15.3 | MIT | [npm](https://www.npmjs.com/package/electron-builder) |
| `esbuild` | 0.28.2 | MIT | [npm](https://www.npmjs.com/package/esbuild) |
| `eslint` | 9.39.5 | MIT | [npm](https://www.npmjs.com/package/eslint) |
| `eslint-plugin-react-hooks` | 6.1.1 | MIT | [npm](https://www.npmjs.com/package/eslint-plugin-react-hooks) |
| `globals` | 16.5.0 | MIT | [npm](https://www.npmjs.com/package/globals) |
| `prettier` | 3.9.7 | MIT | [npm](https://www.npmjs.com/package/prettier) |
| `semantic-release` | 24.2.9 | MIT | [npm](https://www.npmjs.com/package/semantic-release) |
| `typescript-eslint` | 8.70.0 | MIT | [npm](https://www.npmjs.com/package/typescript-eslint) |

## Besonderer Prüfpunkt: FFmpeg

WebRadio verwendet `ffmpeg-static`; das Paket lädt eine plattformspezifische FFmpeg-Binärdatei. Die Paketdokumentation weist darauf hin, dass die jeweilige Binärdatei unter ihrer eigenen Lizenz steht. Das Paket selbst deklariert GPL-3.0-or-later. Die genaue Lizenzkonfiguration der tatsächlich in Windows- und Linux-Releases enthaltenen Binärdateien sowie die daraus folgenden Distributionspflichten sind **noch separat anhand der konkreten Release-Binaries und ihrer Build-Konfiguration zu verifizieren**.

Quelle: [ffmpeg-static auf npm](https://www.npmjs.com/package/ffmpeg-static), [FFmpeg-Lizenzhinweise](https://ffmpeg.org/legal.html).

## Noch ausstehend

- Vollständige Lizenzinventur der transitiven Abhängigkeiten automatisieren.
- Erforderliche Lizenztexte und Copyright-Hinweise für tatsächlich ausgelieferte Komponenten prüfen und bündeln.
- FFmpeg-Build-Konfiguration und die dazugehörigen Lizenz-/Quellcodepflichten für die veröffentlichten Artefakte verifizieren.
- Diese Datei bei Änderungen an Abhängigkeiten und vor Releases aktualisieren.

Diese Datei dient der Transparenz und ist keine Rechtsberatung.
