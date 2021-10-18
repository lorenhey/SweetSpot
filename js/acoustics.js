/**
 * SweetSpot - Motor Matemático y Físico de Acústica de Recintos
 * 
 * Implementa:
 * - Ecuación de onda y modos propios rectangulares (axiales, tangenciales, oblicuos)
 * - Frecuencia de corte de Schroeder (f_s)
 * - SBIR (Speaker-Boundary Interference Response) por método de fuente imagen
 * - Trazado de rayos y puntos de reflexión especular temprana (RFZ / espejo)
 * - Síntesis espectral de baja frecuencia (20 Hz - 500 Hz) con superposición modal y de frontera
 * - Criterio de Bonello y proporciones dimensionales de Bolt
 */

export const SPEED_OF_SOUND = 343.0; // m/s a 20°C y 1 atm

/**
 * Calcula los modos propios teóricos de una sala paralelepipédica rectangular.
 * Fórmula de Rayleigh: f = (c/2) * sqrt((nx/W)^2 + (ny/L)^2 + (nz/H)^2)
 */
export function calculateRoomModes(L, W, H, maxFreq = 300, c = SPEED_OF_SOUND) {
  const modes = [];
  const nMaxX = Math.ceil((2 * maxFreq * W) / c);
  const nMaxY = Math.ceil((2 * maxFreq * L) / c);
  const nMaxZ = Math.ceil((2 * maxFreq * H) / c);

  for (let nx = 0; nx <= nMaxX; nx++) {
    for (let ny = 0; ny <= nMaxY; ny++) {
      for (let nz = 0; nz <= nMaxZ; nz++) {
        if (nx === 0 && ny === 0 && nz === 0) continue;

        const freq = (c / 2) * Math.sqrt(
          Math.pow(nx / W, 2) +
          Math.pow(ny / L, 2) +
          Math.pow(nz / H, 2)
        );

        if (freq <= maxFreq) {
          const zeros = (nx === 0 ? 1 : 0) + (ny === 0 ? 1 : 0) + (nz === 0 ? 1 : 0);
          let type = 'oblique';
          let weight = 0.5; // -6 dB de energía relativa
          let q = 15;

          if (zeros === 2) {
            type = 'axial';
            weight = 1.0; // 0 dB (modos más energéticos y problemáticos)
            q = 30;
          } else if (zeros === 1) {
            type = 'tangential';
            weight = 0.707; // -3 dB
            q = 20;
          }

          modes.push({
            freq: Math.round(freq * 10) / 10,
            nx,
            ny,
            nz,
            type,
            weight,
            q,
            label: `${type.toUpperCase()} (${nx}, ${ny}, ${nz})`
          });
        }
      }
    }
  }

  modes.sort((a, b) => a.freq - b.freq);
  return modes;
}

/**
 * Frecuencia de transición de Schroeder (f_s)
 * Separa la región de resonancias discretas de la región difusa estadística.
 * f_s = 2000 * sqrt(T60 / V)
 */
export function calculateSchroederFrequency(L, W, H, rt60 = 0.35) {
  const volume = L * W * H;
  if (volume <= 0) return 0;
  return Math.round(2000 * Math.sqrt(rt60 / volume));
}

/**
 * Evaluación de proporciones según el diagrama de Bolt (área de aceptación)
 * Ratios normalizados: H = 1.0, W/H, L/H
 */
