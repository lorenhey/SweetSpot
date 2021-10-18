/**
 * SweetSpot - Controlador Principal de la Aplicación Web (js/app.js)
 * 
 * Orquesta:
 * - Sincronización bidireccional entre controles UI, lienzo Canvas 2D y gráfico espectral
 * - Cálculo de modos propios, frecuencia de Schroeder, SBIR y respuesta combinada
 * - Diagnósticos acústicos en tiempo real y asistente heurístico experimental
 * - Presets de salas acústicas reales (Home Studio, Control Room, Mastering, Sala Cúbica)
 * - Renderizado de fórmulas matemáticas con KaTeX
 * - Exportación de sesiones en JSON (compatible con modelos Pydantic de SweetSpot) y CSV
 */

import {
  calculateRoomModes,
  calculateSchroederFrequency,
  evaluateBoltProportions,
  calculateBonelloCriterion,
  calculateSBIRInterferences,
  synthesizeFrequencyResponse
} from './acoustics.js';

import { StudioCanvasRenderer } from './canvas-renderer.js';
import { FrequencyResponseChart } from './response-chart.js';
import { AcousticRecommender } from './recommender.js';

class SweetSpotApp {
  constructor() {
    this.recommender = new AcousticRecommender();
    this.initDOM();
    this.initCanvasAndChart();
    this.bindEvents();
    this.applyPreset('home-studio');
  }

  initDOM() {
    // Referencias a elementos del DOM
    this.dom = {
      // Controles de dimensiones
      roomL: document.getElementById('input-room-l'),
      roomW: document.getElementById('input-room-w'),
      roomH: document.getElementById('input-room-h'),
      sliderRoomL: document.getElementById('slider-room-l'),
      sliderRoomW: document.getElementById('slider-room-w'),
      sliderRoomH: document.getElementById('slider-room-h'),

      // Controles de oyente
      listenerX: document.getElementById('input-listener-x'),
      listenerY: document.getElementById('input-listener-y'),
      listenerZ: document.getElementById('input-listener-z'),

      // Controles de monitores
      monLeftX: document.getElementById('input-mon-left-x'),
      monLeftY: document.getElementById('input-mon-left-y'),
      monRightX: document.getElementById('input-mon-right-x'),
      monRightY: document.getElementById('input-mon-right-y'),
      monZ: document.getElementById('input-mon-z'),
      monToeIn: document.getElementById('input-toe-in'),

      // Toggles y opciones
      toggleStereoLink: document.getElementById('toggle-stereo-link'),
      toggleAutoToeIn: document.getElementById('toggle-auto-toe-in'),
      toggleRays: document.getElementById('toggle-rays'),
      toggleTriangle: document.getElementById('toggle-triangle'),
      toggle38Rule: document.getElementById('toggle-38-rule'),
      toggleRFZ: document.getElementById('toggle-rfz'),
      toggleHeatmap: document.getElementById('toggle-heatmap'),
      selectHeatmapMode: document.getElementById('select-heatmap-mode'),

      // Métricas y tarjetas
      badgeSchroeder: document.getElementById('badge-schroeder'),
      badgeBolt: document.getElementById('badge-bolt'),
      badgeBonello: document.getElementById('badge-bonello'),
      badgeSBIRFront: document.getElementById('badge-sbir-front'),
      metricsSummary: document.getElementById('metrics-summary'),
      diagnosticCards: document.getElementById('diagnostic-cards'),
      modesTableBody: document.getElementById('modes-table-body'),
      sbirTableBody: document.getElementById('sbir-table-body'),

      // Asistente experimental
      btnProposeExperiment: document.getElementById('btn-propose-experiment'),
      btnApplyExperiment: document.getElementById('btn-apply-experiment'),
      experimentProposalCard: document.getElementById('experiment-proposal-card'),
      experimentHistoryTable: document.getElementById('experiment-history-table'),

      // Botones de exportación y presets
      presetSelect: document.getElementById('preset-select'),
      btnExportJSON: document.getElementById('btn-export-json'),
      btnExportCSV: document.getElementById('btn-export-csv'),
      btnExportPNG: document.getElementById('btn-export-png')
    };
  }

  initCanvasAndChart() {
    const studioCanvas = document.getElementById('studio-canvas');
    const responseCanvas = document.getElementById('response-canvas');

    this.renderer = new StudioCanvasRenderer(studioCanvas, (state) => {
      this.syncUIFromCanvas(state);
      this.recalculateAll();
    });

    this.chart = new FrequencyResponseChart(responseCanvas);
  }

