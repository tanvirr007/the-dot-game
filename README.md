# The Dot Game 🟥🟦

A modern, premium, and responsive implementation of the classic **Dots and Boxes** game. Play against a friend locally or challenge a smart AI with multiple difficulty levels.

## ✨ Features

- **Premium Design**: Sleek "Glassmorphism" UI with smooth gradients and hover effects.
- **Game Modes**: 
  - **1 vs 1**: Play against a friend on the same device.
  - **vs Computer**: Challenge an AI with **Easy**, **Medium**, and **Hard** difficulty levels.
- **First Move Control**: In Computer mode, choose who starts first—you or the AI.
- **Customizable Grids**: Choose between **3x3** (default), **4x4**, **5x5**, and **6x6** grid sizes.
- **Responsive & Mobile Friendly**: Fully optimized for mobile, tablet, and desktop with touch support.
- **Haptic Feedback**: Experience the game with subtle vibrations when drawing lines or completing boxes.
- **PWA Ready**: Installable as a progressive web app for an app-like experience.
- **Offline Support**: Works offline thanks to built-in service worker caching.

## 🕹️ How to Play

1. **Setup**: Choose your grid size and game mode. In "vs Computer" mode, you can also select the difficulty and who makes the first move.
2. **Objective**: Complete as many squares (boxes) as possible by connecting dots with lines.
3. **Turns**: Players take turns drawing a single horizontal or vertical line between two unjoined adjacent dots.
4. **Closing a Box**: If a player completes the fourth side of a 1x1 box, they earn a point and **must take another turn**.
5. **AI Difficulty**:
   - **Easy**: Makes mostly random moves.
   - **Medium**: Tries to block and finish boxes, but occasionally makes mistakes.
   - **Hard**: Plays strategically, prioritizing safe moves and box completion.
6. **Winning**: The game ends when all lines are drawn. The player with the most points wins!

## 🚀 Quick Start

Simply open `index.html` in any modern web browser or install it as a PWA from the address bar.

### Development & Customization
- **Logic**: `src/script.js` handles the game engine, AI, and haptic feedback.
- **Styling**: `src/style.css` defines the modern glass UI and animations.
- **Icons**: Located in `src/img/`.

## 🛠️ Built With

- **HTML5**: Semantic structure.
- **Vanilla CSS**: Premium styling without heavy frameworks.
- **Modern JS**: Smooth game logic, intelligent AI, and Web Vibration API.
- **PWA**: Manifest and Service Workers for installability.

## 👤 Credits

Made with ❤️ by [tanvir](https://github.com/tanvirr007).