export function evaluateBoltProportions(L, W, H) {
  const normW = W / H;
  const normL = L / H;
  
  // Proporciones clásicas favorables:
  // Sepmeyer: 1 : 1.14 : 1.39 | 1 : 1.28 : 1.54 | 1 : 1.60 : 2.33
  // Louden: 1 : 1.4 : 1.9
  // Boner: 1 : 1.26 : 1.59
  const isCubic = Math.abs(L - W) < 0.15 && Math.abs(W - H) < 0.15;
  const isSquareFloor = Math.abs(L - W) < 0.15;
  const isHarmonicMultiple = (Math.abs(L % H) < 0.1) || (Math.abs(W % H) < 0.1);

  let status = 'Favorable';
  let badgeClass = 'badge-success';
  let feedback = 'Distribución modal relativamente dispersa. Sin solapamientos severos directos.';

  if (isCubic) {
    status = 'Crítica (Cúbica)';
    badgeClass = 'badge-danger';
    feedback = 'Sala cúbica (L ≈ W ≈ H): triple degeneración modal. Todos los modos axiales fundamentales se solapan en la misma frecuencia creando picos y cancelaciones extremas.';
  } else if (isSquareFloor) {
    status = 'Desfavorable (Planta Cuadrada)';
    badgeClass = 'badge-warning';
    feedback = 'Planta cuadrada (L ≈ W): doble degeneración modal en los ejes X e Y. Se generarán picos y valles acentuados en frecuencias idénticas.';
  } else if (isHarmonicMultiple) {
    status = 'Precaución (Múltiplos Enteros)';
    badgeClass = 'badge-warning';
    feedback = 'Una de las dimensiones es múltiplo casi exacto de otra. Riesgo de resonancias armónicas coincidentes.';
  }

  return {
    ratioText: `1.00 : ${normW.toFixed(2)} : ${normL.toFixed(2)} (H : W : L)`,
    status,
    badgeClass,
    feedback,
    normW,
    normL
  };
}

/**
 * Criterio de Bonello por tercios de octava (20 Hz - 250 Hz)
 * La densidad modal debe ser monótonamente creciente con la frecuencia.
 */
export function calculateBonelloCriterion(modes) {
  const bands = [
    { center: 25, min: 22.4, max: 28.2 },
    { center: 31.5, min: 28.2, max: 35.5 },
    { center: 40, min: 35.5, max: 44.7 },
    { center: 50, min: 44.7, max: 56.2 },
    { center: 63, min: 56.2, max: 70.8 },
    { center: 80, min: 70.8, max: 89.1 },
    { center: 100, min: 89.1, max: 112.2 },
    { center: 125, min: 112.2, max: 141.3 },
    { center: 160, min: 141.3, max: 177.8 },
    { center: 200, min: 177.8, max: 223.9 },
    { center: 250, min: 223.9, max: 281.8 }
  ];

  const distribution = bands.map(b => {
    const count = modes.filter(m => m.freq >= b.min && m.freq < b.max).length;
    return {
      band: `${b.center} Hz`,
      center: b.center,
      count,
      isDip: false
    };
  });

  // Evaluar monotonía
  let passes = true;
  for (let i = 1; i < distribution.length; i++) {
    if (distribution[i].count < distribution[i - 1].count && distribution[i - 1].count > 0) {
      distribution[i].isDip = true;
      passes = false;
    }
  }

  return { distribution, passes };
}

/**
 * Cálculo de interferencias de frontera (SBIR) para un monitor y un oyente.
 * Calcula las trayectorias de onda directa y reflejada en las 6 fronteras de la sala:
 * - Pared frontal (Front Wall: y = 0)
 * - Paredes laterales (Left Wall: x = 0, Right Wall: x = W)
 * - Pared trasera (Back Wall: y = L)
 * - Suelo (Floor: z = 0)
 * - Techo (Ceiling: z = H)
 */