  syncUIFromCanvas(state) {
    const { room, listener, leftMon, rightMon } = state;
    if (this.dom.roomL) this.dom.roomL.value = room.L.toFixed(2);
    if (this.dom.roomW) this.dom.roomW.value = room.W.toFixed(2);
    if (this.dom.roomH) this.dom.roomH.value = room.H.toFixed(2);
    if (this.dom.sliderRoomL) this.dom.sliderRoomL.value = room.L;
    if (this.dom.sliderRoomW) this.dom.sliderRoomW.value = room.W;
    if (this.dom.sliderRoomH) this.dom.sliderRoomH.value = room.H;

    if (this.dom.listenerX) this.dom.listenerX.value = listener.x.toFixed(2);
    if (this.dom.listenerY) this.dom.listenerY.value = listener.y.toFixed(2);
    if (this.dom.listenerZ) this.dom.listenerZ.value = listener.z.toFixed(2);

    if (this.dom.monLeftX) this.dom.monLeftX.value = leftMon.x.toFixed(2);
    if (this.dom.monLeftY) this.dom.monLeftY.value = leftMon.y.toFixed(2);
    if (this.dom.monRightX) this.dom.monRightX.value = rightMon.x.toFixed(2);
    if (this.dom.monRightY) this.dom.monRightY.value = rightMon.y.toFixed(2);
    if (this.dom.monZ) this.dom.monZ.value = leftMon.z.toFixed(2);
    if (this.dom.monToeIn) this.dom.monToeIn.value = leftMon.toeIn.toFixed(0);
  }

