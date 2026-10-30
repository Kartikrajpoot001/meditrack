import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Heart } from 'lucide-react';

interface PatientAnatomyViewProps {
  className?: string;
  primaryColor?: string;
}

export const PatientAnatomyView: React.FC<PatientAnatomyViewProps> = ({
  className = 'w-32 h-32',
  primaryColor = '#D32F2F', // clinical red
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [webGlFailed, setWebGlFailed] = useState(false);
  const isHoveredRef = useRef(false);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Detect WebGL support
    const testCanvas = document.createElement('canvas');
    const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
    if (!gl) {
      setWebGlFailed(true);
      return;
    }

    const width = container.clientWidth || 128;
    const height = container.clientHeight || 128;

    const scene = new THREE.Scene();
    scene.background = null; // Transparent background

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0, 4.2);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);
    } catch {
      setWebGlFailed(true);
      return;
    }

    // Clean, flat clinical lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(3, 4, 3);
    scene.add(dirLight);

    // Anatomical Heart model composed from 3.js primitives
    const heartGroup = new THREE.Group();

    // Material: matte clinical finish
    const heartMaterial = new THREE.MeshStandardMaterial({
      color: primaryColor,
      roughness: 0.35,
      metalness: 0.1,
    });

    const vesselMaterial = new THREE.MeshStandardMaterial({
      color: '#1E40AF', // blue vena cava
      roughness: 0.4,
    });

    const aortaMaterial = new THREE.MeshStandardMaterial({
      color: '#B91C1C', // deeper red aorta
      roughness: 0.3,
    });

    // Left and Right Ventricles
    const leftVentricleGeo = new THREE.SphereGeometry(0.65, 24, 24);
    leftVentricleGeo.scale(1, 1.25, 0.85);
    const leftVentricle = new THREE.Mesh(leftVentricleGeo, heartMaterial);
    leftVentricle.position.set(-0.25, -0.15, 0);
    leftVentricle.rotation.z = 0.25;
    heartGroup.add(leftVentricle);

    const rightVentricleGeo = new THREE.SphereGeometry(0.58, 24, 24);
    rightVentricleGeo.scale(0.95, 1.15, 0.8);
    const rightVentricle = new THREE.Mesh(rightVentricleGeo, heartMaterial);
    rightVentricle.position.set(0.3, -0.1, 0);
    rightVentricle.rotation.z = -0.2;
    heartGroup.add(rightVentricle);

    // Apex taper (bottom of heart)
    const apexGeo = new THREE.ConeGeometry(0.55, 0.85, 20);
    apexGeo.rotateX(Math.PI);
    const apex = new THREE.Mesh(apexGeo, heartMaterial);
    apex.position.set(-0.05, -0.85, 0);
    heartGroup.add(apex);

    // Aortic Arch (Curved cylinder/torus on top)
    const aortaGeo = new THREE.TorusGeometry(0.35, 0.12, 16, 24, Math.PI * 0.85);
    const aorta = new THREE.Mesh(aortaGeo, aortaMaterial);
    aorta.position.set(0.05, 0.6, 0);
    aorta.rotation.z = -0.4;
    heartGroup.add(aorta);

    // Superior Vena Cava (Vessel)
    const cavaGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.6, 16);
    const cava = new THREE.Mesh(cavaGeo, vesselMaterial);
    cava.position.set(0.42, 0.55, -0.1);
    heartGroup.add(cava);

    // Pulmonary Artery
    const arteryGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.45, 16);
    const artery = new THREE.Mesh(arteryGeo, vesselMaterial);
    artery.position.set(-0.25, 0.55, 0.1);
    artery.rotation.z = 0.3;
    heartGroup.add(artery);

    heartGroup.position.set(0, 0.1, 0);
    scene.add(heartGroup);

    // Animation loop: slow rotation, paused on hover
    let animationFrameId: number;
    let rotationSpeed = 0.009;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (!isHoveredRef.current) {
        heartGroup.rotation.y += rotationSpeed;
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleMouseEnter = () => {
      isHoveredRef.current = true;
    };

    const handleMouseLeave = () => {
      isHoveredRef.current = false;
    };

    container.addEventListener('mouseenter', handleMouseEnter);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      cancelAnimationFrame(animationFrameId);
      container.removeEventListener('mouseenter', handleMouseEnter);
      container.removeEventListener('mouseleave', handleMouseLeave);

      leftVentricleGeo.dispose();
      rightVentricleGeo.dispose();
      apexGeo.dispose();
      aortaGeo.dispose();
      cavaGeo.dispose();
      arteryGeo.dispose();
      heartMaterial.dispose();
      vesselMaterial.dispose();
      aortaMaterial.dispose();

      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [primaryColor]);

  if (webGlFailed) {
    return (
      <div className={`flex items-center justify-center bg-slate-50 border border-[#E3E8EB] rounded-[8px] ${className}`}>
        <Heart className="w-10 h-10 text-[#D32F2F]" />
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      className={`relative select-none cursor-pointer ${className}`}
      title="Interactive 3D Vitals Visualizer (Hover to pause)"
    />
  );
};