export function calculateSBIRInterferences(monitor, listener, roomDim, absorption = {}) {
  const { x: mx, y: my, z: mz } = monitor;
  const { x: lx, y: ly, z: lz } = listener;
  const { L, W, H } = roomDim;

  // Distancia directa emisor -> receptor
  const dDirect = Math.hypot(lx - mx, ly - my, lz - mz);
  const directDelayMs = (dDirect / SPEED_OF_SOUND) * 1000;

  // Coeficientes de absorción por defecto (alfa)
  const alpha = {
    front: absorption.front ?? 0.15,
    back: absorption.back ?? 0.25,
    side: absorption.side ?? 0.20,
    floor: absorption.floor ?? 0.10,
    ceiling: absorption.ceiling ?? 0.20
  };

  // Coeficientes de reflexión de presión (R = sqrt(1 - alpha))
  const reflCoeff = {
    front: Math.sqrt(Math.max(0, 1 - alpha.front)),
    back: Math.sqrt(Math.max(0, 1 - alpha.back)),
    left: Math.sqrt(Math.max(0, 1 - alpha.side)),
    right: Math.sqrt(Math.max(0, 1 - alpha.side)),
    floor: Math.sqrt(Math.max(0, 1 - alpha.floor)),
    ceiling: Math.sqrt(Math.max(0, 1 - alpha.ceiling))
  };

  // Definir fuentes imagen para cada pared
  const boundaries = [
    {
      id: 'front',
      name: 'Pared Frontal',
      wallPos: 0,
      axis: 'y',
      image: { x: mx, y: -my, z: mz },
      distToWall: my,
      reflCoeff: reflCoeff.front
    },
    {
      id: 'left',
      name: 'Pared Lateral Izquierda',
      wallPos: 0,
      axis: 'x',
      image: { x: -mx, y: my, z: mz },
      distToWall: mx,
      reflCoeff: reflCoeff.left
    },
    {
      id: 'right',
      name: 'Pared Lateral Derecha',
      wallPos: W,
      axis: 'x',
      image: { x: 2 * W - mx, y: my, z: mz },
      distToWall: W - mx,
      reflCoeff: reflCoeff.right
    },
    {
      id: 'back',
      name: 'Pared Trasera',
      wallPos: L,
      axis: 'y',
      image: { x: mx, y: 2 * L - my, z: mz },
      distToWall: L - my,
      reflCoeff: reflCoeff.back
    },
    {
      id: 'floor',
      name: 'Suelo',
      wallPos: 0,
      axis: 'z',
      image: { x: mx, y: my, z: -mz },
      distToWall: mz,
      reflCoeff: reflCoeff.floor
    },
    {
      id: 'ceiling',
      name: 'Techo',
      wallPos: H,
      axis: 'z',
      image: { x: mx, y: my, z: 2 * H - mz },
      distToWall: H - mz,
      reflCoeff: reflCoeff.ceiling
    }
  ];

  const results = boundaries.map(b => {
    const dRefl = Math.hypot(lx - b.image.x, ly - b.image.y, lz - b.image.z);
    const deltaD = dRefl - dDirect;
    const delayMs = (deltaD / SPEED_OF_SOUND) * 1000;

    // Primer nulo de cancelación por cuarto de onda angular exacto:
    // deltaD = lambda / 2 -> f_null = c / (2 * deltaD)
    // Aproximación perpendicular simple: f_null_perp = c / (4 * distToWall)
    const fNull = deltaD > 0.01 ? SPEED_OF_SOUND / (2 * deltaD) : SPEED_OF_SOUND / (4 * Math.max(0.05, b.distToWall));
    const fNullPerp = SPEED_OF_SOUND / (4 * Math.max(0.05, b.distToWall));

    // Primer pico constructivo por media onda:
    // deltaD = lambda -> f_peak = c / deltaD
    const fPeak = deltaD > 0.01 ? SPEED_OF_SOUND / deltaD : SPEED_OF_SOUND / (2 * Math.max(0.05, b.distToWall));

    // Punto de reflexión especular en 2D (planta x-y) si aplica
    let specularPoint = null;
    if (b.axis === 'y') {
      const wallY = b.wallPos;
      const t = (wallY - my) / (b.image.y - my + (ly - wallY) === 0 ? 1 : (b.image.y - my));
      // Intersección recta monitor-imagen con oyente
      // x(t) = mx + (lx - mx) * (wallY - my)/(ly - my)
      const ratio = (wallY - my) / (ly - my);
      const specX = mx + ratio * (lx - mx);
      specularPoint = { x: specX, y: wallY };
    } else if (b.axis === 'x') {
      const wallX = b.wallPos;
      const ratio = (wallX - mx) / (lx - mx);
      const specY = my + ratio * (ly - my);
      specularPoint = { x: wallX, y: specY };
    }

    return {
      id: b.id,
      name: b.name,
      distToWall: Math.round(b.distToWall * 100) / 100,
      dDirect: Math.round(dDirect * 100) / 100,
      dRefl: Math.round(dRefl * 100) / 100,
      deltaD: Math.round(deltaD * 100) / 100,
      delayMs: Math.round(delayMs * 10) / 10,
      fNull: Math.round(fNull),
      fNullPerp: Math.round(fNullPerp),
      fPeak: Math.round(fPeak),
      reflCoeff: b.reflCoeff,
      specularPoint
    };
  });

  return {
    dDirect: Math.round(dDirect * 100) / 100,
    directDelayMs: Math.round(directDelayMs * 10) / 10,
    boundaries: results
  };
}

