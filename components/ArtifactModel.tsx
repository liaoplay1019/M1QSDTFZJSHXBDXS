import React, { useEffect, useRef, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface ArtifactModelProps {
  url: string;
  externalRotation: [number, number, number];
}

export const ArtifactModel: React.FC<ArtifactModelProps> = ({ url, externalRotation }) => {
  const { scene } = useGLTF(url);
  // Group ref for rotation pivot
  const groupRef = useRef<THREE.Group>(null);
  const [processedScene, setProcessedScene] = useState<THREE.Group | null>(null);
  const [modelScale, setModelScale] = useState<number>(1);
  
  // Ref to smooth out rotation
  const currentRotation = useRef<[number, number, number]>([0, 0, 0]);

  useEffect(() => {
    if (!scene) return;

    // Deep clone the scene to allow independent manipulation
    const clone = scene.clone(true);

    // 1. Material Setup (Opaque, Shadows, DoubleSide)
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        if (mesh.material) {
           const applySettings = (mat: THREE.Material) => {
             const newMat = mat.clone(); 
             newMat.transparent = false;
             newMat.opacity = 1.0;
             newMat.blending = THREE.NormalBlending;
             newMat.side = THREE.DoubleSide; 
             newMat.needsUpdate = true;
             return newMat;
           };

           if (Array.isArray(mesh.material)) {
             mesh.material = mesh.material.map(applySettings);
           } else {
             mesh.material = applySettings(mesh.material);
           }
        }
      }
    });

    // 2. Precise Centering Logic (Midpoint of Length, Width, Height)
    // We reset the root transforms first
    clone.position.set(0, 0, 0);
    clone.rotation.set(0, 0, 0);
    clone.scale.set(1, 1, 1);
    clone.updateMatrixWorld(true);

    // Calculate box ONLY from meshes to avoid empty group artifacts
    const box = new THREE.Box3();
    let hasMeshes = false;

    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        // expandByObject uses the object's world matrix
        box.expandByObject(child);
        hasMeshes = true;
      }
    });

    if (!hasMeshes) {
      box.setFromObject(clone);
    }

    // Get the exact geometric center: (Min + Max) / 2 for all axes
    const center = new THREE.Vector3();
    box.getCenter(center);
    
    // Offset the model so this geometric center aligns with the origin (0,0,0)
    // This ensures rotation happens around the exact middle of the model
    clone.position.sub(center);

    // 3. Scaling Logic
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const targetSize = 4.0; 
    const scaleFactor = targetSize / (maxDim || 1);
    
    setModelScale(scaleFactor);
    setProcessedScene(clone);

  }, [scene]);

  // Smooth rotation interpolation applied to the wrapper group
  useFrame((_, delta) => {
    if (groupRef.current) {
        const smoothingSpeed = 5 * delta;
        
        currentRotation.current[0] = THREE.MathUtils.lerp(currentRotation.current[0], externalRotation[0], smoothingSpeed);
        currentRotation.current[1] = THREE.MathUtils.lerp(currentRotation.current[1], externalRotation[1], smoothingSpeed);
        
        groupRef.current.rotation.x = currentRotation.current[0];
        groupRef.current.rotation.y = currentRotation.current[1];
        
        // Slight idle animation
        groupRef.current.position.y = Math.sin(Date.now() * 0.001) * 0.1;
    }
  });

  if (!processedScene) return null;

  return (
    // The group serves as the pivot point (0,0,0)
    <group ref={groupRef} dispose={null}>
      {/* The primitive is offset internally so its center aligns with the group origin */}
      <primitive 
        object={processedScene} 
        scale={[modelScale, modelScale, modelScale]} 
      />
    </group>
  );
};