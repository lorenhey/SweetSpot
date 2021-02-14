import numpy as np
from typing import List, Dict, Optional, Any
from dataclasses import dataclass
from scipy.signal import find_peaks

@dataclass
class ResponseFeature:
    frequency: float
    depth_db: float
    bandwidth_hz: float
    type: str # "peak" or "null"

def find_major_nulls(
    freqs: np.ndarray,
    magnitude_db: np.ndarray,
    min_freq: float = 30.0,
    max_freq: float = 300.0,
    prominence_db: float = 5.0
) -> List[ResponseFeature]:
    """
    Finds major nulls (cancellations) in the low frequency response.
    """
    # Restrict to low frequency range
    mask = (freqs >= min_freq) & (freqs <= max_freq)
    f_band = freqs[mask]
    mag_band = magnitude_db[mask]
    
    if len(mag_band) < 3:
        return []
        
    # Invert to find peaks (which are nulls in original)
    inv_mag = -mag_band
    
    peaks, properties = find_peaks(inv_mag, prominence=prominence_db, width=1)
    
    features = []
    for i, peak_idx in enumerate(peaks):
        freq = f_band[peak_idx]
        depth = properties["prominences"][i]
        
        # Approximate bandwidth
        width_idx = properties["widths"][i]
        # Very rough approximation of Hz width based on index width
        df = (f_band[-1] - f_band[0]) / len(f_band)
        bandwidth = width_idx * df
        
        features.append(ResponseFeature(
            frequency=freq,
            depth_db=depth,
            bandwidth_hz=bandwidth,
            type="null"
        ))
        
    return features

def calculate_lr_mismatch(
    freqs: np.ndarray,
    mag_l_db: np.ndarray,
    mag_r_db: np.ndarray,
    min_freq: float = 100.0,
    max_freq: float = 10000.0
) -> float:
    """
    Calculates the Mean Absolute Error between Left and Right responses
    in the specified frequency band.
    """
    mask = (freqs >= min_freq) & (freqs <= max_freq)
    
    if not np.any(mask):
        return 0.0
        
    diff = np.abs(mag_l_db[mask] - mag_r_db[mask])
    return float(np.mean(diff))

def track_feature_movement(
    baseline_features: List[ResponseFeature],
    new_features: List[ResponseFeature],
    tolerance_hz: float = 10.0
) -> Dict[str, Any]:
    """
    Tracks how a specific null or peak changed between two measurements.
    """
    # Simple matching based on nearest frequency
    tracked = []
    
    for base in baseline_features:
        # Find closest new feature
        if not new_features:
            continue
            
        distances = [abs(f.frequency - base.frequency) for f in new_features]
        min_idx = np.argmin(distances)
        
        if distances[min_idx] <= tolerance_hz:
            new_f = new_features[min_idx]
            depth_change = base.depth_db - new_f.depth_db
            
            tracked.append({
                "frequency_base": base.frequency,
                "frequency_new": new_f.frequency,
                "depth_change_db": depth_change,
                "improved": depth_change > 0 # Depth decreased is an improvement for a null
            })
            
    return tracked