/**
 * Calcula el punto de reflexión especular exacto sobre cualquier pared
 * usando el método de la fuente imagen para el trazado de rayos.
 */
export function calculateMirrorReflectionRay(monitor, listener, wallType, roomDim) {
  const { x: mx, y: my } = monitor;
  const { x: lx, y: ly } = listener;
  const { L, W } = roomDim;

  if (wallType === 'left') {
    // Pared izquierda: x = 0. Fuente imagen en (-mx, my)
    // Recta desde (-mx, my) hasta (lx, ly): corta x=0 en y_spec
    // (y_spec - my) / (ly - my) = (0 - (-mx)) / (lx - (-mx)) = mx / (lx + mx)
    const ySpec = my + (ly - my) * (mx / (lx + mx));
    return { x: 0, y: ySpec, valid: ySpec >= 0 && ySpec <= L };
  }

  if (wallType === 'right') {
    // Pared derecha: x = W. Fuente imagen en (2W - mx, my)
    const dxImg = (2 * W - mx) - lx;
    const dyImg = my - ly;
    // Recta corta x = W
    const ySpec = ly + dyImg * ((W - lx) / ((2 * W - mx) - lx));
    return { x: W, y: ySpec, valid: ySpec >= 0 && ySpec <= L };
  }

  if (wallType === 'front') {
    // Pared frontal: y = 0. Fuente imagen en (mx, -my)
    const xSpec = mx + (lx - mx) * (my / (ly + my));
    return { x: xSpec, y: 0, valid: xSpec >= 0 && xSpec <= W };
  }

  if (wallType === 'back') {
    // Pared trasera: y = L. Fuente imagen en (mx, 2L - my)
    const dy = (2 * L - my) - ly;
    const dx = mx - lx;
    const xSpec = lx + dx * ((L - ly) / dy);
    return { x: xSpec, y: L, valid: xSpec >= 0 && xSpec <= W };
  }

  return null;
}

/**
 * Síntesis espectral de baja frecuencia combinada:
 * - Respuesta modal con funciones de transferencia resonantes acopladas a la posición del emisor y oyente
 * - Interferencias de frontera SBIR con fase compleja e inversa del cuadrado de la distancia
 * Rango: 20 Hz - 500 Hz
 */
