/**
 * SweetSpot — Renderizador 2D de planta de sala en Canvas
 * Estética de plano arquitectónico sobre fondo claro con cotas métricas.
 */

import { calculateMirrorReflectionRay } from './acoustics.js';

const FONT_MONO = "'IBM Plex Mono', Consolas, Menlo, monospace";
const FONT_SANS = "'IBM Plex Sans', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

export class StudioCanvasRenderer {
  constructor(canvasElement, onStateChange) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.onStateChange = onStateChange;

    this.state = {
      room: { L: 4.8, W: 3.6, H: 2.5 },
      listener: { x: 1.8, y: 1.82, z: 1.2 },
      leftMon: { x: 1.05, y: 0.65, z: 1.2, toeIn: 30 },
      rightMon: { x: 2.55, y: 0.65, z: 1.2, toeIn: -30 },
      stereoLinked: true,
      autoToeIn: true,
      showRays: true,
      showTriangle: true,
      show38Rule: true,
      showRFZ: true,
      showHeatmap: false,
      activeHeatmapMode: { nx: 1, ny: 0 }
    };

    this.padding = 58;
    this.scale = 1.0;
    this.offsetX = 0;
    this.offsetY = 0;

    this.draggingObject = null;
    this.hoverObject = null;

    this.initEvents();
    this.resize();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width || 720;
    const height = rect.height || 500;

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.ctx.resetTransform();
    this.ctx.scale(dpr, dpr);

    this.displayWidth = width;
    this.displayHeight = height;

    const availW = width - 2 * this.padding;
    const availH = height - 2 * this.padding;
    const scaleX = availW / this.state.room.W;
    const scaleY = availH / this.state.room.L;
    this.scale = Math.min(scaleX, scaleY);

    this.offsetX = (width - this.state.room.W * this.scale) / 2;
    this.offsetY = (height - this.state.room.L * this.scale) / 2;

