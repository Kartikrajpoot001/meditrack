import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export interface WardBedData {
  id: string;
  bedNumber: string;
  ward: string;
  type: string;
  status: 'available' | 'occupied' | 'maintenance';
  patientId?: string;
  patientName?: string;
  row: number;
  col: number;
}

interface WardFloor3DViewProps {
  beds: WardBedData[];
  selectedBedId: string | null;
  onSelectBed: (bedId: string) => void;
  className?: string;
  activeWard?: string;
}

export const WardFloor3DView: React.FC<WardFloor3DViewProps> = ({
  beds,
  selectedBedId,
  onSelectBed,
  className = 'h-72 w-full',
  activeWard,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [webGlFailed, setWebGlFailed] = useState(false);
  const onSelectBedRef = useRef(onSelectBed);
  onSelectBedRef.current = onSelectBed;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Check WebGL availability
    const testCanvas = document.createElement('canvas');
    const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
    if (!gl) {
      setWebGlFailed(true);
      return;
    }

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 280;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc); // Plain white/grey background

    // Isometric perspective camera
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    let cameraDistance = 14;
    let cameraAngleY = Math.PI / 4;
    let cameraAngleX = 0.55;

    const updateCameraPos = () => {
      camera.position.x = cameraDistance * Math.sin(cameraAngleY) * Math.cos(cameraAngleX);
      camera.position.y = cameraDistance * Math.sin(cameraAngleX);
      camera.position.z = cameraDistance * Math.cos(cameraAngleY) * Math.cos(cameraAngleX);
      camera.lookAt(0, 0, 0);
    };
    updateCameraPos();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);
    } catch {
      setWebGlFailed(true);
      return;
    }

    // Flat, plain hospital lighting (no neon or colored glows)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight.position.set(10, 15, 10);
    scene.add(dirLight);

    // Ward Floor: Plain grey floor plane
    const floorGeo = new THREE.PlaneGeometry(12, 8);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshBasicMaterial({ color: 0xeeeff2 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.05;
    scene.add(floor);

    // Floor grid line markings (partition boundaries)
    const gridHelper = new THREE.GridHelper(12, 12, 0xd1d5db, 0xe2e8f0);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // Bed meshes map for raycasting
    const bedMeshes: { mesh: THREE.Mesh; bedId: string }[] = [];
    const bedGroup = new THREE.Group();

    // Bed geometries
    const bedBaseGeo = new THREE.BoxGeometry(1.4, 0.45, 0.85);
    const pillowGeo = new THREE.BoxGeometry(0.3, 0.12, 0.65);

    beds.forEach((bed) => {
      // Calculate coordinates: 2 rows (Z = -1.8, Z = 1.8), columns spread across X
      const xPos = (bed.col - 2.5) * 2.2;
      const zPos = (bed.row - 0.5) * 3.6;

      // Color mapping: Green (available), Red (occupied), Amber (maintenance)
      let colorHex = 0x10b981; // green
      if (bed.status === 'occupied') colorHex = 0xd32f2f; // clinical red
      else if (bed.status === 'maintenance') colorHex = 0xf59e0b; // amber

      const isSelected = bed.id === selectedBedId;

      const bedMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.5,
        metalness: 0.05,
      });

      const singleBed = new THREE.Mesh(bedBaseGeo, bedMat);
      singleBed.position.set(xPos, 0.22, zPos);
      singleBed.userData = { bedId: bed.id };

      // Pillow on headrest
      const pillowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
      const pillow = new THREE.Mesh(pillowGeo, pillowMat);
      pillow.position.set(xPos - 0.5, 0.5, zPos);
      singleBed.add(pillow);

      // Selection ring indicator if selected
      if (isSelected) {
        const selGeo = new THREE.BoxGeometry(1.6, 0.05, 1.05);
        const selMat = new THREE.MeshBasicMaterial({ color: 0x0e7c7b });
        const selMesh = new THREE.Mesh(selGeo, selMat);
        selMesh.position.y = -0.2;
        singleBed.add(selMesh);
      }

      bedGroup.add(singleBed);
      bedMeshes.push({ mesh: singleBed, bedId: bed.id });
    });

    scene.add(bedGroup);

    // Interactive Drag to Rotate and Scroll to Zoom
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;

      cameraAngleY -= deltaX * 0.008;
      cameraAngleX = Math.max(0.15, Math.min(1.4, cameraAngleX + deltaY * 0.008));

      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
      updateCameraPos();
    };

    const onMouseUp = (e: MouseEvent) => {
      // Check for click/raycast selection if not dragged far
      const totalMoved = Math.abs(e.clientX - prevMouseX) + Math.abs(e.clientY - prevMouseY);
      if (totalMoved < 5) {
        const rect = renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);

        const intersects = raycaster.intersectObjects(
          bedMeshes.map((b) => b.mesh),
          true
        );
        if (intersects.length > 0) {
          let hitObj: THREE.Object3D | null = intersects[0].object;
          while (hitObj && !hitObj.userData.bedId && hitObj.parent) {
            hitObj = hitObj.parent;
          }
          if (hitObj && hitObj.userData.bedId) {
            onSelectBedRef.current(hitObj.userData.bedId);
          }
        }
      }
      isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraDistance = Math.max(8, Math.min(22, cameraDistance + e.deltaY * 0.015));
      updateCameraPos();
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    domEl.addEventListener('wheel', onWheel, { passive: false });

    // Render loop
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      domEl.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      domEl.removeEventListener('wheel', onWheel);

      bedBaseGeo.dispose();
      pillowGeo.dispose();
      floorGeo.dispose();
      floorMat.dispose();

      if (domEl && container.contains(domEl)) {
        container.removeChild(domEl);
      }
      renderer.dispose();
    };
  }, [beds, selectedBedId]);

  if (webGlFailed) {
    // 2D floorplan fallback
    return (
      <div className={`p-4 bg-white border border-[#E3E8EB] rounded-[8px] ${className} overflow-x-auto`}>
        <div className="text-xs text-slate-500 mb-2 font-medium">Ward Floor Plan (2D Overview):</div>
        <div className="grid grid-cols-6 gap-2">
          {beds.map((b) => (
            <button
              key={b.id}
              onClick={() => onSelectBed(b.id)}
              className={`p-2.5 rounded-[6px] border text-xs text-left transition-colors ${
                selectedBedId === b.id
                  ? 'border-[#0E7C7B] ring-2 ring-[#0E7C7B]/30'
                  : 'border-[#E3E8EB]'
              } ${
                b.status === 'available'
                  ? 'bg-emerald-50 text-emerald-800'
                  : b.status === 'occupied'
                  ? 'bg-rose-50 text-rose-800'
                  : 'bg-amber-50 text-amber-800'
              }`}
            >
              <div className="font-bold">{b.bedNumber}</div>
              <div className="text-[10px] capitalize">{b.status}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative border border-[#E3E8EB] rounded-[8px] overflow-hidden bg-slate-50 ${className}`}>
      {/* 3D Canvas Mount */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Subtle Legend overlay */}
      <div className="absolute top-2 left-2 bg-white/95 border border-[#E3E8EB] rounded-[6px] px-2.5 py-1 text-xs flex items-center gap-3 pointer-events-none select-none text-slate-600">
        <span className="font-medium text-slate-800">Isometric Ward 3D</span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#10B981]" /> Available
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#D32F2F]" /> Occupied
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#F59E0B]" /> Maintenance
        </span>
        <span className="text-[11px] text-slate-400 border-l border-slate-200 pl-2">
          Drag to rotate • Scroll to zoom • Click bed to select
        </span>
      </div>
    </div>
  );
};