  bindEvents() {
    // Sincronizar sliders y números de dimensiones de sala
    const bindSync = (inputEl, sliderEl, callback) => {
      if (inputEl && sliderEl) {
        inputEl.addEventListener('input', () => {
          sliderEl.value = inputEl.value;
          callback();
        });
        sliderEl.addEventListener('input', () => {
          inputEl.value = parseFloat(sliderEl.value).toFixed(2);
          callback();
        });
      }
    };

    bindSync(this.dom.roomL, this.dom.sliderRoomL, () => this.onDimensionChange());
    bindSync(this.dom.roomW, this.dom.sliderRoomW, () => this.onDimensionChange());
    bindSync(this.dom.roomH, this.dom.sliderRoomH, () => this.onDimensionChange());

    // Inputs de oyente
    const onCoordChange = () => {
      const room = this.renderer.state.room;
      const lx = Math.max(0.1, Math.min(room.W - 0.1, parseFloat(this.dom.listenerX.value) || 2.0));
      const ly = Math.max(0.1, Math.min(room.L - 0.1, parseFloat(this.dom.listenerY.value) || 2.0));
      const lz = Math.max(0.1, Math.min(room.H - 0.1, parseFloat(this.dom.listenerZ.value) || 1.2));

      this.renderer.updateState({
        listener: { x: lx, y: ly, z: lz }
      });
      this.recalculateAll();
    };

    if (this.dom.listenerX) this.dom.listenerX.addEventListener('change', onCoordChange);
    if (this.dom.listenerY) this.dom.listenerY.addEventListener('change', onCoordChange);
    if (this.dom.listenerZ) this.dom.listenerZ.addEventListener('change', onCoordChange);

    // Inputs de monitores
    const onMonChange = () => {
      const room = this.renderer.state.room;
      const mxL = Math.max(0.1, Math.min(room.W - 0.1, parseFloat(this.dom.monLeftX.value) || 1.2));
      const myL = Math.max(0.1, Math.min(room.L - 0.1, parseFloat(this.dom.monLeftY.value) || 0.8));
      const mz = Math.max(0.1, Math.min(room.H - 0.1, parseFloat(this.dom.monZ.value) || 1.2));

      let mxR = parseFloat(this.dom.monRightX.value) || 2.8;
      let myR = parseFloat(this.dom.monRightY.value) || 0.8;

      if (this.renderer.state.stereoLinked) {
        const distCenter = (room.W / 2) - mxL;
        mxR = (room.W / 2) + distCenter;
        myR = myL;
        if (this.dom.monRightX) this.dom.monRightX.value = mxR.toFixed(2);
        if (this.dom.monRightY) this.dom.monRightY.value = myR.toFixed(2);
      }

      this.renderer.updateState({
        leftMon: { ...this.renderer.state.leftMon, x: mxL, y: myL, z: mz },
        rightMon: { ...this.renderer.state.rightMon, x: mxR, y: myR, z: mz }
      });
      this.recalculateAll();
    };

    if (this.dom.monLeftX) this.dom.monLeftX.addEventListener('change', onMonChange);
    if (this.dom.monLeftY) this.dom.monLeftY.addEventListener('change', onMonChange);
    if (this.dom.monRightX) this.dom.monRightX.addEventListener('change', onMonChange);
    if (this.dom.monRightY) this.dom.monRightY.addEventListener('change', onMonChange);
    if (this.dom.monZ) this.dom.monZ.addEventListener('change', onMonChange);

    // Toggles de visualización
    if (this.dom.toggleStereoLink) {
      this.dom.toggleStereoLink.addEventListener('change', (e) => {
        this.renderer.updateState({ stereoLinked: e.target.checked });
      });
    }

    if (this.dom.toggleAutoToeIn) {
      this.dom.toggleAutoToeIn.addEventListener('change', (e) => {
        this.renderer.updateState({ autoToeIn: e.target.checked });
      });
    }

    if (this.dom.toggleRays) {
      this.dom.toggleRays.addEventListener('change', (e) => {
        this.renderer.updateState({ showRays: e.target.checked });
      });
    }

    if (this.dom.toggleTriangle) {
      this.dom.toggleTriangle.addEventListener('change', (e) => {
        this.renderer.updateState({ showTriangle: e.target.checked });
      });
    }

    if (this.dom.toggle38Rule) {
      this.dom.toggle38Rule.addEventListener('change', (e) => {
        this.renderer.updateState({ show38Rule: e.target.checked });
      });
    }

    if (this.dom.toggleRFZ) {
      this.dom.toggleRFZ.addEventListener('change', (e) => {
        this.renderer.updateState({ showRFZ: e.target.checked });
      });
    }

    if (this.dom.toggleHeatmap) {
      this.dom.toggleHeatmap.addEventListener('change', (e) => {
        this.renderer.updateState({ showHeatmap: e.target.checked });
      });
    }

    if (this.dom.selectHeatmapMode) {
      this.dom.selectHeatmapMode.addEventListener('change', (e) => {
        const [nx, ny] = e.target.value.split(',').map(Number);
        this.renderer.updateState({
          activeHeatmapMode: { nx, ny }
        });
      });
    }

    // Selector de presets de sala
    if (this.dom.presetSelect) {
      this.dom.presetSelect.addEventListener('change', (e) => {
        this.applyPreset(e.target.value);
      });
    }

    // Botones de acción del asistente de experimentos
    if (this.dom.btnProposeExperiment) {
      this.dom.btnProposeExperiment.addEventListener('click', () => {
        this.proposeExperiment();
      });
    }

    if (this.dom.btnApplyExperiment) {
      this.dom.btnApplyExperiment.addEventListener('click', () => {
        this.applyProposedExperiment();
      });
    }

    // Exportaciones
    if (this.dom.btnExportJSON) {
      this.dom.btnExportJSON.addEventListener('click', () => this.exportSessionJSON());
    }

    if (this.dom.btnExportCSV) {
      this.dom.btnExportCSV.addEventListener('click', () => this.exportSpectrumCSV());
    }

    if (this.dom.btnExportPNG) {
      this.dom.btnExportPNG.addEventListener('click', () => this.exportCanvasPNG());
    }

    // Pestañas de navegación
    const navButtons = document.querySelectorAll('.nav-tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        navButtons.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const targetPane = document.getElementById(targetId);
        if (targetPane) targetPane.classList.add('active');

        // Renderizar KaTeX si se activa la pestaña de teoría
        if (targetId === 'tab-teoria' && window.renderMathInElement) {
          window.renderMathInElement(targetPane, {
            delimiters: [
              { left: '$$', right: '$$', display: true },
              { left: '$', right: '$', display: false }
            ]
          });
        }

        // Forzar redibujado de canvas al regresar al simulador
        if (targetId === 'tab-simulador') {
          setTimeout(() => {
            this.renderer.resize();
            this.chart.resize();
          }, 50);
        }
      });
    });
  }

  onDimensionChange() {
    const L = Math.max(2.0, Math.min(15.0, parseFloat(this.dom.roomL.value) || 5.2));
    const W = Math.max(2.0, Math.min(12.0, parseFloat(this.dom.roomW.value) || 4.0));
    const H = Math.max(2.0, Math.min(6.0, parseFloat(this.dom.roomH.value) || 2.6));

    // Ajustar límites de oyente y monitores si exceden la sala
    const listener = { ...this.renderer.state.listener };
    listener.x = Math.min(W - 0.2, Math.max(0.2, listener.x));
    listener.y = Math.min(L - 0.2, Math.max(0.2, listener.y));

    const leftMon = { ...this.renderer.state.leftMon };
    leftMon.x = Math.min(W - 0.2, Math.max(0.2, leftMon.x));
    leftMon.y = Math.min(L - 0.2, Math.max(0.2, leftMon.y));

    const rightMon = { ...this.renderer.state.rightMon };
    rightMon.x = Math.min(W - 0.2, Math.max(0.2, rightMon.x));
    rightMon.y = Math.min(L - 0.2, Math.max(0.2, rightMon.y));

    this.renderer.updateState({
      room: { L, W, H },
      listener,
      leftMon,
      rightMon
    });
    this.renderer.resize();
    this.recalculateAll();
  }

  applyPreset(presetKey) {
    let room, listener, leftMon, rightMon;

    if (presetKey === 'home-studio') {
      room = { L: 4.80, W: 3.60, H: 2.50 };
      listener = { x: 1.80, y: 1.82, z: 1.20 }; // 38% de 4.80 m
      leftMon = { x: 1.05, y: 0.65, z: 1.20, toeIn: 30 };
      rightMon = { x: 2.55, y: 0.65, z: 1.20, toeIn: -30 };
    } else if (presetKey === 'pro-control') {
      room = { L: 6.20, W: 4.80, H: 2.90 };
      listener = { x: 2.40, y: 2.35, z: 1.20 };
      leftMon = { x: 1.40, y: 0.85, z: 1.20, toeIn: 30 };
      rightMon = { x: 3.40, y: 0.85, z: 1.20, toeIn: -30 };
    } else if (presetKey === 'mastering-bolt') {
      // Proporción Sepmeyer 1 : 1.60 : 2.33 -> H=3.0, W=4.8, L=7.0
      room = { L: 7.00, W: 4.80, H: 3.00 };
      listener = { x: 2.40, y: 2.66, z: 1.20 };
      leftMon = { x: 1.35, y: 1.10, z: 1.20, toeIn: 30 };
      rightMon = { x: 3.45, y: 1.10, z: 1.20, toeIn: -30 };
    } else if (presetKey === 'cubic-worst') {
      // Sala cúbica crítica para demostración pedagógica
      room = { L: 3.50, W: 3.50, H: 3.50 };
      listener = { x: 1.75, y: 1.75, z: 1.20 }; // Oyente en el peor punto: 50%
      leftMon = { x: 1.00, y: 0.80, z: 1.20, toeIn: 30 };
      rightMon = { x: 2.50, y: 0.80, z: 1.20, toeIn: -30 };
    }

    this.renderer.updateState({ room, listener, leftMon, rightMon });
    this.syncUIFromCanvas(this.renderer.state);
    this.renderer.resize();
    this.recalculateAll();
  }

  recalculateAll() {
    const { room, listener, leftMon, rightMon } = this.renderer.state;

    // 1. Modos propios y frecuencia de Schroeder
    const modes = calculateRoomModes(room.L, room.W, room.H, 320);
    const fs = calculateSchroederFrequency(room.L, room.W, room.H, 0.35);
    const bolt = evaluateBoltProportions(room.L, room.W, room.H);
    const bonello = calculateBonelloCriterion(modes);

    // 2. SBIR de ambos monitores
    const sbirLeft = calculateSBIRInterferences(leftMon, listener, room);
    const sbirRight = calculateSBIRInterferences(rightMon, listener, room);

    // 3. Síntesis de curva de respuesta en frecuencia (20 Hz - 500 Hz)
    const curve = synthesizeFrequencyResponse(room, leftMon, rightMon, listener, modes);
    this.chart.setData(curve, modes, fs);

    // 4. Actualizar Badges y Resumen Superior
    if (this.dom.badgeSchroeder) {
      this.dom.badgeSchroeder.textContent = `fs = ${fs} Hz`;
    }
    if (this.dom.badgeBolt) {
      this.dom.badgeBolt.textContent = bolt.status;
      this.dom.badgeBolt.className = `badge ${bolt.badgeClass}`;
    }
    if (this.dom.badgeBonello) {
      this.dom.badgeBonello.textContent = bonello.passes ? 'Bonello Monótono' : 'Bonello Irregular';
      this.dom.badgeBonello.className = `badge ${bonello.passes ? 'badge-success' : 'badge-warning'}`;
    }

    const frontNullF = sbirLeft.boundaries.find(b => b.id === 'front')?.fNull || 100;
    if (this.dom.badgeSBIRFront) {
      this.dom.badgeSBIRFront.textContent = `SBIR Front: ${frontNullF} Hz`;
      this.dom.badgeSBIRFront.className = `badge ${frontNullF < 140 && frontNullF > 60 ? 'badge-danger' : 'badge-info'}`;
    }

    // 5. Poblar selector de modos para el mapa de calor
    this.populateHeatmapSelector(modes);

    // 6. Poblar tabla de modos propios
    this.populateModesTable(modes);

    // 7. Poblar tabla SBIR
    this.populateSBIRTable(sbirLeft);

    // 8. Actualizar diagnósticos acústicos en tiempo real
    this.updateDiagnostics(room, listener, leftMon, rightMon);
  }

  populateHeatmapSelector(modes) {
    if (!this.dom.selectHeatmapMode) return;
    const currentVal = this.dom.selectHeatmapMode.value;
    const topModes = modes.filter(m => m.freq <= 160 && (m.nx > 0 || m.ny > 0)).slice(0, 12);

    let html = '';
    topModes.forEach(m => {
      const val = `${m.nx},${m.ny}`;
      html += `<option value="${val}">${m.type.toUpperCase()} (${m.nx}, ${m.ny}, 0) - ${m.freq} Hz</option>`;
    });

    this.dom.selectHeatmapMode.innerHTML = html;
    if (topModes.some(m => `${m.nx},${m.ny}` === currentVal)) {
      this.dom.selectHeatmapMode.value = currentVal;
    }
  }

  populateModesTable(modes) {
    if (!this.dom.modesTableBody) return;
    const displayModes = modes.slice(0, 15);
    let html = '';

    displayModes.forEach(m => {
      const badgeClass = m.type === 'axial' ? 'badge-danger' : (m.type === 'tangential' ? 'badge-warning' : 'badge-neutral');
      html += `
        <tr>
          <td><strong>${m.freq.toFixed(1)} Hz</strong></td>
          <td>(${m.nx}, ${m.ny}, ${m.nz})</td>
          <td><span class="badge ${badgeClass}">${m.type.toUpperCase()}</span></td>
          <td>${m.type === 'axial' ? '0.0 dB' : (m.type === 'tangential' ? '-3.0 dB' : '-6.0 dB')}</td>
        </tr>
      `;
    });
    this.dom.modesTableBody.innerHTML = html;
  }

  populateSBIRTable(sbir) {
    if (!this.dom.sbirTableBody) return;
    let html = '';

    sbir.boundaries.forEach(b => {
      const danger = b.fNull >= 65 && b.fNull <= 135;
      html += `
        <tr>
          <td><strong>${b.name}</strong></td>
          <td>${b.distToWall.toFixed(2)} m</td>
          <td><strong class="${danger ? 'text-danger' : 'text-info'}">${b.fNull} Hz</strong></td>
          <td>${b.fPeak} Hz</td>
          <td>${b.delayMs.toFixed(1)} ms</td>
        </tr>
      `;
    });
    this.dom.sbirTableBody.innerHTML = html;
  }

  updateDiagnostics(room, listener, leftMon, rightMon) {
    if (!this.dom.diagnosticCards) return;
    const diagnostics = this.recommender.evaluateSetup(room, listener, leftMon, rightMon);

    let html = '';
    diagnostics.forEach(d => {
      const icon = d.severity === 'success' ? '✓' : (d.severity === 'danger' ? '⚠' : 'ℹ');
      html += `
        <div class="diagnostic-card ${d.severity}">
          <div class="diag-header">
            <span class="diag-icon">${icon}</span>
            <span class="diag-title">${d.title}</span>
            <span class="diag-category">${d.category}</span>
          </div>
          <div class="diag-body">${d.message}</div>
        </div>
      `;
    });

    this.dom.diagnosticCards.innerHTML = html;
  }

  proposeExperiment() {
    const { room, listener, leftMon, rightMon } = this.renderer.state;
    const proposal = this.recommender.proposeNextExperiment(room, listener, leftMon, rightMon);
    this.currentProposal = proposal;

    if (this.dom.experimentProposalCard) {
      this.dom.experimentProposalCard.innerHTML = `
        <div class="proposal-box">
          <h4>Propuesta: ${proposal.actionName}</h4>
          <p class="proposal-reason"><strong>Justificación acústica:</strong> ${proposal.reason}</p>
          <div class="proposal-details">
            <span>Variable modificada: <code>${proposal.variable}</code></span>
            <span>Variación propuesta: <strong>${proposal.deltaText}</strong></span>
          </div>
        </div>
      `;
      if (this.dom.btnApplyExperiment) {
        this.dom.btnApplyExperiment.style.display = 'inline-block';
      }
    }
  }

  applyProposedExperiment() {
    if (!this.currentProposal) return;
    const { newConfig, actionName, variable, deltaText } = this.currentProposal;
    const state = { ...this.renderer.state };

    if (newConfig.listenerY !== undefined) state.listener.y = newConfig.listenerY;
    if (newConfig.listenerX !== undefined) state.listener.x = newConfig.listenerX;
    if (newConfig.monitorsY !== undefined) {
      state.leftMon.y = newConfig.monitorsY;
      state.rightMon.y = newConfig.monitorsY;
    }
    if (newConfig.leftMonX !== undefined) {
      state.leftMon.x = newConfig.leftMonX;
      state.rightMon.x = newConfig.rightMonX;
    }

    this.renderer.updateState(state);
    this.syncUIFromCanvas(state);
    this.recalculateAll();

    // Registrar en el historial de experimentos
    this.recommender.logExperiment({
      action: actionName,
      variable,
      delta: deltaText,
      configSummary: `L: (${state.listener.x.toFixed(2)}, ${state.listener.y.toFixed(2)}) | M: (${state.leftMon.x.toFixed(2)}, ${state.leftMon.y.toFixed(2)})`
    });

    this.renderExperimentHistory();

    if (this.dom.btnApplyExperiment) {
      this.dom.btnApplyExperiment.style.display = 'none';
    }
    if (this.dom.experimentProposalCard) {
      this.dom.experimentProposalCard.innerHTML = `
        <div class="proposal-applied">
          <p>✓ Experimento aplicado con éxito y registrado en el historial.</p>
        </div>
      `;
    }
  }

  renderExperimentHistory() {
    if (!this.dom.experimentHistoryTable) return;
    let html = '';
    this.recommender.history.forEach(item => {
      html += `
        <tr>
          <td>#${item.id}</td>
          <td>${item.timestamp}</td>
          <td><strong>${item.action}</strong></td>
          <td><code>${item.variable}</code></td>
          <td><span class="badge badge-info">${item.delta}</span></td>
          <td><small>${item.configSummary}</small></td>
        </tr>
      `;
    });
    this.dom.experimentHistoryTable.innerHTML = html;
  }

  exportSessionJSON() {
    const { room, listener, leftMon, rightMon } = this.renderer.state;
    const sessionData = {
      id: `sweetspot-session-${Date.now()}`,
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      room_dimensions: { x: room.W, y: room.L, z: room.H },
      configuration: {
        listener: { position: listener },
        left_monitor: { position: leftMon, toe_in_deg: leftMon.toeIn },
        right_monitor: { position: rightMon, toe_in_deg: rightMon.toeIn }
      },
      experiments: this.recommender.history
    };

    const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sweetspot-session-${room.W}x${room.L}m.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  exportSpectrumCSV() {
    if (!this.chart.curveData || this.chart.curveData.length === 0) return;
    let csv = 'Frequency_Hz,Total_SPL_dB,SBIR_dB,Modal_dB\n';
    this.chart.curveData.forEach(pt => {
      csv += `${pt.freq},${pt.spl},${pt.sbirDb},${pt.modalDb}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sweetspot-spectrum-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  exportCanvasPNG() {
    const canvas = document.getElementById('studio-canvas');
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `sweetspot-studio-floorplan.png`;
    a.click();
  }
}

// Iniciar aplicación al cargar el DOM
window.addEventListener('DOMContentLoaded', () => {
  window.sweetSpotApp = new SweetSpotApp();
});
