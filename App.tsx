import React, { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { createHandLandmarker } from './services/visionService';
import { ArtifactModel } from './components/ArtifactModel';

// Corrected URL for direct raw access to avoid redirect/CORS issues with the blob URL.
const ARTIFACT_URL = "https://raw.githubusercontent.com/liaoplay1019/MOXING/main/M1QSDTFZJSHXBDXS.glb";

const App: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [rotation, setRotation] = useState<[number, number, number]>([0, 0, 0]);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const lastVideoTime = useRef(-1);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    const initVision = async () => {
      try {
        const handLandmarker = await createHandLandmarker();
        const video = videoRef.current;

        if (!video) return;

        // Setup Camera Stream
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        
        video.srcObject = stream;
        video.addEventListener('loadeddata', () => {
          setIsCameraReady(true);
          predict();
        });

        const predict = () => {
          if (video && handLandmarker && video.currentTime !== lastVideoTime.current) {
            lastVideoTime.current = video.currentTime;
            
            const results = handLandmarker.detectForVideo(video, performance.now());
            
            // Interaction Logic
            if (results.landmarks.length > 0) {
              const landmarks = results.landmarks[0];
              
              // Use the wrist (landmark 0) or Index Finger Tip (landmark 8) for tracking
              // We map screen coordinates (0-1) to rotation values
              // X: 0 (left) -> 1 (right). Map to Y rotation.
              // Y: 0 (top) -> 1 (bottom). Map to X rotation.
              
              const x = landmarks[9].x; // Middle finger MCP (central point of hand)
              const y = landmarks[9].y;

              // Simple mapping: 
              // Moving hand Left/Right rotates object on Y axis
              // Moving hand Up/Down rotates object on X axis
              const rotY = (x - 0.5) * Math.PI * 4; // Range -2PI to 2PI
              const rotX = (y - 0.5) * Math.PI * 2; // Range -PI to PI
              
              setRotation([rotX, rotY, 0]);
            }
          }
          requestRef.current = requestAnimationFrame(predict);
        };

      } catch (err) {
        console.error("Error initializing camera or vision:", err);
      }
    };

    initVision();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      // Clean up stream tracks
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      {/* 1. Background Camera Feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`absolute top-0 left-0 w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-1000 ${
          isCameraReady ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ zIndex: 0 }}
      />

      {/* 2. Loading State (Minimalist) */}
      {!isCameraReady && (
        <div className="absolute inset-0 flex items-center justify-center z-50">
          <div className="w-12 h-12 border-t-2 border-r-2 border-cyan-500 rounded-full animate-spin"></div>
        </div>
      )}

      {/* 3. Three.js Canvas Overlay */}
      <div className="absolute inset-0 z-10">
        <Canvas
          shadows
          gl={{
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.0,
            alpha: true,
          }}
          camera={{ position: [0, 0, 5], fov: 45 }}
        >
          {/* Real Lighting Environment */}
          <ambientLight intensity={0.5} color="#ffffff" />
          <directionalLight 
            position={[5, 10, 7.5]} 
            intensity={1} 
            castShadow 
            shadow-mapSize-width={1024} 
            shadow-mapSize-height={1024}
          />
          {/* Environment provides realistic reflections/lighting map */}
          <Environment preset="city" />

          {/* Controls - Hybrid: Orbit allowed, but hands also drive rotation */}
          <OrbitControls 
            enablePan={false} 
            enableZoom={true} 
            enableDamping={true}
            dampingFactor={0.05}
          />

          {/* The Artifact - Wrapped to move position down */}
          <group position={[0, -0.8, 0]}>
            <ArtifactModel 
              url={ARTIFACT_URL} 
              externalRotation={rotation} 
            />
          </group>
        </Canvas>
      </div>

      {/* 4. Minimalist Overlay Effect (Vignette) */}
      <div className="absolute inset-0 pointer-events-none z-20 bg-[radial-gradient(circle_at_center,transparent_50%,rgba(0,0,0,0.8)_100%)]"></div>
    </div>
  );
};

export default App;