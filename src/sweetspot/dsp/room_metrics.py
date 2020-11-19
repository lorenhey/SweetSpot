import numpy as np
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass

@dataclass
class RoomMode:
    frequency: float
    nx: int
    ny: int
    nz: int
    type: str # "axial", "tangential", "oblique"

def calculate_theoretical_modes(
    length_m: float,
    width_m: float,
    height_m: float,
    speed_of_sound_m_s: float = 343.0,
    max_freq: float = 300.0
) -> List[RoomMode]:
    """
    Calculates theoretical room modes for a rectangular room.
    f = (c/2) * sqrt((nx/L)^2 + (ny/W)^2 + (nz/H)^2)
    """
    modes = []
    
    # Calculate maximum index for each dimension
    n_max_x = int(max_freq * 2 * length_m / speed_of_sound_m_s) + 1
    n_max_y = int(max_freq * 2 * width_m / speed_of_sound_m_s) + 1
    n_max_z = int(max_freq * 2 * height_m / speed_of_sound_m_s) + 1
    
    for nx in range(n_max_x + 1):
        for ny in range(n_max_y + 1):
            for nz in range(n_max_z + 1):
                if nx == 0 and ny == 0 and nz == 0:
                    continue
                    
                freq = (speed_of_sound_m_s / 2.0) * np.sqrt(
                    (nx / length_m)**2 + 
                    (ny / width_m)**2 + 
                    (nz / height_m)**2
                )
                
                if freq <= max_freq:
                    zeros = sum([1 for n in (nx, ny, nz) if n == 0])
                    mode_type = "axial" if zeros == 2 else ("tangential" if zeros == 1 else "oblique")
                    
                    modes.append(RoomMode(
                        frequency=freq,
                        nx=nx, ny=ny, nz=nz,
                        type=mode_type
                    ))
                    
    # Sort by frequency
    modes.sort(key=lambda m: m.frequency)
    return modes

def schroeder_integration(ir: np.ndarray) -> np.ndarray:
    """
    Performs Schroeder backward integration to obtain the decay curve.
    """
    # Square the impulse response
    energy = ir ** 2
    
    # Backward cumulative sum
    decay = np.cumsum(energy[::-1])[::-1]
    
    # Normalize and convert to dB
    decay = np.clip(decay, 1e-12, None)
    decay_db = 10 * np.log10(decay / np.max(decay))
    
    return decay_db

def calculate_rt(decay_db: np.ndarray, sample_rate: int) -> Dict[str, Optional[float]]:
    """
    Calculates EDT, T20, and T30 from the Schroeder decay curve.
    Returns None ("NOT EVALUABLE") if dynamic range is insufficient.
    """
    time_axis = np.arange(len(decay_db)) / sample_rate
    
    def fit_line(start_db: float, end_db: float) -> Optional[float]:
        # Find indices where decay crosses the thresholds
        try:
            start_idx = np.where(decay_db <= start_db)[0][0]
            end_idx = np.where(decay_db <= end_db)[0][0]
        except IndexError:
            # Dynamic range insufficient
            return None
            
        if end_idx <= start_idx:
            return None
            
        t = time_axis[start_idx:end_idx]
        y = decay_db[start_idx:end_idx]
        
        if len(t) < 2:
            return None
            
        # Linear regression y = mx + c
        A = np.vstack([t, np.ones(len(t))]).T
        m, _ = np.linalg.lstsq(A, y, rcond=None)[0]
        
        if m >= 0:
            return None
            
        # Calculate time to drop 60 dB
        rt60 = -60.0 / m
        return float(rt60)
        
    return {
        "EDT": fit_line(0.0, -10.0),   # Drops 10 dB, extrapolated to 60
        "T20": fit_line(-5.0, -25.0),  # Drops 20 dB, extrapolated to 60
        "T30": fit_line(-5.0, -35.0)   # Drops 30 dB, extrapolated to 60
    }
