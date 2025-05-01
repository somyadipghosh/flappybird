# Flappy Bird React

A modern, responsive implementation of the classic Flappy Bird game built with React and Vite. This version features performance optimizations for different devices, retro-style graphics, and immersive audio.

![Flappy Bird Game](https://via.placeholder.com/800x400?text=Flappy+Bird+Game)

## 🎮 Play Now

1. Clone this repository
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev`
4. Visit `http://localhost:5173` in your browser

## 🌟 Features

- **Responsive Design**: Adapts to any screen size, from mobile to desktop
- **Performance Optimizations**: 
  - Ultra Performance Mode for lower-end devices
  - Adaptive rendering based on device capabilities
  - Fixed timestep physics for consistent gameplay across different hardware
- **Retro Aesthetics**:
  - Pixelated graphics and fonts
  - CRT screen effects (scanlines, vignette)
  - Day-night cycle animations
- **Immersive Audio**:
  - Background music
  - Sound effects for jumping, scoring, and game over
  - Mute toggle functionality
- **Visual Effects**:
  - Dynamic backgrounds with clouds and buildings
  - Ground animations
  - Bird flapping animations

## 🎮 How to Play

- **Desktop**: Click or press the Space bar to make the bird flap
- **Mobile**: Tap the screen to make the bird flap
- Avoid hitting pipes and the ground
- Each pipe you pass earns you 1 point
- Try to achieve the highest score possible!

## ⚙️ Technical Implementation

Built with:
- React (Hooks, Functional Components)
- Vite (for fast development and optimized builds)
- Tailwind CSS (for responsive styling)
- Custom game loop using requestAnimationFrame
- Fixed timestep physics for consistent gameplay

### Performance Optimization Strategies

- Separate rendering and physics updates
- Adaptive detail level based on device capability
- Memoization of components and calculations
- Limited animation on lower-end devices
- Hardware acceleration hints for smoother animations
- Optimized collision detection

## 🔧 Configuration

You can toggle Ultra Performance Mode on the start screen if you're experiencing lag on mobile devices.

## 🌐 Browser Compatibility

Tested on:
- Chrome
- Firefox
- Safari
- Edge
- Mobile browsers (Chrome for Android, Safari for iOS)

## 📱 Mobile Support

- Touch controls optimized for mobile play
- Responsive layout adjusts to screen size
- Performance mode for older devices

## 🛠️ Development

### Prerequisites

- Node.js 16.0 or higher
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/flappybird.git

# Navigate to the project directory
cd flappybird

# Install dependencies
npm install

# Start development server
npm run dev
```

### Build for Production

```bash
npm run build
```

## 🔄 Future Improvements

- High score leaderboard
- Additional obstacles and power-ups
- Multiple bird characters to choose from
- More sophisticated background elements
- Additional game modes (e.g., endless, time attack)

## 📄 License

MIT License - feel free to use and modify for your own projects!

---

Enjoy the game! 🐦
