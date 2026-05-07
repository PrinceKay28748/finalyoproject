// WeatherOverlay.jsx - Canvas-based weather effects on map (always-on)
import { useEffect, useRef, useCallback } from 'react';
import { useMap } from 'react-leaflet';

const WeatherOverlay = ({ weather }) => {
  const map = useMap();
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const particlesRef = useRef([]);
  
  const effect = weather?.effect || 'none';
  const isActive = effect !== 'none' && effect !== 'sun' && effect !== 'sun-cloud';
  
  // Initialize particle system based on weather effect
  const initParticles = useCallback((effectType, width, height) => {
    const particleCounts = {
      'rain-heavy': 250,
      'rain': 150,
      'rain-light': 80,
      'snow-heavy': 200,
      'snow': 100,
      'storm': 300,
    };
    
    const count = particleCounts[effectType] || 0;
    const particles = [];
    
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        speed: 3 + Math.random() * 7,
        length: 10 + Math.random() * 10,
        opacity: 0.2 + Math.random() * 0.5,
        width: 1.5 + Math.random() * 1.5
      });
    }
    return particles;
  }, []);
  
  // Draw weather effects
  const draw = useCallback((ctx, width, height, weatherEffect, particles) => {
    ctx.clearRect(0, 0, width, height);
    
    const isRain = weatherEffect.includes('rain');
    const isSnow = weatherEffect.includes('snow');
    const isStorm = weatherEffect === 'storm';
    
    // Draw fog overlay
    if (weatherEffect === 'fog') {
      ctx.fillStyle = `rgba(180, 180, 190, 0.12)`;
      ctx.fillRect(0, 0, width, height);
    }
    
    // Draw clouds for overcast/cloudy
    if (weatherEffect === 'clouds' || weatherEffect === 'storm') {
      const time = Date.now() / 8000;
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        const offsetX = (time * 10 + i * 150) % (width + 200) - 100;
        ctx.ellipse(offsetX, 50 + i * 70, 60, 35, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(140, 140, 160, 0.1)`;
        ctx.fill();
      }
    }
    
    // Draw rain/snow particles
    if (particles.length > 0) {
      particles.forEach(p => {
        if (isSnow) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity * 0.7})`;
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.width, p.y + p.length);
          ctx.lineTo(p.x + p.width, p.y + p.length);
          ctx.fillStyle = `rgba(100, 150, 210, ${p.opacity * 0.6})`;
          ctx.fill();
        }
      });
    }
    
    // Lightning flash for storm
    if (isStorm && Math.random() < 0.015) {
      ctx.fillStyle = 'rgba(255, 250, 200, 0.25)';
      ctx.fillRect(0, 0, width, height);
    }
  }, []);
  
  // Animate particles
  const animate = useCallback(() => {
    if (!canvasRef.current || !isActive) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Update particle positions
    particlesRef.current.forEach(p => {
      p.y += p.speed;
      if (p.y > height + 50) {
        p.y = -50;
        p.x = Math.random() * width;
      }
      p.x += (Math.random() - 0.5) * 1.5;
    });
    
    draw(ctx, width, height, effect, particlesRef.current);
    
    animationRef.current = requestAnimationFrame(animate);
  }, [draw, effect, isActive]);
  
  // Setup canvas and resize observer
  useEffect(() => {
    if (!map || !canvasRef.current) return;
    
    const container = map.getContainer();
    const parent = container.parentElement;
    
    const updateCanvasSize = () => {
      if (!canvasRef.current) return;
      const rect = parent.getBoundingClientRect();
      canvasRef.current.width = rect.width;
      canvasRef.current.height = rect.height;
      
      // Re-initialize particles on resize
      if (isActive) {
        particlesRef.current = initParticles(effect, rect.width, rect.height);
      }
    };
    
    updateCanvasSize();
    
    const resizeObserver = new ResizeObserver(updateCanvasSize);
    resizeObserver.observe(parent);
    
    return () => resizeObserver.disconnect();
  }, [map, effect, isActive, initParticles]);
  
  // Start/stop animation based on weather effect
  useEffect(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    if (isActive && canvasRef.current) {
      const rect = canvasRef.current.parentElement?.getBoundingClientRect();
      if (rect) {
        particlesRef.current = initParticles(effect, rect.width, rect.height);
      }
      animationRef.current = requestAnimationFrame(animate);
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isActive, effect, animate, initParticles]);
  
  // Don't render if no canvas or no weather
  if (!weather || weather.effect === 'none') return null;
  
  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 500,
        borderRadius: 'inherit'
      }}
    />
  );
};

export default WeatherOverlay;