# The Dot Game 🟥🟦

A modern, premium, and responsive implementation of the classic **Dots and Boxes** game. Play against a friend locally or challenge a smart AI with multiple difficulty levels.

## ✨ Features

- **Premium Design**: Sleek "Glassmorphism" UI with minimalist modern buttons, smooth gradients, and fluid transitions.
- **Game Modes**: 
  - **1 vs 1**: Local multiplayer with a shared device and smooth mode transitions.
  - **vs Computer**: Challenge an advanced AI with **Easy**, **Medium**, and **Hard** levels.
- **Expert AI Engine**: High-performance engine featuring Minimax with Alpha-Beta Pruning, chain detection, and double-cross strategies for unbeatable difficulty.
- **Time Trial Mode**: A high-stakes mode with a minimalist "solid-color" timebar and a 3-second red alert for fast-paced play.
- **Gameplay Tools**:
  - **Replay (Last Move)**: Hold the replay icon to highlight the most recent move.
  - **Smart Hints**: AI-powered move suggestions with a visual sonar "pulse" reminder.
  - **Quick Restart**: Easy match reset via a dedicated restart button.
- **Modern UI Components**: 
  - **Glassmorphic Toggles**: Refined selection sliders with backdrops and soft glows.
  - **Animated Transitions**: Smooth slide-and-fade effects when switching between menu options.
- **Tooltips & UX**: Helpful tooltips on all action buttons and intuitive interactive elements.
- **Haptic Feedback**: Subtle vibration patterns for moves, box completions, and UI interactions.
- **PWA Ready**: Installable as a progressive web app with full offline support.


## 🕹️ How to Play

1. **Setup**: Select grid size (3x3 up to 6x6) and game mode. 
2. **Objective**: Connect dots to build as many 1x1 boxes as possible.
3. **Turns & Scoring**: Closing a box grants a point and an **extra turn**.
4. **Gameplay Buttons**:
   - 🕒 **Replay**: Highlights the last line drawn.
   - 💡 **Hint**: Shows the best recommended move (Computer mode only).
   - 🔄 **Restart**: Quickly start a new round on the same grid.
5. **AI Difficulty**:
   - **Easy**: Casual play with mostly random moves.
   - **Medium**: Competitive play; grabs boxes and avoids simple errors.
   - **Hard**: Expert level; uses deep search and strategic sacrifices to dominate.

## 🚀 Quick Start

Simply open `index.html` or install the PWA for the best experience.

### Technical Overview
- **Core Logic**: `src/script.js` manages state, UI synchronization, and interactivity.
- **AI Engine**: `src/ai.js` contains the expert Minimax engine and heuristic evaluation.
- **Modern Styling**: `src/style.css` utilizes CSS variables and glassmorphism tokens.

## 🛠️ Built With

- **HTML5 & Vanilla CSS**: Premium design without heavy dependencies.
- **Expert JavaScript**: Advanced AI algorithms and real-time state management.
- **PWA Core**: Offline-first architecture with professional manifest configuration.

## 👤 Credits

Made with ❤️ by [tanvir](https://github.com/tanvirr007).
