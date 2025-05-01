import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'

const App = () => {
  // Game state
  const [gameStarted, setGameStarted] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [score, setScore] = useState(0)
  const [gameSize, setGameSize] = useState({ width: 0, height: 0 })
  
  // Bird position and physics
  const [birdPosition, setBirdPosition] = useState(0)
  const [velocity, setVelocity] = useState(0)
  
  // Fixed physics parameters for consistent gameplay
  const gravity = 0.35 // Reduced from 0.6 for slower falling
  const jumpStrength = 0.015 // Increased from 0.012 for stronger jumps
  
  // Game speed controls - fixed time step for consistent physics
  const GAME_SPEED = 1.3 // Slightly increased from 1.2 to make the game more challenging
  const FIXED_DELTA_TIME = 16.67 // Fixed time step (60 FPS equivalent)
  const MAX_DELTA_TIME = 50 // Cap max delta time to prevent huge jumps after lag
  
  // Accumulator for fixed time steps
  const accumulatorRef = useRef(0)
  
  // Game elements - using refs instead of state for frequently updated values
  // that don't need to trigger re-renders
  const pipesRef = useRef([])
  const cloudsRef = useRef([])
  const buildingsRef = useRef([])
  const birdFlapRef = useRef(false)
  
  // Display state - only these will trigger re-renders
  const [displayPipes, setDisplayPipes] = useState([])
  const [displayClouds, setDisplayClouds] = useState([])
  const [displayBuildings, setDisplayBuildings] = useState([])
  const [displayBirdFlap, setDisplayBirdFlap] = useState(false)
  
  // Game frame counter for optimizing updates
  const frameCounterRef = useRef(0)
  
  // Use requestAnimationFrame ID for game loop
  const requestAnimationFrameIdRef = useRef(null)
  const lastUpdateTimeRef = useRef(0)
  const gameAreaRef = useRef(null)
  
  // FPS monitoring
  const fpsRef = useRef(0)
  const fpsTimerRef = useRef(0)
  const frameCountRef = useRef(0)
  
  // Performance toggle flags
  const ENABLE_CLOUDS = true
  const ENABLE_BUILDINGS = true
  const ENABLE_ANIMATIONS = true
  
  // Game dimensions - will be calculated based on screen size
  const birdSizeRatio = 0.067 // percentage of game height
  const pipeWidthRatio = 0.1 // percentage of game width
  const pipeGapRatio = 0.35 // Reduced from 0.42 to make the game more challenging
  const pipeInterval = 1600 // Reduced from 2500 to 1600 milliseconds for faster pipe spawning
  
  // Function to calculate game dimensions based on screen size
  const calculateGameSize = useCallback(() => {
    const isMobile = window.innerWidth < 768;
    
    if (isMobile) {
      // On mobile, take 95% of screen width, aspect ratio 2:3
      const width = window.innerWidth * 0.95;
      const height = width * 1.5;
      setGameSize({ width, height });
    } else {
      // On desktop, take 90% of viewport height, aspect ratio 2:3
      const height = window.innerHeight * 0.9;
      const width = height * 0.667;
      setGameSize({ width, height });
    }
    
    // Reset bird position to center
    setBirdPosition(gameSize.height ? gameSize.height * 0.4 : window.innerHeight * 0.4);
  }, [gameSize.height]);

  // Set up game size on mount and resize with debounce
  useEffect(() => {
    calculateGameSize();
    
    // Debounce resize events
    let resizeTimer;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(calculateGameSize, 100);
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', handleResize);
    };
  }, [calculateGameSize]);
  
  // Initialize background elements
  useEffect(() => {
    if (gameSize.width > 0 && gameSize.height > 0) {
      // Generate clouds with different sizes and positions
      if (ENABLE_CLOUDS) {
        const newClouds = [];
        // Limit number of clouds based on screen size
        const cloudCount = Math.min(6, Math.floor(gameSize.width / 120));
        
        for (let i = 0; i < cloudCount; i++) {
          newClouds.push({
            x: Math.random() * gameSize.width * 2,
            y: Math.random() * (gameSize.height * 0.5),
            size: 30 + Math.random() * 40, // Reduced max size
            speed: 0.3 + Math.random() * 0.3,
          });
        }
        cloudsRef.current = newClouds;
        setDisplayClouds([...newClouds]);
      }
      
      // Generate background buildings
      if (ENABLE_BUILDINGS) {
        const newBuildings = [];
        let totalWidth = 0;
        // Limit number of buildings
        const maxBuildings = Math.min(20, Math.floor(gameSize.width / 50));
        let buildingCount = 0;
        
        while (totalWidth < gameSize.width * 2 && buildingCount < maxBuildings) {
          const width = Math.floor(gameSize.width * 0.05) + Math.floor(Math.random() * gameSize.width * 0.08);
          const height = (gameSize.height * 0.1) + Math.random() * (gameSize.height * 0.12);
          newBuildings.push({
            x: totalWidth,
            width,
            height,
            // Pre-generate window positions and their visibility
            windows: Array(Math.floor(height / 25)).fill().map(() => 
              Array(2).fill().map(() => Math.random() > 0.3)
            )
          });
          totalWidth += width;
          buildingCount++;
        }
        buildingsRef.current = newBuildings;
        setDisplayBuildings([...newBuildings]);
      }
    }
  }, [gameSize.width, gameSize.height]);
  
  // Derived dimensions - memoized to avoid recalculations
  const gameDimensions = useMemo(() => {
    return {
      birdSize: gameSize.height * birdSizeRatio,
      pipeWidth: gameSize.width * pipeWidthRatio,
      pipeGap: gameSize.height * pipeGapRatio,
      birdLeftPosition: gameSize.width * 0.3
    };
  }, [gameSize.width, gameSize.height, birdSizeRatio, pipeWidthRatio, pipeGapRatio]);
  
  // Destructure for better readability
  const { birdSize, pipeWidth, pipeGap, birdLeftPosition } = gameDimensions;
  
  // Store updatePhysics function in a ref to avoid circular dependencies
  const updatePhysicsRef = useRef(null);

  // Main game update function using fixed time step
  const updateGame = useCallback((timestamp) => {
    // Calculate actual delta time since last frame
    let frameDeltaTime = timestamp - lastUpdateTimeRef.current;
    lastUpdateTimeRef.current = timestamp;
    
    // Cap delta time to prevent huge jumps after lag/tab switching
    frameDeltaTime = Math.min(frameDeltaTime, MAX_DELTA_TIME);
    
    // Skip if game not started or game over
    if (!gameStarted || gameOver) {
      requestAnimationFrameIdRef.current = requestAnimationFrame(updateGame);
      return;
    }
    
    // Accumulate time since last frame
    accumulatorRef.current += frameDeltaTime;
    
    // Update FPS counter
    frameCountRef.current++;
    fpsTimerRef.current += frameDeltaTime;
    if (fpsTimerRef.current >= 1000) {
      fpsRef.current = frameCountRef.current;
      frameCountRef.current = 0;
      fpsTimerRef.current -= 1000;
    }
    
    // Fixed time step loop - only update physics at fixed intervals
    // This ensures consistent physics regardless of frame rate
    let physicsUpdated = false;
    while (accumulatorRef.current >= FIXED_DELTA_TIME) {
      // Update physics with fixed time step
      if (updatePhysicsRef.current) {
        updatePhysicsRef.current(FIXED_DELTA_TIME * GAME_SPEED);
      }
      accumulatorRef.current -= FIXED_DELTA_TIME;
      physicsUpdated = true;
    }
    
    // Only update rendering if physics were updated
    if (physicsUpdated) {
      // Increment frame counter
      frameCounterRef.current++;
      
      // Animate bird flapping (at reduced frequency)
      if (frameCounterRef.current % 5 === 0) {
        const newFlapState = !birdFlapRef.current;
        birdFlapRef.current = newFlapState;
        setDisplayBirdFlap(newFlapState);
      }
      
      // Update display elements less frequently for better performance
      if (frameCounterRef.current % 2 === 0) {
        setDisplayPipes([...pipesRef.current]);
      }
      
      if (frameCounterRef.current % 6 === 0 && ENABLE_CLOUDS) {
        setDisplayClouds([...cloudsRef.current]);
      }
      
      if (frameCounterRef.current % 15 === 0 && ENABLE_BUILDINGS) {
        setDisplayBuildings([...buildingsRef.current]);
      }
    }
    
    // Continue the game loop
    requestAnimationFrameIdRef.current = requestAnimationFrame(updateGame);
  }, [gameStarted, gameOver, GAME_SPEED]);
  
  // Separate physics update function with fixed time step
  const updatePhysics = useCallback((deltaTime) => {
    // Update bird position based on physics
    const newBirdPos = birdPosition + velocity * (deltaTime / FIXED_DELTA_TIME);
    
    // Calculate ground position (top of the ground area)
    const groundPosition = gameSize.height - (gameSize.height * 0.1);
    
    // Check for ground collision specifically
    if (newBirdPos + birdSize > groundPosition) {
      // Bird hit the ground
      setBirdPosition(groundPosition - birdSize); // Place bird just above ground for visual effect
      setGameOver(true);
      return; // Stop processing physics when the bird hits the ground
    }
    // Check ceiling collision
    else if (newBirdPos < 0) {
      setGameOver(true);
      return;
    } else {
      setBirdPosition(newBirdPos);
    }
    
    // Apply gravity to velocity with fixed time step
    setVelocity(v => v + gravity * (deltaTime / FIXED_DELTA_TIME));
    
    // Update cloud positions
    if (ENABLE_CLOUDS) {
      cloudsRef.current = cloudsRef.current.map(cloud => {
        let newX = cloud.x - (cloud.speed * (deltaTime / FIXED_DELTA_TIME));
        if (newX + cloud.size < 0) {
          // Reset cloud position when it goes off-screen
          newX = gameSize.width + cloud.size;
        }
        return {...cloud, x: newX};
      });
    }
    
    // Update building positions
    if (ENABLE_BUILDINGS) {
      buildingsRef.current = buildingsRef.current.map(building => {
        let newX = building.x - (gameSize.width * 0.0006 * (deltaTime / FIXED_DELTA_TIME));
        if (newX + building.width < 0) {
          // Find the rightmost building
          const rightmostX = Math.max(...buildingsRef.current.map(b => b.x + b.width));
          // Position the building after the rightmost one
          newX = rightmostX;
        }
        return {...building, x: newX};
      });
    }
    
    // Update pipe positions
    const pipes = pipesRef.current;
    const pipeSpeed = gameSize.width * 0.008 * (deltaTime / FIXED_DELTA_TIME);
    const updatedPipes = pipes.map(pipe => ({
      ...pipe,
      x: pipe.x - pipeSpeed
    }));
    
    // Check for collisions
    const birdRight = birdLeftPosition + birdSize;
    const birdLeft = birdLeftPosition;
    
    // Check if bird is hitting any pipes
    let isCollision = false;
    for (const pipe of updatedPipes) {
      if (pipe.x < birdRight && pipe.x + pipeWidth > birdLeft) {
        const topPipeBottom = pipe.height;
        const bottomPipeTop = pipe.height + pipeGap;
        
        if (birdPosition < topPipeBottom || birdPosition + birdSize > bottomPipeTop) {
          isCollision = true;
          break;
        }
      }
      
      // Increment score when passing a pipe (exactly once)
      if (!pipe.passed && pipe.x + pipeWidth < birdLeft) {
        setScore(s => s + 1);
        pipe.passed = true;
      }
    }
    
    if (isCollision) {
      setGameOver(true);
    } else {
      // Remove pipes that are off-screen
      pipesRef.current = updatedPipes.filter(pipe => pipe.x > -pipeWidth);
    }
  }, [birdPosition, velocity, gameSize, birdSize, pipeWidth, pipeGap, birdLeftPosition, gravity, FIXED_DELTA_TIME]);
  
  // Store the physics update function in ref to avoid circular dependencies
  useEffect(() => {
    updatePhysicsRef.current = updatePhysics;
  }, [updatePhysics]);
  
  // Game loop using requestAnimationFrame for smoother animation
  useEffect(() => {
    if (gameStarted && !gameOver) {
      lastUpdateTimeRef.current = performance.now();
      accumulatorRef.current = 0; // Reset accumulator on game start
      fpsTimerRef.current = 0;
      frameCountRef.current = 0;
      requestAnimationFrameIdRef.current = requestAnimationFrame(updateGame);
    }
    
    return () => {
      if (requestAnimationFrameIdRef.current) {
        cancelAnimationFrame(requestAnimationFrameIdRef.current);
      }
    };
  }, [gameStarted, gameOver, updateGame]);
  
  // Generate new pipes at intervals
  useEffect(() => {
    let pipeTimerId;
    
    if (gameStarted && !gameOver) {
      // Adjust pipe interval based on game speed
      const adjustedInterval = pipeInterval / GAME_SPEED;
      
      pipeTimerId = setInterval(() => {
        const minHeight = gameSize.height * 0.1; // Min 10% of screen height
        const maxHeight = gameSize.height - pipeGap - minHeight;
        const height = Math.floor(Math.random() * (maxHeight - minHeight) + minHeight);
        
        const newPipe = {
          x: gameSize.width,
          height,
          passed: false
        };
        
        pipesRef.current = [...pipesRef.current, newPipe];
        setDisplayPipes([...pipesRef.current]);
      }, adjustedInterval);
    }
    
    return () => clearInterval(pipeTimerId);
  }, [gameStarted, gameOver, gameSize.height, gameSize.width, pipeGap, GAME_SPEED]);
  
  // Handle jump (flap) on click or space
  const handleJump = useCallback(() => {
    if (gameOver) {
      // Reset game
      setBirdPosition(gameSize.height * 0.4);
      setVelocity(0);
      pipesRef.current = [];
      setDisplayPipes([]);
      setScore(0);
      frameCounterRef.current = 0;
      setGameOver(false);
      setGameStarted(true);
    } else {
      // Jump - using smaller strength for more controlled jumps
      setVelocity(-gameSize.height * jumpStrength);
      
      if (!gameStarted) {
        setGameStarted(true);
      }
    }
  }, [gameOver, gameSize.height]);
  
  // Handle key press for jump
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault(); // Prevent scrolling with space bar
        handleJump();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleJump]);

  // Pixelated font style for retro look
  const pixelatedStyle = useMemo(() => ({
    fontFamily: "'Press Start 2P', 'Courier New', monospace",
    textRendering: "pixelated",
    WebkitFontSmoothing: "none",
  }), []);
  
  // Day-night cycle animation - use simpler approach for performance
  const dayNightCycle = useMemo(() => {
    return gameStarted && ENABLE_ANIMATIONS ? {
      animation: 'dayNightCycle 60s infinite linear'
    } : {};
  }, [gameStarted]);
  
  // Memoize repetitive elements to avoid unnecessary calculations
  const groundPattern = useMemo(() => {
    return [...Array(20)].map((_, i) => (
      <div key={i} className="h-full" style={{ width: `${gameSize.width / 20}px` }}>
        {i % 2 === 0 && <div className="w-full h-full bg-amber-900 opacity-30"></div>}
      </div>
    ));
  }, [gameSize.width]);
  
  // Memoize grass tufts
  const grassTufts = useMemo(() => {
    return [...Array(Math.min(12, Math.floor(gameSize.width / 50)))].map((_, i) => (
      <div key={i} className="absolute bg-green-700" 
           style={{ 
             left: `${(i * gameSize.width / 12) + (i * 5)}px`,
             width: '8px',
             height: '10px',
             borderRadius: '4px 4px 0 0'
           }}>
      </div>
    ));
  }, [gameSize.width]);
  
  return (
    <div className="flex items-center justify-center min-h-screen w-full overflow-hidden bg-black">
      {/* Retro scanlines overlay - only if animations enabled */}
      {ENABLE_ANIMATIONS && (
        <div className="fixed inset-0 pointer-events-none bg-repeat z-10 opacity-10" 
            style={{
              backgroundImage: 'linear-gradient(transparent 50%, rgba(0, 0, 0, 0.8) 50%)',
              backgroundSize: '100% 4px'
            }} 
        />
      )}

      {/* CRT screen effect wrapper */}
      <div className="relative rounded-lg overflow-hidden border-8 border-gray-900 shadow-2xl"
           style={{ 
             width: `${gameSize.width}px`, 
             height: `${gameSize.height}px`,
             boxShadow: '0 0 40px rgba(86, 96, 128, 0.7), inset 0 0 40px rgba(0, 0, 0, 0.9)'
           }}>

        {/* Game container */}
        <div 
          ref={gameAreaRef} 
          className="relative w-full h-full overflow-hidden cursor-pointer"
          onClick={handleJump}
          style={{
            imageRendering: "pixelated",
            ...dayNightCycle
          }}
        >
          {/* Simplified sky background */}
          <div className="absolute inset-0 bg-gradient-to-b from-blue-500 via-blue-400 to-blue-300"
               style={{animation: (gameStarted && ENABLE_ANIMATIONS) ? 'skyColor 30s infinite alternate' : ''}} />
          
          {/* Sun or moon - simplified */}
          {ENABLE_ANIMATIONS && (
            <div className="absolute rounded-full bg-yellow-300 border-2 border-yellow-400"
                style={{
                  width: `${gameSize.width * 0.15}px`, 
                  height: `${gameSize.width * 0.15}px`,
                  top: `${gameSize.height * 0.1}px`,
                  right: `${gameSize.width * 0.1}px`,
                  boxShadow: '0 0 30px rgba(250, 240, 137, 0.6)',
                  animation: (gameStarted && ENABLE_ANIMATIONS) ? 'sunPulse 4s infinite alternate' : ''
                }} />
          )}
               
          {/* Animated clouds - only render if enabled */}
          {ENABLE_CLOUDS && displayClouds.map((cloud, index) => (
            <div key={index} className="absolute bg-white rounded-full"
                 style={{
                   width: `${cloud.size}px`,
                   height: `${cloud.size * 0.6}px`,
                   left: `${cloud.x}px`,
                   top: `${cloud.y}px`,
                   opacity: 0.8,
                   zIndex: 1
                 }}>
              <div className="absolute bg-white rounded-full"
                   style={{
                     width: '70%',
                     height: '80%',
                     left: '20%',
                     top: '-40%'
                   }}></div>
            </div>
          ))}
          
          {/* Background buildings - optimized */}
          {ENABLE_BUILDINGS && (
            <div className="absolute bottom-0 w-full" style={{ height: `${gameSize.height * 0.3}px`, zIndex: 2 }}>
              {displayBuildings.map((building, index) => (
                <div key={index} className="absolute bottom-0 bg-gray-900"
                    style={{
                      left: `${building.x}px`,
                      width: `${building.width}px`,
                      height: `${building.height}px`,
                      opacity: 0.7
                    }}>
                  {/* Pre-generated windows with fixed visibility */}
                  {building.windows.map((row, i) => (
                    <div key={i} className="flex justify-around" style={{ marginTop: '10px' }}>
                      {row.map((isVisible, j) => (
                        <div key={j} className="bg-yellow-200"
                            style={{
                              width: '4px',
                              height: '4px',
                              opacity: isVisible ? 0.8 : 0
                            }}></div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          
          {/* Bird with flapping wing animation */}
          <div 
            className="absolute rounded-full bg-yellow-400 border-2 border-black"
            style={{ 
              left: `${birdLeftPosition}px`,
              top: `${birdPosition}px`,
              width: `${birdSize}px`, 
              height: `${birdSize}px`,
              transform: `rotate(${velocity * 3}deg)`,
              transition: 'transform 0.1s ease-in',
              boxShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
              zIndex: 10,
              willChange: 'transform' // Performance hint for browser
            }}
          >
            {/* Bird eye */}
            <div className="absolute w-1/4 h-1/4 bg-white rounded-full" 
                 style={{top: '20%', right: '20%'}}>
              <div className="absolute w-1/3 h-1/3 bg-black rounded-full" 
                   style={{top: '25%', right: '25%'}}></div>
            </div>
            {/* Bird beak */}
            <div className="absolute bg-orange-600 rounded-r-full" 
                 style={{
                   top: '40%',
                   right: '-30%',
                   width: '35%',
                   height: '20%'
                 }}></div>
            {/* Bird wing - animated */}
            <div className="absolute bg-yellow-500 rounded-full"
                 style={{
                   width: '70%',
                   height: '30%',
                   bottom: '10%',
                   left: '5%',
                   transformOrigin: 'left center',
                   transform: displayBirdFlap ? 'rotate(25deg)' : 'rotate(-10deg)',
                   transition: 'transform 0.1s ease-in-out'
                 }}></div>
          </div>
          
          {/* Pipes - using display pipes state */}
          {displayPipes.map((pipe, index) => (
            <React.Fragment key={index}>
              {/* Top pipe */}
              <div 
                className="absolute bg-green-700 border-r-4 border-l-4 border-green-900"
                style={{ 
                  left: `${pipe.x}px`, 
                  top: 0, 
                  width: `${pipeWidth}px`, 
                  height: `${pipe.height}px`,
                  zIndex: 15,
                  willChange: 'transform' // Performance hint
                }}
              >
                <div className="absolute bottom-0 left-0 right-0 h-6 bg-green-800 border-2 border-green-900"></div>
              </div>
              
              {/* Bottom pipe */}
              <div 
                className="absolute bg-green-700 border-r-4 border-l-4 border-green-900"
                style={{ 
                  left: `${pipe.x}px`, 
                  top: `${pipe.height + pipeGap}px`, 
                  width: `${pipeWidth}px`, 
                  height: `${gameSize.height - pipe.height - pipeGap}px`,
                  zIndex: 15,
                  willChange: 'transform' // Performance hint
                }}
              >
                <div className="absolute top-0 left-0 right-0 h-6 bg-green-800 border-2 border-green-900"></div>
              </div>
            </React.Fragment>
          ))}
          
          {/* Animated Ground with moving pattern - optimized */}
          <div className="absolute bottom-0 w-full bg-amber-800 border-t-4 border-amber-900"
               style={{ height: `${gameSize.height * 0.1}px`, zIndex: 20 }}>
            <div className="w-full h-1/2 bg-amber-700 flex items-center overflow-hidden">
              {/* Scrolling ground pattern - only animate when needed */}
              <div className="flex" 
                   style={{
                     animation: (gameStarted && !gameOver && ENABLE_ANIMATIONS) ? `scrollGround ${2/GAME_SPEED}s linear infinite` : '',
                     width: `${gameSize.width * 2}px`,
                     willChange: (gameStarted && !gameOver && ENABLE_ANIMATIONS) ? 'transform' : 'auto'
                   }}>
                {groundPattern}
              </div>
            </div>
          </div>

          {/* Little grass tufts on ground - memoized */}
          <div className="absolute w-full" 
               style={{ bottom: `${gameSize.height * 0.09}px`, zIndex: 18 }}>
            {grassTufts}
          </div>
          
          {/* Score - retro pixelated style */}
          <div className="absolute top-8 left-0 right-0 text-center z-30">
            <div className="text-white font-bold" style={{ 
              ...pixelatedStyle,
              fontSize: `${gameSize.height * 0.1}px`,
              textShadow: '3px 3px 0 #000',
              letterSpacing: '1px'
            }}>{score}</div>
          </div>
          
          {/* Start screen - retro arcade style */}
          {!gameStarted && !gameOver && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-40 z-40">
              <div className="text-yellow-400 mb-6 text-center" style={{
                ...pixelatedStyle,
                fontSize: `${gameSize.width * 0.085}px`,
                textShadow: '4px 4px 0 #000',
                transform: 'rotate(-2deg)',
                letterSpacing: '-1px'
              }}>
                FLAPPY BIRD
              </div>
              <div className="relative text-white mb-8" style={{
                ...pixelatedStyle,
                fontSize: `${gameSize.width * 0.04}px`,
                animation: ENABLE_ANIMATIONS ? 'blink 1s infinite' : 'none',
                textShadow: '2px 2px 0 #000'
              }}>
                PRESS TO START
              </div>
              <div style={{animation: ENABLE_ANIMATIONS ? 'bounce 1s infinite alternate' : 'none'}}>
                <div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-white">
                  <div className="w-6 h-6 border-t-4 border-r-4 border-white transform rotate-135"></div>
                </div>
              </div>
            </div>
          )}
          
          {/* Game over screen - retro arcade style */}
          {gameOver && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-60 z-40">
              <div className="text-red-500 mb-4" style={{
                ...pixelatedStyle,
                fontSize: `${gameSize.width * 0.075}px`,
                textShadow: '4px 4px 0 #000',
                letterSpacing: '-1px'
              }}>
                GAME OVER
              </div>
              <div className="text-white mb-8" style={{
                ...pixelatedStyle,
                fontSize: `${gameSize.width * 0.05}px`,
                textShadow: '2px 2px 0 #000'
              }}>
                SCORE: {score}
              </div>
              <button 
                onClick={handleJump}
                className="px-6 py-3 bg-yellow-500 text-yellow-900 border-4 border-yellow-600"
                style={{
                  ...pixelatedStyle,
                  fontSize: `${gameSize.width * 0.04}px`,
                  boxShadow: '4px 4px 0 #000',
                }}
              >
                CONTINUE?
              </button>
            </div>
          )}
          
          {/* Retro vignette effect - simplify for performance */}
          {ENABLE_ANIMATIONS && (
            <div 
              className="absolute inset-0 pointer-events-none z-30"
              style={{
                boxShadow: 'inset 0 0 150px rgba(0,0,0,0.7)',
                borderRadius: '10px'
              }}
            />
          )}
        </div>
      </div>
      
      {/* CSS animations for background elements */}
      <style jsx>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        
        @keyframes bounce {
          0% { transform: translateY(0); }
          100% { transform: translateY(-10px); }
        }
        
        @keyframes sunPulse {
          0% { transform: scale(1); opacity: 0.9; }
          100% { transform: scale(1.05); opacity: 1; }
        }
        
        @keyframes skyColor {
          0% { background: linear-gradient(to bottom, #1e40af, #3b82f6, #93c5fd); }
          50% { background: linear-gradient(to bottom, #312e81, #4f46e5, #818cf8); }
          100% { background: linear-gradient(to bottom, #0c4a6e, #0369a1, #0ea5e9); }
        }
        
        @keyframes dayNightCycle {
          0% { filter: brightness(1) hue-rotate(0deg); }
          25% { filter: brightness(1.1) hue-rotate(10deg); }
          50% { filter: brightness(0.8) hue-rotate(-10deg); }
          75% { filter: brightness(0.9) hue-rotate(-20deg); }
          100% { filter: brightness(1) hue-rotate(0deg); }
        }
        
        @keyframes scrollGround {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}

export default App