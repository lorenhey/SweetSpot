/**
 * SweetSpot - Asistente Heurístico y Recomendador de Experimentos Físicos
 * 
 * Evalúa las condiciones físicas del recinto y propone ajustes paso a paso:
 * 1. Geometría del triángulo estéreo equilátero (60°)
 * 2. Posición longitudinal del oyente (evitar nodo axial 50%, apuntar a 38% Wes Lachot)
 * 3. Simetría lateral respecto al eje central (W / 2)
 * 4. Trampa SBIR de pared frontal (evitar zona maldita 0.6 m - 1.3 m)
 * 5. Generador de experimentos con registro de historial y variación de una sola variable
 */

import { SPEED_OF_SOUND } from './acoustics.js';

export class AcousticRecommender {
  constructor() {
    this.history = [];
  }

  evaluateSetup(room, listener, leftMon, rightMon) {
    const diagnostics = [];

    const distMM = Math.hypot(rightMon.x - leftMon.x, rightMon.y - leftMon.y);
    const distML = Math.hypot(listener.x - leftMon.x, listener.y - leftMon.y);
    const distMR = Math.hypot(listener.x - rightMon.x, listener.y - rightMon.y);
    const avgDistML = (distML + distMR) / 2;

    // 1. Diagnóstico del Triángulo Estéreo
    const ratioTri = distMM / (avgDistML || 1);
    if (Math.abs(ratioTri - 1.0) <= 0.05) {
      diagnostics.push({
        category: 'Geometría Estéreo',
        title: 'Triángulo Equilátero Óptimo (60°)',
        severity: 'success',
        message: `Distancia entre monitores (${distMM.toFixed(2)} m) idéntica a la distancia al oyente (${avgDistML.toFixed(2)} m). Imagen estéreo y campo fantasma centrados.`,
        action: null
      });
    } else if (ratioTri < 0.90) {
      diagnostics.push({
        category: 'Geometría Estéreo',
        title: 'Base Estéreo Demasiado Angosta',
        severity: 'warning',
        message: `Los monitores están muy juntos respecto a tu posición (${(distMM).toFixed(2)} m vs ${avgDistML.toFixed(2)} m). El campo estéreo se percibe estrecho y comprimido.`,
        action: {
          label: 'Separar monitores',
          type: 'spread_monitors',
          delta: 0.10
        }
      });
    } else {
      diagnostics.push({
        category: 'Geometría Estéreo',
        title: 'Base Estéreo Demasiado Ancha',
        severity: 'warning',
        message: `Los monitores están muy separados (${distMM.toFixed(2)} m vs ${avgDistML.toFixed(2)} m). Riesgo de 'agujero en el centro' y falta de definición en la voz principal / kick.`,
        action: {
          label: 'Acercar monitores',
          type: 'narrow_monitors',
          delta: -0.10
        }
      });
    }

    // 2. Diagnóstico de Posición Longitudinal del Oyente (Eje Y)
    const ratioY = listener.y / room.L;
    const isCenterNode = Math.abs(ratioY - 0.50) < 0.04;
    const isQuarterNode = Math.abs(ratioY - 0.25) < 0.03 || Math.abs(ratioY - 0.75) < 0.03;
    const is38Percent = Math.abs(ratioY - 0.38) <= 0.04 || Math.abs(ratioY - 0.62) <= 0.04;

    if (isCenterNode) {
      diagnostics.push({
        category: 'Ubicación Longitudinal',
        title: '¡Peligro Crítico! Oyente en el Nodo Central (50% L)',
        severity: 'danger',
        message: `Estás sentado exactamente en el 50% de la longitud (${listener.y.toFixed(2)} m de ${room.L.toFixed(2)} m). En este punto se anulan todos los modos axiales impares longitudinales (ej. fundamental ~${(SPEED_OF_SOUND / (2 * room.L)).toFixed(1)} Hz). No hay ecualizador en el mundo que recupere un nulo físico.`,
        action: {
          label: 'Mover oyente al 38%',
          type: 'set_listener_y',
          targetY: Math.round(room.L * 0.38 * 100) / 100
        }
      });
    } else if (is38Percent) {
      diagnostics.push({
        category: 'Ubicación Longitudinal',
        title: 'Zona Óptima del 38% (Wes Lachot)',
        severity: 'success',
        message: `Ubicación al ${(ratioY * 100).toFixed(1)}% de la sala (${listener.y.toFixed(2)} m). Distribución modal equilibrada evitando nodos centrales y cuartos de onda severos.`,
        action: null
      });
    } else if (isQuarterNode) {
      diagnostics.push({
        category: 'Ubicación Longitudinal',
        title: 'Zona de Nodo de Segundo Orden (25% / 75% L)',
        severity: 'warning',
        message: `Te encontrás en el nodo de segundo armónico axial. Puede existir una fuerte cancelación cerca de ${(SPEED_OF_SOUND / room.L).toFixed(1)} Hz.`,
        action: {
          label: 'Acercarse al 38%',
          type: 'move_listener_to_38'
        }
      });
    } else {
      diagnostics.push({
        category: 'Ubicación Longitudinal',
        title: `Oyente al ${(ratioY * 100).toFixed(1)}% de la sala`,
        severity: 'info',
        message: `Posición aceptable. Recomendación teórica: situarse entre el 35% y el 40% (${(room.L * 0.38).toFixed(2)} m) desde la pared frontal.`,
        action: null
      });
    }

    // 3. Diagnóstico de Simetría Lateral (Eje X)
    const midX = room.W / 2;
    const diffX = Math.abs(listener.x - midX);
    if (diffX > 0.08) {
      diagnostics.push({
        category: 'Simetría Lateral',
        title: 'Oyente Desplazado del Eje Central',
        severity: 'warning',
        message: `Tu cabeza está descentrada por ${(diffX * 100).toFixed(0)} cm respecto al centro geométrico (${midX.toFixed(2)} m). Provoca desbalance tímbrico y desfasaje en las primeras reflexiones laterales.`,
        action: {
          label: 'Centrar en el eje X',
          type: 'center_listener_x',
          targetX: midX
        }
      });
    } else {
      diagnostics.push({
        category: 'Simetría Lateral',
        title: 'Perfecta Simetría Izquierda / Derecha',
        severity: 'success',
        message: `Oyente centrado exactamente en el eje ${midX.toFixed(2)} m. Las reflexiones primarias laterales llegan en fase a ambos oídos.`,
        action: null
      });
    }

    // 4. Diagnóstico de SBIR de Pared Frontal (Front Wall)
    const dFwLeft = leftMon.y;
    const fNullFw = SPEED_OF_SOUND / (4 * Math.max(0.05, dFwLeft));

    if (dFwLeft >= 0.55 && dFwLeft <= 1.25) {
      diagnostics.push({
        category: 'SBIR Pared Frontal',
        title: 'Zona de Riesgo SBIR Severo (0.60 m - 1.20 m)',
        severity: 'danger',
        message: `Monitores ubicados a ${dFwLeft.toFixed(2)} m de la pared frontal. Esto produce un nulo de cancelación destructiva por cuarto de onda en ~${fNullFw.toFixed(0)} Hz. Es la zona más difícil de tratar porque requiere trampas de graves de gran espesor (> 25 cm).`,
        action: {
          label: 'Acercar monitores a la pared (< 25 cm)',
          type: 'push_monitors_front',
          targetY: 0.22
        }
      });
    } else if (dFwLeft < 0.35) {
      diagnostics.push({
        category: 'SBIR Pared Frontal',
        title: 'Montaje Próximo a Frontera (Estrategia Flush/Near-Wall)',
        severity: 'success',
        message: `Monitores a ${dFwLeft.toFixed(2)} m de la pared. El nulo SBIR se traslada a ~${fNullFw.toFixed(0)} Hz (frecuencia media-alta), donde paneles absorbentes comunes de 5-10 cm absorben el 100% de la energía reflejada. El realce de graves por frontera se compensa fácilmente con el switch de EQ de los monitores.`,
        action: null
      });
    } else {
      diagnostics.push({
        category: 'SBIR Pared Frontal',
        title: 'Monitores Alejados de la Frontera Frontal',
        severity: 'info',
        message: `Monitores a ${dFwLeft.toFixed(2)} m de la pared. El primer nulo SBIR cae a ~${fNullFw.toFixed(0)} Hz.`,
        action: null
      });
    }

    return diagnostics;
  }

