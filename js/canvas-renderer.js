/**
 * SweetSpot - Renderizador 2D Interactivo de Estudio en Canvas
 * 
 * Dibuja en tiempo real (60 FPS):
 * - Plano arquitectónico con cuadrícula métrica y cotas acotadas
 * - Monitores estéreo (bafle, woofer, tweeter y ángulo de toe-in)
 * - Posición del oyente (Sweet Spot con orejas y orientación)
 * - Triángulo equilátero con distancias y ángulos en tiempo real
 * - Línea del 38% de Wes Lachot y zona crítica del nodo central (50%)
 * - Trazado de rayos de reflexión especular temprana (paredes laterales, frontal y trasera)
 * - Puntos de tratamiento acústico RFZ (Reflection Free Zone) sobre los muros
 * - Mapa de calor modal 2D interactivo (antinodos y nodos de presión)
 * - Soporte para arrastrar y soltar (drag & drop) táctil y con mouse
 */

import { calculateMirrorReflectionRay } from './acoustics.js';

export class StudioCanvasRenderer {
  constructor(canvasElement, onStateChange) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.onStateChange = onStateChange;

    // Estado geométrico por defecto (en metros)
    this.state = {
      room: { L: 5.2, W: 4.0, H: 2.6 },
      listener: { x: 2.0, y: 1.98, z: 1.20 }, // 1.98 m ≈ 38% de 5.2 m
      leftMon: { x: 1.20, y: 0.85, z: 1.20, toeIn: 30 },
      rightMon: { x: 2.80, y: 0.85, z: 1.20, toeIn: -30 },
      stereoLinked: true,
      autoToeIn: true,
      showRays: true,
      showTriangle: true,
      show38Rule: true,
      showRFZ: true,
      showHeatmap: false,
      activeHeatmapMode: { nx: 1, ny: 0 }
    };

    // Parámetros de vista (zoom, pan, márgenes)
    this.padding = 65; // píxeles alrededor de la sala
    this.scale = 1.0;
    this.offsetX = 0;
    this.offsetY = 0;

    // Estado de interacción (arrastre)
    this.draggingObject = null;
    this.hoverObject = null;

    this.initEvents();
    this.resize();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width || 800;
    const height = rect.height || 600;

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.ctx.resetTransform();
    this.ctx.scale(dpr, dpr);

    this.displayWidth = width;
    this.displayHeight = height;

    // Calcular escala métrica a píxeles
    const availW = width - 2 * this.padding;
    const availH = height - 2 * this.padding;
    const scaleX = availW / this.state.room.W;
    const scaleY = availH / this.state.room.L;
    this.scale = Math.min(scaleX, scaleY);

    // Centrar la sala en el lienzo
    this.offsetX = (width - this.state.room.W * this.scale) / 2;
    this.offsetY = (height - this.state.room.L * this.scale) / 2;

