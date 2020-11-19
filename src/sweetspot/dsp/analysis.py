import numpy as np
from scipy.signal import hilbert

def find_direct_arrival(ir: np.ndarray, threshold_ratio: float = 0.1) -> int:
    """
    Finds the sample index of the direct sound arrival.
    Uses the peak of the envelope (ETC) to find the primary arrival.
    """
    etc = compute_etc(ir)
    peak_idx = np.argmax(etc)
    
    # Optionally, we can search backwards from the peak to find where the energy
    # exceeds a certain threshold to get a better 'start' of the impulse.
    # For now, return the peak.
    return int(peak_idx)

def compute_etc(ir: np.ndarray) -> np.ndarray:
    """
    Computes the Energy Time Curve (ETC) of the impulse response.
    Returns the envelope in dB.
    """
    analytic_signal = hilbert(ir)
    envelope = np.abs(analytic_signal)
    
    # Avoid log of zero
    envelope = np.clip(envelope, 1e-12, None)
    
    # Convert to dB relative to peak
    etc_db = 20 * np.log10(envelope / np.max(envelope))
    return etc_db

def apply_window(
    ir: np.ndarray,
    peak_idx: int,
    sample_rate: int,
    pre_window_ms: float = 20.0,
    post_window_ms: float = 500.0,
    taper_ms: float = 10.0
) -> np.ndarray:
    """
    Applies an asymmetric window to the impulse response around the direct arrival.
    """
    pre_samples = int(pre_window_ms * sample_rate / 1000.0)
    post_samples = int(post_window_ms * sample_rate / 1000.0)
    taper_samples = int(taper_ms * sample_rate / 1000.0)
    
    start_idx = max(0, peak_idx - pre_samples)
    end_idx = min(len(ir), peak_idx + post_samples)
    
    windowed_ir = np.zeros_like(ir)
    
    if start_idx >= end_idx:
        return windowed_ir
        
    core = ir[start_idx:end_idx].copy()
    
    # Apply tapers (half Hanning)
    if taper_samples > 0:
        actual_taper_start = min(taper_samples, len(core) // 2)
        actual_taper_end = min(taper_samples, len(core) // 2)
        
        if actual_taper_start > 0:
            fade_in = np.hanning(2 * actual_taper_start)[:actual_taper_start]
            core[:actual_taper_start] *= fade_in
            
        if actual_taper_end > 0:
            fade_out = np.hanning(2 * actual_taper_end)[actual_taper_end:]
            core[-actual_taper_end:] *= fade_out
            
    windowed_ir[start_idx:end_idx] = core
    return windowed_ir

def compute_frequency_response(
    ir: np.ndarray,
    sample_rate: int,
    n_fft: int = 65536
):
    """
    Computes the frequency response of the (windowed) impulse response.
    Returns (frequencies, magnitude_db, phase_rad).
    """
    from scipy.fft import rfft, rfftfreq
    
    spectrum = rfft(ir, n=n_fft)
    freqs = rfftfreq(n_fft, d=1.0/sample_rate)
    
    magnitude = np.abs(spectrum)
    magnitude = np.clip(magnitude, 1e-12, None)
    magnitude_db = 20 * np.log10(magnitude)
    
    phase = np.angle(spectrum)
    
    return freqs, magnitude_db, phase

def fractional_octave_smoothing(
    freqs: np.ndarray,
    magnitude_db: np.ndarray,
    fraction: int = 24
) -> np.ndarray:
    """
    Applies fractional octave smoothing (e.g., 1/24 octave) to a frequency response.
    Uses a moving average over a logarithmically growing window.
    """
    if fraction <= 0 or len(freqs) < 2:
        return magnitude_db.copy()
        
    smoothed = np.zeros_like(magnitude_db)
    
    # The bandwidth factor for 1/N octave
    factor = 2 ** (1.0 / (2 * fraction))
    
    for i, f in enumerate(freqs):
        if f == 0:
            smoothed[i] = magnitude_db[i]
            continue
            
        f_low = f / factor
        f_high = f * factor
        
        # Find indices within this frequency band
        idx_low = np.searchsorted(freqs, f_low)
        idx_high = np.searchsorted(freqs, f_high)
        
        if idx_high > idx_low:
            smoothed[i] = np.mean(magnitude_db[idx_low:idx_high])
        else:
            smoothed[i] = magnitude_db[i]
            
    return smoothed
