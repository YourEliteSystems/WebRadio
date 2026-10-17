# WebRadio Theme-SDK

Willkommen beim **WebRadio Theme-SDK**.

Diese Dokumentation erklärt, wie du eigene Themes für WebRadio erstellst.

Egal, ob du nur kleine visuelle Anpassungen vornehmen oder das Erscheinungsbild der Anwendung vollständig neu gestalten möchtest: Dieser Leitfaden führt dich durch alle Bereiche des Theme-Systems.

Das Theme-SDK bietet eine stabile und flexible Grundlage für ansprechende, wartbare und zukunftsfähige Themes.

---

# Was ist ein Theme?

Ein Theme verändert das visuelle Erscheinungsbild von WebRadio, ohne die Funktionalität der Anwendung zu verändern.

Entwickler und Designer können das Aussehen der Anwendung anpassen und dabei die Kompatibilität mit dem WebRadio-Core erhalten.

Typische Anpassungen umfassen:

- Farben
- Typografie
- Icons
- Abstände
- Rahmen
- Schatten
- Hintergründe
- Gestaltung von Komponenten

Themes sollen ausschließlich die Darstellung beeinflussen und niemals die Anwendungslogik verändern.

---

# Warum das Theme-SDK verwenden?

Das Theme-SDK bietet eine strukturierte Möglichkeit, WebRadio anzupassen.

Mit dem SDK stellst du sicher, dass dein Theme:

- sauber in die Anwendung integriert wird,
- mit zukünftigen Versionen kompatibel bleibt,
- einer einheitlichen Struktur folgt,
- offiziell unterstützte Styling-Variablen verwendet,
- leicht zu warten und weiterzugeben ist.

Themes sollten keine Quelldateien der Anwendung direkt verändern.

Stattdessen sollten sie das öffentliche Theme-SDK verwenden.

---

# So funktionieren Themes

Jedes Theme wird in einem eigenen Verzeichnis gespeichert.

WebRadio erkennt installierte Themes beim Start, prüft das Theme-Manifest und stellt das Theme anschließend zur Auswahl bereit.

Nach der Auswahl werden die Ressourcen des Themes geladen und auf die Anwendung angewendet.

---

# Ablauf beim Laden eines Themes

```text
Theme-Ordner

↓

Erkennung

↓

Manifest prüfen

↓

Assets laden

↓

CSS-Variablen

↓

Theme anwenden
```

Jedes Theme durchläuft denselben Ladeprozess.

---

# Was du lernen wirst

Dieser Leitfaden behandelt alle wichtigen Aspekte der Theme-Entwicklung, darunter:

- das erste Theme erstellen
- das Theme-Manifest verstehen
- Theme-Dateien strukturieren
- CSS-Variablen
- Gestaltung von Komponenten
- Assets
- bewährte Vorgehensweisen
- vollständige Beispiel-Themes

Kenntnisse der internen WebRadio-Architektur sind nicht erforderlich.

---

# Voraussetzungen

Vor der Theme-Erstellung solltest du mit Folgendem vertraut sein:

- HTML
- CSS
- CSS Custom Properties (Variablen)
- grundlegende Verzeichnisstrukturen

Für die meisten Themes sind keine JavaScript-Kenntnisse erforderlich.

---

# Aufbau der Dokumentation

Das Theme-SDK ist in folgende Kapitel unterteilt.

```text
README

↓

Erste Schritte

↓

Theme-Manifest

↓

Verzeichnisstruktur

↓

CSS-Variablen

↓

Komponenten

↓

Assets

↓

Bewährte Vorgehensweisen

↓

Hallo Theme

↓

Häufige Fragen (FAQ)
```

Jedes Kapitel baut auf dem vorherigen auf.

Für den besten Einstieg empfiehlt es sich, die Kapitel der Reihe nach zu lesen.

---

# Architekturprinzipien

Das Theme-SDK folgt mehreren wichtigen Grundsätzen.

## Einheitlichkeit

Themes sollen in der gesamten Anwendung ein einheitliches visuelles Erlebnis bieten.

---

## Wartbarkeit

Themes sollen sich bei Weiterentwicklung von WebRadio leicht aktualisieren lassen.

---

## Kompatibilität

Themes sollen ausschließlich dokumentierte Variablen und unterstützte Erweiterungspunkte verwenden.

---

## Flexibilität

Das Theme-SDK unterstützt sowohl einfache Farbschemata als auch umfassende visuelle Neugestaltungen.

---

# Hilfe erhalten

Wenn du bei der Theme-Entwicklung auf Probleme stößt, helfen dir möglicherweise folgende Ressourcen:

- Dokumentation zum Theme-SDK
- Architekturdokumentation
- GitHub-Issues
- GitHub-Discussions

---

# Nächster Schritt

Fahre mit **Erste Schritte** fort, um dein erstes WebRadio-Theme zu erstellen.