  proposeNextExperiment(room, listener, leftMon, rightMon) {
    const diagnostics = this.evaluateSetup(room, listener, leftMon, rightMon);
    // Prioridad 1: Si hay error de nodo del 50%, corregir longitudinal
    const centerDanger = diagnostics.find(d => d.title.includes('50% L'));
    if (centerDanger && centerDanger.action) {
      return {
        actionName: 'Mover oyente al 38% de la longitud',
        variable: 'listener.y',
        deltaText: `${((room.L * 0.38) - listener.y > 0 ? '+' : '')}${(((room.L * 0.38) - listener.y) * 100).toFixed(0)} cm`,
        newConfig: {
          listenerY: Math.round(room.L * 0.38 * 100) / 100
        },
        reason: 'Evitar el nodo central del 50% donde se cancela el modo axial longitudinal fundamental de la sala.'
      };
    }

    // Prioridad 2: Descentrado lateral
    const centerOff = diagnostics.find(d => d.title.includes('Desplazado del Eje Central'));
    if (centerOff && centerOff.action) {
      return {
        actionName: 'Centrar oyente en el eje longitudinal',
        variable: 'listener.x',
        deltaText: `${((room.W / 2) - listener.x > 0 ? '+' : '')}${(((room.W / 2) - listener.x) * 100).toFixed(0)} cm`,
        newConfig: {
          listenerX: Math.round((room.W / 2) * 100) / 100
        },
        reason: 'Restablecer simetría lateral estéreo y coincidencia temporal de reflexiones tempranas.'
      };
    }

    // Prioridad 3: Peligro de SBIR frontal
    const sbirDanger = diagnostics.find(d => d.title.includes('Zona de Riesgo SBIR'));
    if (sbirDanger && sbirDanger.action) {
      return {
        actionName: 'Pegar monitores a la pared frontal (d < 25 cm)',
        variable: 'monitors.y',
        deltaText: `-${((leftMon.y - 0.22) * 100).toFixed(0)} cm`,
        newConfig: {
          monitorsY: 0.22
        },
        reason: 'Desplazar el nulo SBIR de 70-120 Hz hacia más de 350 Hz, donde cualquier panel de lana de roca de 7-10 cm lo elimina por completo.'
      };
    }

    // Prioridad 4: Ajustar apertura del triángulo equilátero
    const distMM = Math.hypot(rightMon.x - leftMon.x, rightMon.y - leftMon.y);
    const distML = Math.hypot(listener.x - leftMon.x, listener.y - leftMon.y);
    if (Math.abs(distMM - distML) > 0.08) {
      const targetHalfWidth = (distML * Math.sin(Math.PI / 6)); // para triángulo 60°
      const newLeftX = Math.round(((room.W / 2) - targetHalfWidth) * 100) / 100;
      const newRightX = Math.round(((room.W / 2) + targetHalfWidth) * 100) / 100;

      return {
        actionName: distMM < distML ? 'Separar monitores para cerrar triángulo a 60°' : 'Cerrar monitores para cerrar triángulo a 60°',
        variable: 'monitors.x',
        deltaText: `${((targetHalfWidth * 2) - distMM > 0 ? '+' : '')}${(((targetHalfWidth * 2) - distMM) * 100).toFixed(0)} cm`,
        newConfig: {
          leftMonX: newLeftX,
          rightMonX: newRightX
        },
        reason: 'Lograr una apertura angular exacta de 60° entre monitores y cabeza para una percepción holográfica del panorama estéreo.'
      };
    }

    // Si todo está dentro de parámetros óptimos, proponer búsqueda fina de oyente (± 5 cm)
    return {
      actionName: 'Micro-ajuste del oyente (+5 cm adelante)',
      variable: 'listener.y',
      deltaText: '+5 cm',
      newConfig: {
        listenerY: Math.round((listener.y - 0.05) * 100) / 100
      },
      reason: 'Búsqueda fina del punto de máxima linealidad en la zona de transición modal.'
    };
  }

  logExperiment(experiment) {
    this.history.push({
      timestamp: new Date().toLocaleTimeString(),
      id: this.history.length + 1,
      ...experiment
    });
  }
}
