# Hotseat Games Hub

[![GitHub Pages](https://img.shields.io/github/actions/workflow/status/trsdn/games-hub/deploy-pages.yml?branch=main&label=GitHub%20Pages)](https://trsdn.github.io/games-hub/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Eine Sammlung von 21 abstrakten Brettspielen für zwei Personen an einem Gerät.
Mehrere Spiele bieten zusätzlich einen Computergegner.

**Live spielen:** https://trsdn.github.io/games-hub/

## Funktionen

- 21 Spiele in vier Kategorien
- Hotseat-Modus für zwei Personen
- Bot-Modus für ausgewählte Spiele
- Session-Statistik und frei wählbare Spielernamen
- Zufällige Spielauswahl und Münzwurf
- Soundeffekte, haptisches Feedback und responsive Oberfläche

## Enthaltene Spiele

| Kategorie | Spiele |
| --- | --- |
| Reihe bilden | Super-Tic-Tac-Toe, Connect Four, Pentago, Gobblet Gobblers, Gomoku, Order & Chaos, Quarto |
| Verbinden & erobern | Hex, Lines of Action, Amazonen, Käsekästchen |
| Schlagen & fangen | Reversi, Kōnane, Breakthrough, Hnefatafl, Clobber, Fanorona |
| Ziehen & rennen | Quoridor, Onitama, Halma, Mancala |

## Entwicklung

Voraussetzung: Node.js 22 oder neuer.

```bash
git clone https://github.com/trsdn/games-hub.git
cd games-hub
npm install
npm run dev
```

Produktions-Build erstellen:

```bash
npm run build
npm run preview
```

## Deployment

Pushes auf `main` werden durch
[GitHub Actions](.github/workflows/deploy-pages.yml) automatisch gebaut und auf
GitHub Pages veröffentlicht.

## Lizenz

Dieses Projekt steht unter der [MIT-Lizenz](LICENSE).