    this.render();
  }

  toCanvasX(mX) {
    return this.offsetX + mX * this.scale;
  }

  toCanvasY(mY) {
    return this.offsetY + mY * this.scale;
  }

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
    const angleLeftRad = Math.atan2(listener.x - leftMon.x, listener.y - leftMon.y);
    leftMon.toeIn = (angleLeftRad * 180) / Math.PI;

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
        if (hit !== this.hoverObject) {
          this.hoverObject = hit;
          this.render();
        }
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
    const threshold = 22;

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

  drawTextWithHalo(text, x, y, fillStyle, font, align = 'center') {
    const { ctx } = this;
    ctx.save();
    ctx.font = font;
    ctx.textAlign = align;
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fillStyle;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  render() {
    const { ctx, displayWidth, displayHeight } = this;
    const { room, listener, leftMon, rightMon } = this.state;

    // Fondo exterior tipo mesa de dibujo
    ctx.fillStyle = '#f2f1ec';
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    // Interior de la sala en blanco puro
    const rX = this.toCanvasX(0);
    const rY = this.toCanvasY(0);
    const rW = room.W * this.scale;
    const rH = room.L * this.scale;

    // Espesor de muro exterior arquitectónico
    const wallT = 6;
    ctx.fillStyle = '#e2e0d7';
    ctx.fillRect(rX - wallT, rY - wallT, rW + wallT * 2, rH + wallT * 2);
    ctx.strokeStyle = '#bcbab0';
    ctx.lineWidth = 1;
    ctx.strokeRect(rX - wallT, rY - wallT, rW + wallT * 2, rH + wallT * 2);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(rX, rY, rW, rH);

    // 1. Cuadrícula métrica
    this.drawGrid();

    // 2. Mapa de presión modal
    if (this.state.showHeatmap && this.state.activeHeatmapMode) {
      this.drawModalHeatmap();
    }

    // 3. Guías 38% y 50%
    if (this.state.show38Rule) {
      this.drawAcousticRules();
    }

    // 4. Rayos de primera reflexión y RFZ
    if (this.state.showRays) {
      this.drawReflectionRays();
    }

    // 5. Triángulo estéreo
    if (this.state.showTriangle) {
      this.drawStereoTriangle();
    }

    // 6. Perímetro interior de muros y cotas
    this.drawRoomWalls();

    // 7. Monitores L y R
    this.drawMonitor(leftMon, 'L', this.hoverObject === 'leftMon' || this.draggingObject === 'leftMon');
    this.drawMonitor(rightMon, 'R', this.hoverObject === 'rightMon' || this.draggingObject === 'rightMon');

    // 8. Oyente
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

    // Subdivisión cada 0.5 m
    ctx.strokeStyle = '#f1f0ea';
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

    // Retícula principal cada 1.0 m
    ctx.strokeStyle = '#e3e1d8';
    ctx.lineWidth = 1;
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

    // Eje central longitudinal X = W/2
    const midX = this.toCanvasX(room.W / 2);
    ctx.strokeStyle = 'rgba(115, 114, 107, 0.45)';
    ctx.lineWidth = 1;
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

    // Franja del nodo central (50% L)
    const midY = this.toCanvasY(room.L * 0.5);
    const bandH = 0.22 * this.scale;
    ctx.fillStyle = 'rgba(180, 35, 24, 0.06)';
    ctx.fillRect(rX, midY - bandH / 2, rW, bandH);

    ctx.strokeStyle = 'rgba(180, 35, 24, 0.55)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(rX, midY);
    ctx.lineTo(rX + rW, midY);
    ctx.stroke();

    this.drawTextWithHalo(
      '50% L · nodo axial impar',
      rX + rW - 8,
      midY + 12,
      '#9e2219',
      `500 10px ${FONT_MONO}`,
      'right'
    );

    // Línea de referencia 38% (Wes Lachot)
    const y38 = this.toCanvasY(room.L * 0.38);
    ctx.strokeStyle = 'rgba(30, 107, 69, 0.65)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(rX, y38);
    ctx.lineTo(rX + rW, y38);
    ctx.stroke();

    this.drawTextWithHalo(
      '38% L (ref.)',
      rX + 8,
      y38 - 5,
      '#1e6b45',
      `500 10px ${FONT_MONO}`,
      'left'
    );

    // Referencia secundaria 62%
    const y62 = this.toCanvasY(room.L * 0.62);
    ctx.strokeStyle = 'rgba(30, 107, 69, 0.32)';
    ctx.lineWidth = 1;
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

    const stepsX = 44;
    const stepsY = 44;
    const cellW = rW / stepsX;
    const cellH = rH / stepsY;

    ctx.save();
    for (let j = 0; j < stepsY; j++) {
      const y = ((j + 0.5) / stepsY) * room.L;
      for (let i = 0; i < stepsX; i++) {
        const x = ((i + 0.5) / stepsX) * room.W;
        const p = Math.cos((nx * Math.PI * x) / room.W) * Math.cos((ny * Math.PI * y) / room.L);
        const absP = Math.abs(p);

        if (p > 0) {
          ctx.fillStyle = `rgba(180, 35, 24, ${absP * 0.28})`;
        } else {
          ctx.fillStyle = `rgba(36, 107, 163, ${absP * 0.28})`;
        }
        ctx.fillRect(rX + i * cellW, rY + j * cellH, cellW + 0.6, cellH + 0.6);
      }
    }

    // Cartela legible en la esquina inferior izquierda (evita solapar monitores)
    const tagText = `Presión modal (${nx}, ${ny}, 0)`;
    ctx.font = `500 10px ${FONT_MONO}`;
    const tagW = ctx.measureText(tagText).width + 14;
    const tagY = rY + rH - 40;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.strokeStyle = '#d7d5cc';
    ctx.lineWidth = 1;
    ctx.fillRect(rX + 8, tagY, tagW, 20);
    ctx.strokeRect(rX + 8, tagY, tagW, 20);

    ctx.fillStyle = '#191918';
    ctx.textAlign = 'left';
    ctx.fillText(tagText, rX + 15, tagY + 13);

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

    const maxDiff = Math.max(
      Math.abs(distMM - distML),
      Math.abs(distMM - distMR),
      Math.abs(distML - distMR)
    );
    const isEquilateral = maxDiff <= 0.05;

    ctx.save();

    ctx.fillStyle = isEquilateral
      ? 'rgba(27, 73, 101, 0.045)'
      : 'rgba(161, 92, 7, 0.045)';
    ctx.beginPath();
    ctx.moveTo(lmx, lmy);
    ctx.lineTo(rmx, rmy);
    ctx.lineTo(lx, ly);
    ctx.closePath();
    ctx.fill();

    const strokeColor = isEquilateral ? '#1b4965' : '#a15c07';
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.25;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(lmx, lmy);
    ctx.lineTo(rmx, rmy);
    ctx.lineTo(lx, ly);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    const labelFont = `500 10px ${FONT_MONO}`;
    this.drawTextWithHalo(
      `${distMM.toFixed(2)} m`,
      (lmx + rmx) / 2,
      (lmy + rmy) / 2 - 7,
      strokeColor,
      labelFont,
      'center'
    );
    this.drawTextWithHalo(
      `${distML.toFixed(2)} m`,
      (lmx + lx) / 2 - 20,
      (lmy + ly) / 2 + 2,
      strokeColor,
      labelFont,
      'center'
    );
    this.drawTextWithHalo(
      `${distMR.toFixed(2)} m`,
      (rmx + lx) / 2 + 20,
      (rmy + ly) / 2 + 2,
      strokeColor,
      labelFont,
      'center'
    );

    ctx.restore();
  }

  drawReflectionRays() {
    const { ctx } = this;
    const { room, listener, leftMon, rightMon, showRFZ } = this.state;
    const lx = this.toCanvasX(listener.x);
    const ly = this.toCanvasY(listener.y);

    const monitors = [
      { mon: leftMon, color: 'rgba(27, 73, 101, 0.36)' },
      { mon: rightMon, color: 'rgba(146, 78, 22, 0.34)' }
    ];

    const walls = ['left', 'right', 'front'];

    ctx.save();
    monitors.forEach(({ mon, color }) => {
      const mx = this.toCanvasX(mon.x);
      const my = this.toCanvasY(mon.y);

      walls.forEach((wall) => {
        const spec = calculateMirrorReflectionRay(mon, listener, wall, room);
        if (spec && spec.valid) {
          const sx = this.toCanvasX(spec.x);
          const sy = this.toCanvasY(spec.y);

          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(mx, my);
          ctx.lineTo(sx, sy);
          ctx.lineTo(lx, ly);
          ctx.stroke();

          if (showRFZ) {
            ctx.setLineDash([]);
            ctx.fillStyle = '#c47a17';
            ctx.strokeStyle = '#8c5308';
            ctx.lineWidth = 1;

            if (wall === 'left' || wall === 'right') {
              const padH = 0.6 * this.scale;
              const offsetX = wall === 'left' ? -1 : -4;
              ctx.fillRect(sx + offsetX, sy - padH / 2, 5, padH);
              ctx.strokeRect(sx + offsetX, sy - padH / 2, 5, padH);
            } else if (wall === 'front') {
              const padW = 0.6 * this.scale;
              ctx.fillRect(sx - padW / 2, sy - 1, padW, 5);
              ctx.strokeRect(sx - padW / 2, sy - 1, padW, 5);
            }

            ctx.fillStyle = '#8c5308';
            ctx.beginPath();
            ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
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

    // Muro interior principal
    ctx.strokeStyle = '#1e2022';
    ctx.lineWidth = 2.25;
    ctx.strokeRect(rX, rY, rW, rH);

    // Cotas exteriores
    ctx.font = `500 11px ${FONT_MONO}`;
    ctx.fillStyle = '#4e4d48';
    ctx.textAlign = 'center';

    ctx.fillText(`Ancho W = ${room.W.toFixed(2)} m`, rX + rW / 2, rY - 22);
    this.drawDimensionLine(rX, rY - 14, rX + rW, rY - 14);

    ctx.save();
    ctx.translate(rX - 24, rY + rH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`Largo L = ${room.L.toFixed(2)} m`, 0, 0);
    ctx.restore();
    this.drawDimensionLine(rX - 14, rY, rX - 14, rY + rH);

    // Referencias discretas de paredes
    ctx.font = `500 9.5px ${FONT_SANS}`;
    ctx.fillStyle = '#73726b';
    ctx.textAlign = 'center';
    ctx.fillText('PARED FRONTAL (y = 0)', rX + rW / 2, rY + 14);
    ctx.fillText('PARED TRASERA (y = L)', rX + rW / 2, rY + rH - 6);

    ctx.restore();
  }

  drawDimensionLine(x1, y1, x2, y2) {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = '#8b8980';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    const isHoriz = y1 === y2;
    ctx.beginPath();
    if (isHoriz) {
      ctx.moveTo(x1, y1 - 4); ctx.lineTo(x1, y1 + 4);
      ctx.moveTo(x2, y2 - 4); ctx.lineTo(x2, y2 + 4);
    } else {
      ctx.moveTo(x1 - 4, y1); ctx.lineTo(x1 + 4, y1);
      ctx.moveTo(x2 - 4, y2); ctx.lineTo(x2 + 4, y2);
    }
    ctx.stroke();
    ctx.restore();
  }

  drawMonitor(mon, label, isHighlighted) {
    const { ctx } = this;
    const mx = this.toCanvasX(mon.x);
    const my = this.toCanvasY(mon.y);

    const boxW = Math.max(16, 0.22 * this.scale);
    const boxH = Math.max(22, 0.30 * this.scale);

    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate((mon.toeIn * Math.PI) / 180);

    // Anillo sutil al pasar el cursor o arrastrar
    if (isHighlighted) {
      ctx.strokeStyle = '#1b4965';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-boxW / 2 - 4, -boxH / 2 - 4, boxW + 8, boxH + 8);
    }

    // Gabinete del monitor
    ctx.fillStyle = isHighlighted ? '#1f2326' : '#2d3033';
    ctx.strokeStyle = '#141516';
    ctx.lineWidth = 1.5;
    ctx.fillRect(-boxW / 2, -boxH / 2, boxW, boxH);
    ctx.strokeRect(-boxW / 2, -boxH / 2, boxW, boxH);

    // Bafle frontal (borde hacia el oyente, +Y local)
    ctx.fillStyle = '#5a5f66';
    ctx.fillRect(-boxW / 2 + 1, boxH / 2 - 3.5, boxW - 2, 2.5);

    // Etiqueta L / R
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 10px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, -1);

    // Eje acústico frontal
    ctx.strokeStyle = '#1b4965';
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(0, boxH / 2);
    ctx.lineTo(0, boxH / 2 + 11);
    ctx.stroke();

    ctx.restore();

    // Cota de distancia a la pared frontal
    this.drawTextWithHalo(
      `${mon.y.toFixed(2)} m`,
      mx,
      my - boxH / 2 - 7,
      '#4e4d48',
      `500 9.5px ${FONT_MONO}`,
      'center'
    );
  }

  drawListener(listener, isHighlighted) {
    const { ctx } = this;
    const lx = this.toCanvasX(listener.x);
    const ly = this.toCanvasY(listener.y);
    const r = Math.max(10, 0.135 * this.scale);

    ctx.save();
    ctx.translate(lx, ly);

    if (isHighlighted) {
      ctx.strokeStyle = 'rgba(30, 107, 69, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r + 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Orejas
    const earW = Math.max(3, r * 0.24);
    const earH = r * 0.56;
    ctx.fillStyle = '#1e6b45';
    ctx.fillRect(-r - earW * 0.55, -earH / 2, earW, earH);
    ctx.fillRect(r - earW * 0.45, -earH / 2, earW, earH);

    // Nariz (orientación hacia pared frontal)
    ctx.beginPath();
    ctx.moveTo(-r * 0.24, -r + 0.5);
    ctx.lineTo(0, -r * 1.38);
    ctx.lineTo(r * 0.24, -r + 0.5);
    ctx.closePath();
    ctx.fill();

    // Cabeza
    ctx.fillStyle = '#eef6f1';
    ctx.strokeStyle = '#1e6b45';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Cruz central mínima
    ctx.strokeStyle = '#1e6b45';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-3.5, 0); ctx.lineTo(3.5, 0);
    ctx.moveTo(0, -3.5); ctx.lineTo(0, 3.5);
    ctx.stroke();

    ctx.restore();

    const pct = ((listener.y / this.state.room.L) * 100).toFixed(1);
    this.drawTextWithHalo(
      `y = ${listener.y.toFixed(2)} m (${pct}%)`,
      lx,
      ly + r + 15,
      '#1e6b45',
      `500 10px ${FONT_MONO}`,
      'center'
    );
  }
}