    this.render();
  }

  // Conversión de coordenadas: metros -> píxeles en canvas
  toCanvasX(mX) {
    return this.offsetX + mX * this.scale;
  }

  toCanvasY(mY) {
    // Eje Y: 0 es pared frontal (arriba), L es pared trasera (abajo)
    return this.offsetY + mY * this.scale;
  }

  // Conversión inversa: píxeles en canvas -> metros
  toMetersX(cX) {
    return (cX - this.offsetX) / this.scale;
  }

  toMetersY(cY) {
    return (cY - this.offsetY) / this.scale;
  }

  updateState(newState) {
    Object.assign(this.state, newState);
    if (this.state.autoToeIn) {
      this.recalculateToeIn();
    }
    this.render();
  }

  recalculateToeIn() {
    const { leftMon, rightMon, listener } = this.state;
    // Ángulo desde el monitor izquierdo hacia el oyente
    const angleLeftRad = Math.atan2(listener.x - leftMon.x, listener.y - leftMon.y);
    leftMon.toeIn = (angleLeftRad * 180) / Math.PI;

    // Ángulo desde el monitor derecho hacia el oyente
    const angleRightRad = Math.atan2(listener.x - rightMon.x, listener.y - rightMon.y);
    rightMon.toeIn = (angleRightRad * 180) / Math.PI;
  }

  initEvents() {
    window.addEventListener('resize', () => this.resize());

    const getPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    };

    const handlePointerDown = (e) => {
      const pos = getPos(e);
      const hit = this.hitTest(pos.x, pos.y);
      if (hit) {
        this.draggingObject = hit;
        this.canvas.style.cursor = 'grabbing';
        e.preventDefault();
      }
    };

    const handlePointerMove = (e) => {
      const pos = getPos(e);
      if (this.draggingObject) {
        const mX = Math.max(0.15, Math.min(this.state.room.W - 0.15, this.toMetersX(pos.x)));
        const mY = Math.max(0.15, Math.min(this.state.room.L - 0.15, this.toMetersY(pos.y)));

        if (this.draggingObject === 'listener') {
          this.state.listener.x = Math.round(mX * 100) / 100;
          this.state.listener.y = Math.round(mY * 100) / 100;
        } else if (this.draggingObject === 'leftMon') {
          this.state.leftMon.x = Math.round(mX * 100) / 100;
          this.state.leftMon.y = Math.round(mY * 100) / 100;
          if (this.state.stereoLinked) {
            // Reflejar simétricamente en X respecto al eje central W/2
            const distFromCenter = (this.state.room.W / 2) - this.state.leftMon.x;
            this.state.rightMon.x = Math.round(((this.state.room.W / 2) + distFromCenter) * 100) / 100;
            this.state.rightMon.y = this.state.leftMon.y;
          }
        } else if (this.draggingObject === 'rightMon') {
          this.state.rightMon.x = Math.round(mX * 100) / 100;
          this.state.rightMon.y = Math.round(mY * 100) / 100;
          if (this.state.stereoLinked) {
            const distFromCenter = this.state.rightMon.x - (this.state.room.W / 2);
            this.state.leftMon.x = Math.round(((this.state.room.W / 2) - distFromCenter) * 100) / 100;
            this.state.leftMon.y = this.state.rightMon.y;
          }
        }

        if (this.state.autoToeIn) {
          this.recalculateToeIn();
        }

        this.render();
        if (this.onStateChange) this.onStateChange(this.state);
      } else {
        const hit = this.hitTest(pos.x, pos.y);
        this.hoverObject = hit;
        this.canvas.style.cursor = hit ? 'grab' : 'default';
      }
    };

    const handlePointerUp = () => {
      if (this.draggingObject) {
        this.draggingObject = null;
        this.canvas.style.cursor = this.hoverObject ? 'grab' : 'default';
        if (this.onStateChange) this.onStateChange(this.state);
      }
    };

    this.canvas.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    this.canvas.addEventListener('touchstart', handlePointerDown, { passive: false });
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('touchend', handlePointerUp);
  }

  hitTest(px, py) {
    const threshold = 22; // radio de detección en píxeles

    const lx = this.toCanvasX(this.state.listener.x);
    const ly = this.toCanvasY(this.state.listener.y);
    if (Math.hypot(px - lx, py - ly) <= threshold) return 'listener';

    const lmx = this.toCanvasX(this.state.leftMon.x);
    const lmy = this.toCanvasY(this.state.leftMon.y);
    if (Math.hypot(px - lmx, py - lmy) <= threshold) return 'leftMon';

    const rmx = this.toCanvasX(this.state.rightMon.x);
    const rmy = this.toCanvasY(this.state.rightMon.y);
    if (Math.hypot(px - rmx, py - rmy) <= threshold) return 'rightMon';

    return null;
  }

  render() {
    const { ctx, displayWidth, displayHeight } = this;
    const { room, listener, leftMon, rightMon } = this.state;

    // 1. Limpieza de fondo estilo blueprint de sala acústica
    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    // 2. Dibujar cuadrícula métrica de fondo
    this.drawGrid();

    // 3. Mapa de calor modal (si está activado)
    if (this.state.showHeatmap && this.state.activeHeatmapMode) {
      this.drawModalHeatmap();
    }

    // 4. Guías acústicas (Línea del 38% y Zona Crítica del 50%)
    if (this.state.show38Rule) {
      this.drawAcousticRules();
    }

    // 5. Trazado de rayos y puntos de reflexión especular RFZ
    if (this.state.showRays) {
      this.drawReflectionRays();
    }

    // 6. Triángulo estéreo equilátero
    if (this.state.showTriangle) {
      this.drawStereoTriangle();
    }

    // 7. Paredes de la sala y cotas perimetrales
    this.drawRoomWalls();

    // 8. Dibujar monitores de estudio
    this.drawMonitor(leftMon, 'L', this.hoverObject === 'leftMon' || this.draggingObject === 'leftMon');
    this.drawMonitor(rightMon, 'R', this.hoverObject === 'rightMon' || this.draggingObject === 'rightMon');

    // 9. Dibujar oyente (Sweet Spot)
    this.drawListener(listener, this.hoverObject === 'listener' || this.draggingObject === 'listener');
  }

  drawGrid() {
    const { ctx } = this;
    const { room } = this.state;

    const rX = this.toCanvasX(0);
    const rY = this.toCanvasY(0);
    const rW = room.W * this.scale;
    const rH = room.L * this.scale;

    ctx.save();
    // Cuadrícula interior cada 0.5 m
    ctx.strokeStyle = '#161e2e';
    ctx.lineWidth = 1;
    for (let x = 0.5; x < room.W; x += 0.5) {
      const cx = this.toCanvasX(x);
      ctx.beginPath();
      ctx.moveTo(cx, rY);
      ctx.lineTo(cx, rY + rH);
      ctx.stroke();
    }
    for (let y = 0.5; y < room.L; y += 0.5) {
      const cy = this.toCanvasY(y);
      ctx.beginPath();
      ctx.moveTo(rX, cy);
      ctx.lineTo(rX + rW, cy);
      ctx.stroke();
    }

    // Cuadrícula principal cada 1.0 m
    ctx.strokeStyle = '#202d42';
    ctx.lineWidth = 1.2;
    for (let x = 1.0; x < room.W; x += 1.0) {
      const cx = this.toCanvasX(x);
      ctx.beginPath();
      ctx.moveTo(cx, rY);
      ctx.lineTo(cx, rY + rH);
      ctx.stroke();
    }
    for (let y = 1.0; y < room.L; y += 1.0) {
      const cy = this.toCanvasY(y);
      ctx.beginPath();
      ctx.moveTo(rX, cy);
      ctx.lineTo(rX + rW, cy);
      ctx.stroke();
    }

    // Eje de simetría central X = W/2
    const midX = this.toCanvasX(room.W / 2);
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.45)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(midX, rY);
    ctx.lineTo(midX, rY + rH);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
  }

  drawAcousticRules() {
    const { ctx } = this;
    const { room } = this.state;
    const rX = this.toCanvasX(0);
    const rW = room.W * this.scale;

    ctx.save();

    // 1. Zona de peligro: 50% de la longitud (Nodo central de modos impares axiales)
    const midY = this.toCanvasY(room.L * 0.50);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
    const dangerHeight = 0.20 * this.scale;
    ctx.fillRect(rX, midY - dangerHeight / 2, rW, dangerHeight);

    ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(rX, midY);
    ctx.lineTo(rX + rW, midY);
    ctx.stroke();

    ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('NODO CENTRAL 50% (EVITAR)', rX + rW - 8, midY - 4);

    // 2. Línea dorada del 38% (Wes Lachot) desde la pared frontal
    const y38 = this.toCanvasY(room.L * 0.38);
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.7)';
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(rX, y38);
    ctx.lineTo(rX + rW, y38);
    ctx.stroke();

    ctx.fillStyle = 'rgba(16, 185, 129, 0.9)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('38% WES LACHOT (ÓPTIMO RECOMENDADO)', rX + 8, y38 - 5);

    // 3. Línea del 62% (alternativa posterior)
    const y62 = this.toCanvasY(room.L * 0.62);
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(rX, y62);
    ctx.lineTo(rX + rW, y62);
    ctx.stroke();

    ctx.restore();
  }

  drawModalHeatmap() {
    const { ctx } = this;
    const { room, activeHeatmapMode } = this.state;
    const { nx, ny } = activeHeatmapMode;

    const rX = this.toCanvasX(0);
    const rY = this.toCanvasY(0);
    const rW = room.W * this.scale;
    const rH = room.L * this.scale;

    const stepsX = 30;
    const stepsY = 30;
    const cellW = rW / stepsX;
    const cellH = rH / stepsY;

    ctx.save();
    for (let j = 0; j < stepsY; j++) {
      const y = ((j + 0.5) / stepsY) * room.L;
      for (let i = 0; i < stepsX; i++) {
        const x = ((i + 0.5) / stepsX) * room.W;
        // Presión acústica estacionaria normalizada (-1.0 a +1.0)
        const p = Math.cos((nx * Math.PI * x) / room.W) * Math.cos((ny * Math.PI * y) / room.L);
        const absP = Math.abs(p);

        // Mapa de color: Rojo/Magenta para antinodos (alta presión), transparente para nodos
        if (p > 0) {
          ctx.fillStyle = `rgba(239, 68, 68, ${absP * 0.35})`;
        } else {
          ctx.fillStyle = `rgba(59, 130, 246, ${absP * 0.35})`;
        }
        ctx.fillRect(rX + i * cellW, rY + j * cellH, cellW + 0.5, cellH + 0.5);
      }
    }

    // Etiqueta del modo activo
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`MAPA DE PRESIÓN MODAL: (${nx}, ${ny}, 0)`, rX + 10, rY + 20);

    ctx.restore();
  }

  drawStereoTriangle() {
    const { ctx } = this;
    const { listener, leftMon, rightMon } = this.state;

    const lx = this.toCanvasX(listener.x);
    const ly = this.toCanvasY(listener.y);
    const lmx = this.toCanvasX(leftMon.x);
    const lmy = this.toCanvasY(leftMon.y);
    const rmx = this.toCanvasX(rightMon.x);
    const rmy = this.toCanvasY(rightMon.y);

    const distMM = Math.hypot(rightMon.x - leftMon.x, rightMon.y - leftMon.y);
    const distML = Math.hypot(listener.x - leftMon.x, listener.y - leftMon.y);
    const distMR = Math.hypot(listener.x - rightMon.x, listener.y - rightMon.y);

    // Calcular desviación del triángulo equilátero
    const maxDiff = Math.max(Math.abs(distMM - distML), Math.abs(distMM - distMR), Math.abs(distML - distMR));
    const isEquilateral = maxDiff <= 0.05;

    ctx.save();

    // Relleno suave del cono de escucha
    ctx.fillStyle = isEquilateral ? 'rgba(6, 182, 212, 0.04)' : 'rgba(245, 158, 11, 0.04)';
    ctx.beginPath();
    ctx.moveTo(lmx, lmy);
    ctx.lineTo(rmx, rmy);
    ctx.lineTo(lx, ly);
    ctx.closePath();
    ctx.fill();

    // Líneas del triángulo
    ctx.strokeStyle = isEquilateral ? 'rgba(6, 182, 212, 0.6)' : 'rgba(245, 158, 11, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(lmx, lmy);
    ctx.lineTo(rmx, rmy);
    ctx.lineTo(lx, ly);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // Etiquetas de distancias
    ctx.font = '10px monospace';
    ctx.fillStyle = '#06b6d4';
    ctx.textAlign = 'center';

    // Distancia Mon-Mon
    const midMMX = (lmx + rmx) / 2;
    const midMMY = (lmy + rmy) / 2 - 8;
    ctx.fillText(`${distMM.toFixed(2)} m`, midMMX, midMMY);

    // Distancia Left-Listener
    const midMLX = (lmx + lx) / 2 - 18;
    const midMLY = (lmy + ly) / 2;
    ctx.fillText(`${distML.toFixed(2)} m`, midMLX, midMLY);

    // Distancia Right-Listener
    const midMRX = (rmx + lx) / 2 + 18;
    const midMRY = (rmy + ly) / 2;
    ctx.fillText(`${distMR.toFixed(2)} m`, midMRX, midMRY);

    ctx.restore();
  }

  drawReflectionRays() {
    const { ctx } = this;
    const { room, listener, leftMon, rightMon, showRFZ } = this.state;
    const lx = this.toCanvasX(listener.x);
    const ly = this.toCanvasY(listener.y);

    const monitors = [
      { mon: leftMon, color: 'rgba(56, 189, 248, 0.45)', tag: 'L' },
      { mon: rightMon, color: 'rgba(167, 139, 250, 0.45)', tag: 'R' }
    ];

    const walls = ['left', 'right', 'front'];

    ctx.save();
    monitors.forEach(({ mon, color }) => {
      const mx = this.toCanvasX(mon.x);
      const my = this.toCanvasY(mon.y);

      walls.forEach(wall => {
        const spec = calculateMirrorReflectionRay(mon, listener, wall, room);
        if (spec && spec.valid) {
          const sx = this.toCanvasX(spec.x);
          const sy = this.toCanvasY(spec.y);

          // Rayo de incidencia: Monitor -> Punto de reflexión
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(mx, my);
          ctx.lineTo(sx, sy);
          ctx.stroke();

          // Rayo reflejado: Punto de reflexión -> Oyente
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(lx, ly);
          ctx.stroke();

          // Parche de tratamiento RFZ sobre el muro
          if (showRFZ) {
            ctx.setLineDash([]);
            ctx.fillStyle = '#f59e0b';
            ctx.strokeStyle = '#d97706';
            ctx.lineWidth = 2;

            if (wall === 'left' || wall === 'right') {
              const padH = 0.6 * this.scale; // Panel acústico de 60 cm
              ctx.fillRect(sx - (wall === 'left' ? 4 : 2), sy - padH / 2, 6, padH);
              ctx.strokeRect(sx - (wall === 'left' ? 4 : 2), sy - padH / 2, 6, padH);
            } else if (wall === 'front') {
              const padW = 0.6 * this.scale;
              ctx.fillRect(sx - padW / 2, sy - 2, padW, 6);
              ctx.strokeRect(sx - padW / 2, sy - 2, padW, 6);
            }

            // Halo del punto de espejo
            ctx.fillStyle = 'rgba(245, 158, 11, 0.8)';
            ctx.beginPath();
            ctx.arc(sx, sy, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      });
    });

    ctx.restore();
  }

  drawRoomWalls() {
    const { ctx } = this;
    const { room } = this.state;

    const rX = this.toCanvasX(0);
    const rY = this.toCanvasY(0);
    const rW = room.W * this.scale;
    const rH = room.L * this.scale;

    ctx.save();

    // Muros perimetrales con grosor y sombra arquitectónica
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.strokeRect(rX, rY, rW, rH);

    // Borde exterior arquitectónico
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.strokeRect(rX - 6, rY - 6, rW + 12, rH + 12);

    // Cotas métricas en los extremos
    ctx.font = '11px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';

    // Cota horizontal superior (Ancho W)
    ctx.fillText(`${room.W.toFixed(2)} m (Ancho W)`, rX + rW / 2, rY - 14);
    this.drawDimensionArrow(rX, rY - 8, rX + rW, rY - 8);

    // Cota vertical izquierda (Largo L)
    ctx.save();
    ctx.translate(rX - 16, rY + rH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${room.L.toFixed(2)} m (Largo L)`, 0, 0);
    ctx.restore();
    this.drawDimensionArrow(rX - 8, rY, rX - 8, rY + rH);

    // Etiquetas de muros
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('PARED FRONTAL (y = 0)', rX + rW / 2, rY + 14);
    ctx.fillText('PARED TRASERA (y = L)', rX + rW / 2, rY + rH - 6);

    ctx.restore();
  }

  drawDimensionArrow(x1, y1, x2, y2) {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Pequeños topes perpendiculares
    const isHoriz = y1 === y2;
    if (isHoriz) {
      ctx.beginPath();
      ctx.moveTo(x1, y1 - 4); ctx.lineTo(x1, y1 + 4);
      ctx.moveTo(x2, y2 - 4); ctx.lineTo(x2, y2 + 4);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(x1 - 4, y1); ctx.lineTo(x1 + 4, y1);
      ctx.moveTo(x2 - 4, y2); ctx.lineTo(x2 + 4, y2);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawMonitor(mon, label, isHighlighted) {
    const { ctx } = this;
    const mx = this.toCanvasX(mon.x);
    const my = this.toCanvasY(mon.y);

    // Ancho y profundidad física aproximada del bafle (ej. 24 x 32 cm)
    const boxW = 0.22 * this.scale;
    const boxH = 0.30 * this.scale;

    ctx.save();
    ctx.translate(mx, my);
    // Rotar según el ángulo de toe-in (en radianes)
    ctx.rotate((mon.toeIn * Math.PI) / 180);

    // Sombra si está seleccionado/hover
    if (isHighlighted) {
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 12;
    }

    // Cuerpo del gabinete del monitor
    ctx.fillStyle = isHighlighted ? '#1e293b' : '#0f172a';
    ctx.strokeStyle = isHighlighted ? '#38bdf8' : '#475569';
    ctx.lineWidth = 2;
    ctx.fillRect(-boxW / 2, -boxH / 2, boxW, boxH);
    ctx.strokeRect(-boxW / 2, -boxH / 2, boxW, boxH);

    // Woofer (cono inferior)
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, boxH * 0.15, boxW * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Tweeter (cúpula superior)
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.arc(0, -boxH * 0.22, boxW * 0.18, 0, Math.PI * 2);
    ctx.fill();

    // Etiqueta L / R
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, 0, boxH * 0.2);

    // Flecha indicadora de frente acústico
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, boxH / 2);
    ctx.lineTo(0, boxH / 2 + 10);
    ctx.stroke();

    ctx.restore();

    // Cota de distancia a pared frontal (SBIR frontal)
    ctx.save();
    ctx.font = '9px monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'center';
    ctx.fillText(`${mon.y.toFixed(2)} m fw`, mx, my - boxH / 2 - 8);
    ctx.restore();
  }

  drawListener(listener, isHighlighted) {
    const { ctx } = this;
    const lx = this.toCanvasX(listener.x);
    const ly = this.toCanvasY(listener.y);
    const headRadius = 0.14 * this.scale;

    ctx.save();
    ctx.translate(lx, ly);

    if (isHighlighted) {
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 14;
    }

    // Cabeza del oyente
    ctx.fillStyle = isHighlighted ? '#064e3b' : '#042f2e';
    ctx.strokeStyle = isHighlighted ? '#10b981' : '#059669';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, headRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Nariz (orientación hacia pared frontal, hacia arriba)
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.moveTo(-headRadius * 0.25, -headRadius);
    ctx.lineTo(0, -headRadius * 1.35);
    ctx.lineTo(headRadius * 0.25, -headRadius);
    ctx.closePath();
    ctx.fill();

    // Orejas (izquierda y derecha)
    const earW = headRadius * 0.28;
    const earH = headRadius * 0.55;
    ctx.fillStyle = '#10b981';
    ctx.fillRect(-headRadius - earW * 0.6, -earH / 2, earW, earH);
    ctx.fillRect(headRadius - earW * 0.4, -earH / 2, earW, earH);

    // Texto Sweet Spot
    ctx.fillStyle = '#ecfdf5';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SWEET', 0, -2);
    ctx.fillText('SPOT', 0, 8);

    ctx.restore();

    // Cota de distancia del oyente a pared frontal
    ctx.save();
    ctx.font = '10px monospace';
    ctx.fillStyle = '#10b981';
    ctx.textAlign = 'left';
    ctx.fillText(`y = ${listener.y.toFixed(2)} m (${((listener.y / this.state.room.L) * 100).toFixed(1)}% L)`, lx + headRadius + 12, ly + 4);
    ctx.restore();
  }
}
