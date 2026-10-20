# Stundenzettel

Offline-Zeiterfassung als installierbare Web-App. Diese Veröffentlichung enthält nur Programmcode – keine Zeitdaten, Aufträge oder JSON-Dateien.

## Start

Öffne die GitHub-Pages-Adresse in Chrome oder Edge und wähle **Installieren**. Beim ersten Start legst du über **Neu beginnen** deine eigene JSON-Datei auf deinem PC an. Diese Datei ist die einzige Datenquelle und wird nicht an GitHub übertragen.

## Daten & Datenschutz

- Die App sendet keine Zeitdaten an diesen Server.
- Daten werden ausschließlich in einer von dir ausgewählten JSON-Datei auf deinem Rechner gespeichert.
- Eine Sicherungskopie kannst du über Einstellungen → Dateien & Sicherung erstellen.

## Hinweise

- Chrome oder Edge bieten automatisches Speichern in die gewählte Datei.
- Firefox/Safari können die Datei nicht automatisch überschreiben.
- Details stehen in der App unter Einstellungen.

## Plan B: lokal installieren

Falls die GitHub-Adresse im Firmennetz blockiert ist, lade den vollständigen Programmordner herunter und starte `Stundenzettel-installieren.cmd`. Der Starter nutzt Python, wenn verfügbar, sonst das mit Windows gelieferte PowerShell, und öffnet die App über `http://localhost:8765/`. In der App auf **Installieren** klicken. Der lokale Server ist nur für Installation oder Updates nötig; die Daten bleiben in der eigenen JSON-Datei.