export function synthesizeFrequencyResponse(roomDim, leftMon, rightMon, listener, modes, options = {}) {
  const { L, W, H } = roomDim;
  const numPoints = options.numPoints || 240;
  const minFreq = options.minFreq || 20.0;
  const maxFreq = options.maxFreq || 500.0;

  // Escala logarítmica de frecuencias
  const freqs = [];
  const logMin = Math.log10(minFreq);
  const logMax = Math.log10(maxFreq);
  const step = (logMax - logMin) / (numPoints - 1);

  for (let i = 0; i < numPoints; i++) {
    freqs.push(Math.pow(10, logMin + i * step));
  }

  // Precalcular SBIR para monitor izquierdo y derecho
  const sbirLeft = calculateSBIRInterferences(leftMon, listener, roomDim);
  const sbirRight = calculateSBIRInterferences(rightMon, listener, roomDim);

  const curve = freqs.map(f => {
    // 1. Cálculo de SBIR complejo para ambos canales
    let realSBIR = 1.0;
    let imagSBIR = 0.0;

    // Sumar contribución de reflexiones de frontera de ambos monitores (normalizado por canal)
    [sbirLeft, sbirRight].forEach(sbir => {
      const dDir = sbir.dDirect;
      sbir.boundaries.forEach(b => {
        if (b.deltaD > 0.005) {
          const deltaT = b.deltaD / SPEED_OF_SOUND;
          const phase = 2 * Math.PI * f * deltaT;
          // Inversión de fase en frontera rígida (-1) combinada con coeficiente de reflexión
          const attenuation = (dDir / Math.max(0.1, b.dRefl)) * b.reflCoeff * 0.45;
          realSBIR -= attenuation * Math.cos(phase);
          imagSBIR -= attenuation * Math.sin(phase);
        }
      });
    });

    const sbirMag = Math.sqrt(realSBIR * realSBIR + imagSBIR * imagSBIR);
    let sbirDb = 20 * Math.log10(Math.max(1e-4, sbirMag));

    // 2. Acoplamiento de modos propios de la sala
    // Factor de acoplamiento espacial emisor-receptor:
    // C(M, L) = cos(nx*pi*Mx/W) * cos(ny*pi*My/L) * cos(nz*pi*Mz/H) * cos(nx*pi*Lx/W) * cos(ny*pi*Ly/L) * cos(nz*pi*Lz/H)
    let modalPressureReal = 0;
    let modalPressureImag = 0;

    for (const m of modes) {
      if (m.freq > maxFreq * 1.2) continue;

      // Acoplamiento monitor izquierdo
      const sL = Math.cos((m.nx * Math.PI * leftMon.x) / W) *
                 Math.cos((m.ny * Math.PI * leftMon.y) / L) *
                 Math.cos((m.nz * Math.PI * leftMon.z) / H);

      // Acoplamiento monitor derecho
      const sR = Math.cos((m.nx * Math.PI * rightMon.x) / W) *
                 Math.cos((m.ny * Math.PI * rightMon.y) / L) *
                 Math.cos((m.nz * Math.PI * rightMon.z) / H);

      // Recepción en el oyente
      const rL = Math.cos((m.nx * Math.PI * listener.x) / W) *
                 Math.cos((m.ny * Math.PI * listener.y) / L) *
                 Math.cos((m.nz * Math.PI * listener.z) / H);

      const coupling = 0.5 * (sL + sR) * rL;

      // Función de transferencia Lorentzian de segundo orden para resonador acústico
      const fRatio = f / m.freq;
      const denomReal = 1 - Math.pow(fRatio, 2);
      const denomImag = fRatio / m.q;
      const denomNorm = denomReal * denomReal + denomImag * denomImag;

      const respReal = (coupling * m.weight * denomReal) / (denomNorm * m.q);
      const respImag = (-coupling * m.weight * denomImag) / (denomNorm * m.q);

      modalPressureReal += respReal;
      modalPressureImag += respImag;
    }

    // Convertir respuesta modal combinada a dB
    const modalMagnitude = Math.sqrt(Math.pow(1.0 + modalPressureReal, 2) + Math.pow(modalPressureImag, 2));
    let modalDb = 20 * Math.log10(Math.max(1e-3, modalMagnitude));

    // Limitar picos y valles a márgenes físicos realistas (+18 dB / -30 dB)
    modalDb = Math.max(-28, Math.min(18, modalDb));
    sbirDb = Math.max(-26, Math.min(6, sbirDb));

    // Respuesta total combinada (superposición de presión)
    const combinedDb = Math.max(-32, Math.min(20, sbirDb + modalDb));

    return {
      freq: Math.round(f * 10) / 10,
      spl: Math.round(combinedDb * 10) / 10,
      sbirDb: Math.round(sbirDb * 10) / 10,
      modalDb: Math.round(modalDb * 10) / 10
    };
  });

  return curve;
}

/**
 * Genera una matriz 2D de presión estacionaria para un modo específico (nx, ny)
 * para dibujar un mapa de calor sobre la planta de la sala.
 * P(x, y) = |cos(nx * pi * x / W) * cos(ny * pi * y / L)|
 */
export function generateModalHeatmap(nx, ny, L, W, gridX = 40, gridY = 40) {
  const grid = [];
  for (let j = 0; j < gridY; j++) {
    const row = [];
    const y = (j / (gridY - 1)) * L;
    for (let i = 0; i < gridX; i++) {
      const x = (i / (gridX - 1)) * W;
      const p = Math.cos((nx * Math.PI * x) / W) * Math.cos((ny * Math.PI * y) / L);
      row.push(p); // Valor entre -1.0 y +1.0
    }
    grid.push(row);
  }
  return grid;
}
