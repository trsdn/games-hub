# Hotseat Games Hub

[![GitHub Pages](https://img.shields.io/github/actions/workflow/status/trsdn/games-hub/deploy-pages.yml?branch=main&label=GitHub%20Pages)](https://trsdn.github.io/games-hub/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A collection of 21 abstract board games for two players sharing one device.
Several games also include a computer opponent. The interface is available in
German and English.

**Play online:** https://trsdn.github.io/games-hub/

## Features

- 21 games across four categories
- German and English interface
- Hotseat mode for two local players
- Bot mode for selected games
- Session statistics and custom player names
- Random game selection and coin flip
- Sound effects, haptic feedback, and responsive design

## Included games

| Category | Games |
| --- | --- |
| Make a row | Super Tic-Tac-Toe, Connect Four, Pentago, Gobblet Gobblers, Gomoku, Order & Chaos, Quarto |
| Connect & conquer | Hex, Lines of Action, Amazons, Dots and Boxes |
| Capture | Reversi, Kōnane, Breakthrough, Hnefatafl, Clobber, Fanorona |
| Move & race | Quoridor, Onitama, Halma, Mancala |

## Development

Requires Node.js 22 or newer.

```bash
git clone https://github.com/trsdn/games-hub.git
cd games-hub
npm install
npm run dev
```

Create and preview a production build:

```bash
npm run build
npm run preview
```

## Deployment

Every push to `main` is built and published to GitHub Pages by
[GitHub Actions](.github/workflows/deploy-pages.yml).

## License

This project is licensed under the [MIT License](LICENSE).
