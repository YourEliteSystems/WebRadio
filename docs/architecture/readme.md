# Architekturleitfaden für WebRadio

**Version:** 2.1  
**Gilt für:** WebRadio v1.0.7 und neuer

---

# Einführung

Willkommen beim Architekturleitfaden von WebRadio.

Dieses Dokument erklärt den internen Aufbau von WebRadio und die Gründe für die gewählte Projektstruktur. Es richtet sich an Mitwirkende, Plugin-Entwickler und alle, die die Architektur der Anwendung verstehen möchten.

Im Gegensatz zu einer Dokumentation, die ausschließlich erklärt, *wie* etwas funktioniert, erläutert dieser Leitfaden auch, *warum* bestimmte Architekturentscheidungen getroffen wurden.

WebRadio soll nicht nur eine moderne Desktop-Radioanwendung bereitstellen, sondern auch eine saubere, modulare und wartbare Plattform sein, die sich erweitern lässt, ohne den Anwendungskern zu verändern.

Jedes größere Subsystem hat eine klar definierte Aufgabe. Durch diese Trennung lassen sich neue Funktionen hinzufügen, während der Core stabil, verständlich und wartbar bleibt.

Die Architektur folgt einigen grundlegenden Prinzipien:

- Jede Komponente hat eine klar abgegrenzte Aufgabe.
- Komponenten kommunizieren über eindeutig definierte Schnittstellen.
- Funktionen sollen austauschbar sein, ohne unabhängige Systeme zu beeinflussen.
- Plugins und Themes sollen die Anwendung erweitern, statt sie direkt zu verändern.
- Der Start der Anwendung soll vorhersehbar und zentral gesteuert sein.
- **Installation ist nicht Laufzeit:** Paketverwaltung ist optional und von der Erkennung zur Laufzeit getrennt.

Diese Prinzipien haben die Entwicklung von WebRadio geprägt und beeinflussen weiterhin die zukünftige Entwicklung.

Dieser Leitfaden bietet einen Überblick über die gesamte Anwendungsarchitektur, bevor die einzelnen Systeme wie Application, StorageManager, WindowManager, PluginManager, ThemeManager, Package System, Diagnostics, IPC und Renderer im Detail behandelt werden.
