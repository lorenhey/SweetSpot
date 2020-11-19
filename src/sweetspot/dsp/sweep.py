import numpy as np

def generate_exponential_sweep(
    start_freq: float,
    end_freq: float,
    duration_s: float,
    sample_rate: int,
    level_dbfs: float = -12.0,
    fade_in_s: float = 0.05,
    fade_out_s: float = 0.05
) -> np.ndarray:
    """
    Generates an exponential (logarithmic) sine sweep.
    
    Formula: x(t) = sin(K * (exp(t / L) - 1))
    where K = 2 * pi * start_freq * duration_s / ln(end_freq / start_freq)
    and L = duration_s / ln(end_freq / start_freq)
    """
    t = np.arange(0, duration_s, 1.0 / sample_rate)
    
    # Calculate angular frequencies
    w1 = 2 * np.pi * start_freq
    w2 = 2 * np.pi * end_freq
    
    # Sweep parameters
    L = duration_s / np.log(w2 / w1)
    K = w1 * L
    
    # Generate the sweep
    sweep = np.sin(K * (np.exp(t / L) - 1))
    
    # Apply fade in/out to avoid clicks
    fade_in_samples = int(fade_in_s * sample_rate)
    fade_out_samples = int(fade_out_s * sample_rate)
    
    if fade_in_samples > 0:
        fade_in = np.hanning(2 * fade_in_samples)[:fade_in_samples]
        sweep[:fade_in_samples] *= fade_in
        
    if fade_out_samples > 0:
        fade_out = np.hanning(2 * fade_out_samples)[fade_out_samples:]
        sweep[-fade_out_samples:] *= fade_out
        
    # Scale to level
    amplitude = 10 ** (level_dbfs / 20.0)
    sweep *= amplitude
    
    return sweep

def generate_inverse_filter(
    sweep: np.ndarray,
    start_freq: float,
    end_freq: float,
    duration_s: float,
    sample_rate: int
) -> np.ndarray:
    """
    Generates the inverse filter for the exponential sine sweep.
    The inverse filter is the time-reversed sweep with an amplitude envelope
    that decreases at 3dB/octave to compensate for the pink spectrum of the sweep.
    """
    # Time vector for envelope
    t = np.arange(0, duration_s, 1.0 / sample_rate)
    
    # 3dB per octave amplitude modulation (decaying envelope)
    # The exponential sweep has energy dropping at 3dB/octave
    envelope = np.exp(-t * np.log(end_freq / start_freq) / duration_s)
    
    # Time-reversed and amplitude-modulated sweep
    inverse_filter = sweep[::-1] * envelope
    
    return inverse_filter

def deconvolve(
    recorded_signal: np.ndarray,
    inverse_filter: np.ndarray
) -> np.ndarray:
    """
    Deconvolves the recorded signal using the inverse filter to obtain the impulse response.
    This is typically done via convolution (or FFT-based fast convolution).
    """
    from scipy.signal import fftconvolve
    
    # The impulse response is the convolution of the recorded signal with the inverse filter
    ir = fftconvolve(recorded_signal, inverse_filter, mode='full')
    return ir
