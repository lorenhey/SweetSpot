/**
 * SweetSpot - Controlador principal de la interfaz web (ES / EN)
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
import { I18N } from './i18n.js';

const DEFAULT_MODES_LIMIT = 12;

class SweetSpotApp {
  constructor() {
    this.recommender = new AcousticRecommender();
    this.lang = this.detectInitialLang();
    this.showAllModes = false;
    this.lastModes = [];
    this.currentProposal = null;
    this.initDOM();
    this.initCanvasAndChart();
    this.bindEvents();
    this.applyPreset('home-studio');
    this.setLanguage(this.lang);
    this.renderMathSafe();
  }

  detectInitialLang() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('lang') === 'en') return 'en';
    try {
      if (localStorage.getItem('sweetspot_lang') === 'en') return 'en';
    } catch {
      // ignore storage errors
    }
    return 'es';
  }

  initDOM() {
    this.dom = {
      roomL: document.getElementById('input-room-l'),
      roomW: document.getElementById('input-room-w'),
      roomH: document.getElementById('input-room-h'),
      sliderRoomL: document.getElementById('slider-room-l'),
      sliderRoomW: document.getElementById('slider-room-w'),
      sliderRoomH: document.getElementById('slider-room-h'),

      listenerX: document.getElementById('input-listener-x'),
      listenerY: document.getElementById('input-listener-y'),
      listenerZ: document.getElementById('input-listener-z'),

      monLeftX: document.getElementById('input-mon-left-x'),
      monLeftY: document.getElementById('input-mon-left-y'),
      monRightX: document.getElementById('input-mon-right-x'),
      monRightY: document.getElementById('input-mon-right-y'),
      monZ: document.getElementById('input-mon-z'),
      monToeIn: document.getElementById('input-toe-in'),

      toggleStereoLink: document.getElementById('toggle-stereo-link'),
      toggleAutoToeIn: document.getElementById('toggle-auto-toe-in'),
      toggleRays: document.getElementById('toggle-rays'),
      toggleTriangle: document.getElementById('toggle-triangle'),
      toggle38Rule: document.getElementById('toggle-38-rule'),
      toggleRFZ: document.getElementById('toggle-rfz'),
      toggleHeatmap: document.getElementById('toggle-heatmap'),
      selectHeatmapMode: document.getElementById('select-heatmap-mode'),
      toggleCurveSBIR: document.getElementById('toggle-curve-sbir'),
      toggleCurveModal: document.getElementById('toggle-curve-modal'),

      metricVolume: document.getElementById('metric-volume'),
      badgeSchroeder: document.getElementById('badge-schroeder'),
      badgeBolt: document.getElementById('badge-bolt'),
      badgeBonello: document.getElementById('badge-bonello'),
      badgeSBIRFront: document.getElementById('badge-sbir-front'),
      diagnosticCards: document.getElementById('diagnostic-cards'),
      modesTableBody: document.getElementById('modes-table-body'),
      btnToggleAllModes: document.getElementById('btn-toggle-all-modes'),
      sbirTableBody: document.getElementById('sbir-table-body'),

      btnProposeExperiment: document.getElementById('btn-propose-experiment'),
      btnApplyExperiment: document.getElementById('btn-apply-experiment'),
      experimentProposalCard: document.getElementById('experiment-proposal-card'),
      experimentHistoryTable: document.getElementById('experiment-history-table'),

      presetSelect: document.getElementById('preset-select'),
      btnExportJSON: document.getElementById('btn-export-json'),
      btnExportCSV: document.getElementById('btn-export-csv'),
      btnExportPNG: document.getElementById('btn-export-png'),
      brandHomeLink: document.getElementById('brand-home-link')
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

  setLanguage(lang) {
    this.lang = lang === 'en' ? 'en' : 'es';
    const t = I18N[this.lang];

    document.documentElement.lang = this.lang;
    document.title = t.pageTitle;

    try {
      localStorage.setItem('sweetspot_lang', this.lang);
    } catch {
      // ignore storage errors
    }

    document.querySelectorAll('[data-lang-btn]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-lang-btn') === this.lang);
    });

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (typeof t[key] === 'string') {
        el.textContent = t[key];
      }
    });

    document.querySelectorAll('[data-lang]').forEach((block) => {
      block.hidden = block.getAttribute('data-lang') !== this.lang;
    });

    this.renderer.setLanguage(this.lang);
    this.chart.setLanguage(this.lang);
    this.recalculateAll();
    this.renderExperimentHistory();

    if (this.currentProposal) {
      this.proposeExperiment();
    }

    const activePane = document.querySelector('.tab-pane.active');
    if (activePane) this.renderMathSafe(activePane);
  }

  syncUIFromCanvas(state) {
    const { room, listener, leftMon, rightMon, autoToeIn } = state;
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
    if (this.dom.monToeIn) {
      this.dom.monToeIn.value = Math.round(leftMon.toeIn);
      this.dom.monToeIn.disabled = Boolean(autoToeIn);
    }
  }

  bindEvents() {
    document.querySelectorAll('[data-lang-btn]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.setLanguage(btn.getAttribute('data-lang-btn'));
      });
    });

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

    const onCoordChange = () => {
      const room = this.renderer.state.room;
      const lx = Math.max(0.1, Math.min(room.W - 0.1, parseFloat(this.dom.listenerX.value) || room.W / 2));
      const ly = Math.max(0.1, Math.min(room.L - 0.1, parseFloat(this.dom.listenerY.value) || room.L * 0.38));
      const lz = Math.max(0.1, Math.min(room.H - 0.1, parseFloat(this.dom.listenerZ.value) || 1.2));

      this.renderer.updateState({ listener: { x: lx, y: ly, z: lz } });
      this.syncUIFromCanvas(this.renderer.state);
      this.recalculateAll();
    };

    if (this.dom.listenerX) this.dom.listenerX.addEventListener('change', onCoordChange);
    if (this.dom.listenerY) this.dom.listenerY.addEventListener('change', onCoordChange);
    if (this.dom.listenerZ) this.dom.listenerZ.addEventListener('change', onCoordChange);

    const onMonChange = (source) => {
      const room = this.renderer.state.room;
      let mxL = Math.max(0.1, Math.min(room.W - 0.1, parseFloat(this.dom.monLeftX.value) || 1.05));
      const myL = Math.max(0.1, Math.min(room.L - 0.1, parseFloat(this.dom.monLeftY.value) || 0.65));
      const mz = Math.max(0.1, Math.min(room.H - 0.1, parseFloat(this.dom.monZ?.value) || 1.2));

      let mxR = Math.max(0.1, Math.min(room.W - 0.1, parseFloat(this.dom.monRightX.value) || (room.W - mxL)));
      let myR = this.dom.monRightY ? (parseFloat(this.dom.monRightY.value) || myL) : myL;

      if (this.renderer.state.stereoLinked) {
        if (source === 'rightX') {
          const distCenter = mxR - (room.W / 2);
          mxL = Math.max(0.1, Math.min(room.W - 0.1, (room.W / 2) - distCenter));
        } else {
          const distCenter = (room.W / 2) - mxL;
          mxR = Math.max(0.1, Math.min(room.W - 0.1, (room.W / 2) + distCenter));
        }
        myR = myL;
      }

      const toeVal = parseFloat(this.dom.monToeIn?.value);
      const toeL = Number.isFinite(toeVal) ? toeVal : this.renderer.state.leftMon.toeIn;

      this.renderer.updateState({
        leftMon: { ...this.renderer.state.leftMon, x: mxL, y: myL, z: mz, toeIn: toeL },
        rightMon: { ...this.renderer.state.rightMon, x: mxR, y: myR, z: mz, toeIn: -toeL }
      });
      this.syncUIFromCanvas(this.renderer.state);
      this.recalculateAll();
    };

    if (this.dom.monLeftX) this.dom.monLeftX.addEventListener('change', () => onMonChange('leftX'));
    if (this.dom.monLeftY) this.dom.monLeftY.addEventListener('change', () => onMonChange('leftY'));
    if (this.dom.monRightX) this.dom.monRightX.addEventListener('change', () => onMonChange('rightX'));
    if (this.dom.monRightY) this.dom.monRightY.addEventListener('change', () => onMonChange('rightY'));
    if (this.dom.monZ) this.dom.monZ.addEventListener('change', () => onMonChange('z'));
    if (this.dom.monToeIn) this.dom.monToeIn.addEventListener('change', () => onMonChange('toeIn'));

    if (this.dom.toggleStereoLink) {
      this.dom.toggleStereoLink.addEventListener('change', (e) => {
        this.renderer.updateState({ stereoLinked: e.target.checked });
      });
    }

    if (this.dom.toggleAutoToeIn) {
      this.dom.toggleAutoToeIn.addEventListener('change', (e) => {
        this.renderer.updateState({ autoToeIn: e.target.checked });
        this.syncUIFromCanvas(this.renderer.state);
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
        this.renderer.updateState({ activeHeatmapMode: { nx, ny } });
      });
    }

    if (this.dom.toggleCurveSBIR) {
      this.dom.toggleCurveSBIR.addEventListener('change', (e) => {
        this.chart.setOptions({ showSBIROnly: e.target.checked });
      });
    }

    if (this.dom.toggleCurveModal) {
      this.dom.toggleCurveModal.addEventListener('change', (e) => {
        this.chart.setOptions({ showModalOnly: e.target.checked });
      });
    }

    if (this.dom.presetSelect) {
      this.dom.presetSelect.addEventListener('change', (e) => {
        this.applyPreset(e.target.value);
      });
    }

    if (this.dom.btnToggleAllModes) {
      this.dom.btnToggleAllModes.addEventListener('click', () => {
        this.showAllModes = !this.showAllModes;
        this.populateModesTable(this.lastModes);
      });
    }

    if (this.dom.btnProposeExperiment) {
      this.dom.btnProposeExperiment.addEventListener('click', () => this.proposeExperiment());
    }

    if (this.dom.btnApplyExperiment) {
      this.dom.btnApplyExperiment.addEventListener('click', () => this.applyProposedExperiment());
    }

    if (this.dom.btnExportJSON) {
      this.dom.btnExportJSON.addEventListener('click', () => this.exportSessionJSON());
    }

    if (this.dom.btnExportCSV) {
      this.dom.btnExportCSV.addEventListener('click', () => this.exportSpectrumCSV());
    }

    if (this.dom.btnExportPNG) {
      this.dom.btnExportPNG.addEventListener('click', () => this.exportCanvasPNG());
    }

    const navButtons = document.querySelectorAll('.nav-tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    const activateTab = (targetId) => {
      navButtons.forEach((b) => {
        b.classList.toggle('active', b.getAttribute('data-target') === targetId);
      });
      tabPanes.forEach((p) => {
        p.classList.toggle('active', p.id === targetId);
      });

      const targetPane = document.getElementById(targetId);
      if (targetPane) this.renderMathSafe(targetPane);

      if (targetId === 'tab-simulador') {
        setTimeout(() => {
          this.renderer.resize();
          this.chart.resize();
        }, 30);
      }
    };

    navButtons.forEach((btn) => {
      btn.addEventListener('click', () => activateTab(btn.getAttribute('data-target')));
    });

    if (this.dom.brandHomeLink) {
      this.dom.brandHomeLink.addEventListener('click', (e) => {
        e.preventDefault();
        activateTab('tab-simulador');
      });
    }

    if (this.dom.modesTableBody) {
      this.dom.modesTableBody.addEventListener('click', (e) => {
        const row = e.target.closest('tr[data-nx]');
        if (!row) return;
        const nx = Number(row.getAttribute('data-nx'));
        const ny = Number(row.getAttribute('data-ny'));
        if (nx === 0 && ny === 0) return;

        if (this.dom.toggleHeatmap) this.dom.toggleHeatmap.checked = true;
        this.renderer.updateState({
          showHeatmap: true,
          activeHeatmapMode: { nx, ny }
        });
        if (this.dom.selectHeatmapMode) {
          const val = `${nx},${ny}`;
          if ([...this.dom.selectHeatmapMode.options].some((o) => o.value === val)) {
            this.dom.selectHeatmapMode.value = val;
          }
        }
        document.getElementById('studio-canvas')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
  }

  renderMathSafe(root = document.body) {
    const run = () => {
      if (window.renderMathInElement) {
        window.renderMathInElement(root, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false }
          ],
          throwOnError: false
        });
      }
    };

    if (window.renderMathInElement) {
      run();
    } else {
      window.addEventListener('load', run, { once: true });
    }
  }

  onDimensionChange() {
    const L = Math.max(2.0, Math.min(15.0, parseFloat(this.dom.roomL.value) || 4.8));
    const W = Math.max(2.0, Math.min(12.0, parseFloat(this.dom.roomW.value) || 3.6));
    const H = Math.max(2.0, Math.min(6.0, parseFloat(this.dom.roomH.value) || 2.5));

    const listener = { ...this.renderer.state.listener };
    listener.x = Math.min(W - 0.2, Math.max(0.2, listener.x));
    listener.y = Math.min(L - 0.2, Math.max(0.2, listener.y));

    const leftMon = { ...this.renderer.state.leftMon };
    leftMon.x = Math.min(W - 0.2, Math.max(0.2, leftMon.x));
    leftMon.y = Math.min(L - 0.2, Math.max(0.2, leftMon.y));

    const rightMon = { ...this.renderer.state.rightMon };
    rightMon.x = Math.min(W - 0.2, Math.max(0.2, rightMon.x));
    rightMon.y = Math.min(L - 0.2, Math.max(0.2, rightMon.y));

    this.renderer.updateState({ room: { L, W, H }, listener, leftMon, rightMon });
    this.syncUIFromCanvas(this.renderer.state);
    this.renderer.resize();
    this.recalculateAll();
  }

  applyPreset(presetKey) {
    let room, listener, leftMon, rightMon;

    if (presetKey === 'home-studio') {
      room = { L: 4.80, W: 3.60, H: 2.50 };
      listener = { x: 1.80, y: 1.82, z: 1.20 };
      leftMon = { x: 1.05, y: 0.65, z: 1.20, toeIn: 30 };
      rightMon = { x: 2.55, y: 0.65, z: 1.20, toeIn: -30 };
    } else if (presetKey === 'pro-control') {
      room = { L: 6.20, W: 4.80, H: 2.90 };
      listener = { x: 2.40, y: 2.35, z: 1.20 };
      leftMon = { x: 1.40, y: 0.85, z: 1.20, toeIn: 30 };
      rightMon = { x: 3.40, y: 0.85, z: 1.20, toeIn: -30 };
    } else if (presetKey === 'mastering-bolt') {
      room = { L: 7.00, W: 4.80, H: 3.00 };
      listener = { x: 2.40, y: 2.66, z: 1.20 };
      leftMon = { x: 1.35, y: 1.10, z: 1.20, toeIn: 30 };
      rightMon = { x: 3.45, y: 1.10, z: 1.20, toeIn: -30 };
    } else if (presetKey === 'cubic-worst') {
      room = { L: 3.50, W: 3.50, H: 3.50 };
      listener = { x: 1.75, y: 1.75, z: 1.20 };
      leftMon = { x: 1.00, y: 0.80, z: 1.20, toeIn: 30 };
      rightMon = { x: 2.50, y: 0.80, z: 1.20, toeIn: -30 };
    }

    this.renderer.updateState({ room, listener, leftMon, rightMon });
    this.syncUIFromCanvas(this.renderer.state);
    this.renderer.resize();
    this.recalculateAll();
  }

  localizeBoltStatus(bolt) {
    const map = I18N[this.lang].boltStatus;
    if (bolt.badgeClass === 'badge-danger') return map.cubic;
    if (bolt.status.includes('Cuadrada')) return map.square;
    if (bolt.status.includes('Múltiplos')) return map.multiple;
    return map.favorable;
  }

  recalculateAll() {
    const t = I18N[this.lang];
    const { room, listener, leftMon, rightMon } = this.renderer.state;

    const modes = calculateRoomModes(room.L, room.W, room.H, 320);
    this.lastModes = modes;
    const fs = calculateSchroederFrequency(room.L, room.W, room.H, 0.35);
    const bolt = evaluateBoltProportions(room.L, room.W, room.H);
    const bonello = calculateBonelloCriterion(modes);
    const volume = room.L * room.W * room.H;

    const sbirLeft = calculateSBIRInterferences(leftMon, listener, room);
    const curve = synthesizeFrequencyResponse(room, leftMon, rightMon, listener, modes);
    this.chart.setData(curve, modes, fs);

    if (this.dom.metricVolume) {
      this.dom.metricVolume.textContent = `${volume.toFixed(1)} m³`;
    }
    if (this.dom.badgeSchroeder) {
      this.dom.badgeSchroeder.textContent = `fs = ${fs} Hz`;
    }
    if (this.dom.badgeBolt) {
      const ratioShort = `1 : ${bolt.normW.toFixed(2)} : ${bolt.normL.toFixed(2)}`;
      this.dom.badgeBolt.textContent = `${ratioShort} (${this.localizeBoltStatus(bolt)})`;
      this.dom.badgeBolt.className = bolt.badgeClass === 'badge-danger'
        ? 'flag-bad'
        : (bolt.badgeClass === 'badge-warning' ? 'flag-warn' : '');
    }
    if (this.dom.badgeBonello) {
      this.dom.badgeBonello.textContent = bonello.passes ? t.bonelloPass : t.bonelloFail;
      this.dom.badgeBonello.className = bonello.passes ? '' : 'flag-warn';
    }

    const frontNullF = sbirLeft.boundaries.find((b) => b.id === 'front')?.fNull || 100;
    if (this.dom.badgeSBIRFront) {
      const isCrit = (leftMon.y >= 0.55 && leftMon.y <= 1.25) || (frontNullF >= 60 && frontNullF <= 165);
      this.dom.badgeSBIRFront.textContent = `${frontNullF} Hz`;
      this.dom.badgeSBIRFront.className = isCrit ? 'flag-bad' : '';
    }

    this.populateHeatmapSelector(modes);
    this.populateModesTable(modes);
    this.populateSBIRTable(sbirLeft);
    this.updateDiagnostics(room, listener, leftMon, rightMon);
  }

  populateHeatmapSelector(modes) {
    if (!this.dom.selectHeatmapMode) return;
    const t = I18N[this.lang];
    const currentVal = this.dom.selectHeatmapMode.value;
    const topModes = modes.filter((m) => m.freq <= 180 && (m.nx > 0 || m.ny > 0)).slice(0, 14);

    let html = '';
    topModes.forEach((m) => {
      const val = `${m.nx},${m.ny}`;
      html += `<option value="${val}">${t.modeTypes[m.type]} (${m.nx}, ${m.ny}, ${m.nz}) - ${m.freq.toFixed(1)} Hz</option>`;
    });

    this.dom.selectHeatmapMode.innerHTML = html;
    if (topModes.some((m) => `${m.nx},${m.ny}` === currentVal)) {
      this.dom.selectHeatmapMode.value = currentVal;
    }
  }

  populateModesTable(modes) {
    if (!this.dom.modesTableBody) return;
    const t = I18N[this.lang];
    const limit = this.showAllModes ? Math.min(modes.length, 40) : DEFAULT_MODES_LIMIT;
    const displayModes = modes.slice(0, limit);
    let html = '';

    displayModes.forEach((m) => {
      const clickable = m.nx > 0 || m.ny > 0;
      const relDb = m.type === 'axial' ? '0.0' : (m.type === 'tangential' ? '-3.0' : '-6.0');
      html += `
        <tr${clickable ? ` class="mode-clickable" data-nx="${m.nx}" data-ny="${m.ny}"` : ''}>
          <td class="num">${m.freq.toFixed(1)}</td>
          <td class="mono">(${m.nx}, ${m.ny}, ${m.nz})</td>
          <td class="mode-${m.type}">${t.modeTypes[m.type]}</td>
          <td class="num">${relDb}</td>
        </tr>
      `;
    });
    this.dom.modesTableBody.innerHTML = html;

    if (this.dom.btnToggleAllModes) {
      if (modes.length > DEFAULT_MODES_LIMIT) {
        const cap = Math.min(modes.length, 40);
        this.dom.btnToggleAllModes.style.display = 'inline';
        this.dom.btnToggleAllModes.textContent = this.showAllModes
          ? t.modesLess(DEFAULT_MODES_LIMIT)
          : t.modesMore(cap, modes.length);
      } else {
        this.dom.btnToggleAllModes.style.display = 'none';
      }
    }
  }

  populateSBIRTable(sbir) {
    if (!this.dom.sbirTableBody) return;
    const t = I18N[this.lang];
    let html = '';

    sbir.boundaries.forEach((b) => {
      const danger = b.fNull >= 60 && b.fNull <= 165;
      const shortName = t.surfaces[b.id] || b.name;
      html += `
        <tr>
          <td>${shortName}</td>
          <td class="num">${b.distToWall.toFixed(2)}</td>
          <td class="num ${danger ? 'val-danger' : ''}">${b.fNull}</td>
          <td class="num">${b.fPeak}</td>
          <td class="num">${b.delayMs.toFixed(1)}</td>
        </tr>
      `;
    });
    this.dom.sbirTableBody.innerHTML = html;
  }

  updateDiagnostics(room, listener, leftMon, rightMon) {
    if (!this.dom.diagnosticCards) return;
    const diagnostics = this.recommender.evaluateSetup(room, listener, leftMon, rightMon, this.lang);

    let html = '';
    diagnostics.forEach((d) => {
      const rowClass = d.severity === 'danger'
        ? ' class="is-danger"'
        : (d.severity === 'warning' ? ' class="is-warning"' : '');
      html += `
        <tr${rowClass}>
          <th>${d.category}</th>
          <td>${d.message}</td>
        </tr>
      `;
    });

    this.dom.diagnosticCards.innerHTML = html;
  }

  proposeExperiment() {
    const t = I18N[this.lang];
    const { room, listener, leftMon, rightMon } = this.renderer.state;
    const proposal = this.recommender.proposeNextExperiment(room, listener, leftMon, rightMon, this.lang);
    this.currentProposal = proposal;

    if (this.dom.experimentProposalCard) {
      this.dom.experimentProposalCard.innerHTML = `
        <div class="proposal-block">
          <p><strong>${proposal.actionName}</strong></p>
          <p>${proposal.reason}</p>
          <p class="proposal-meta">${t.proposalVar} <code>${proposal.variable}</code> · ${t.proposalDelta} <strong>${proposal.deltaText}</strong></p>
        </div>
      `;
      if (this.dom.btnApplyExperiment) {
        this.dom.btnApplyExperiment.style.display = 'inline-block';
      }
    }
  }

  applyProposedExperiment() {
    if (!this.currentProposal) return;
    const t = I18N[this.lang];
    const { newConfig, actionName, variable, deltaText } = this.currentProposal;
    const state = {
      ...this.renderer.state,
      listener: { ...this.renderer.state.listener },
      leftMon: { ...this.renderer.state.leftMon },
      rightMon: { ...this.renderer.state.rightMon }
    };

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
    this.syncUIFromCanvas(this.renderer.state);
    this.recalculateAll();

    this.recommender.logExperiment({
      action: actionName,
      variable,
      delta: deltaText,
      configSummary: t.summaryCoords(
        state.listener.x.toFixed(2),
        state.listener.y.toFixed(2),
        state.leftMon.x.toFixed(2),
        state.leftMon.y.toFixed(2)
      )
    });

    this.currentProposal = null;
    this.renderExperimentHistory();

    if (this.dom.btnApplyExperiment) {
      this.dom.btnApplyExperiment.style.display = 'none';
    }
    if (this.dom.experimentProposalCard) {
      this.dom.experimentProposalCard.innerHTML = `<p class="proposal-done">${t.proposalApplied}</p>`;
    }
  }

  renderExperimentHistory() {
    if (!this.dom.experimentHistoryTable) return;
    const t = I18N[this.lang];
    if (this.recommender.history.length === 0) {
      this.dom.experimentHistoryTable.innerHTML = `<tr><td colspan="6" class="muted-cell">${t.historyEmpty}</td></tr>`;
      return;
    }
    let html = '';
    this.recommender.history.forEach((item) => {
      html += `
        <tr>
          <td class="mono">${item.id}</td>
          <td class="mono">${item.timestamp}</td>
          <td>${item.action}</td>
          <td><code>${item.variable}</code></td>
          <td class="num">${item.delta}</td>
          <td class="mono">${item.configSummary}</td>
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
    this.chart.curveData.forEach((pt) => {
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
    a.download = 'sweetspot-floorplan.png';
    a.click();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.sweetSpotApp = new SweetSpotApp();
});
