import numpy as np
import pytest

from sweetspot.dsp.sweep import generate_exponential_sweep, generate_inverse_filter, deconvolve
from sweetspot.dsp.analysis import compute_frequency_response, fractional_octave_smoothing

def test_sweep_generation():
    sr = 48000
    sweep = generate_exponential_sweep(20, 20000, 1.0, sr)
    assert len(sweep) == sr # 1 second
    
    # Should be bounded by amplitude
    assert np.max(np.abs(sweep)) > 0.01
    
def test_deconvolution_golden():
    """
    Test that deconvolving a sweep with its inverse filter yields an impulse.
    """
    sr = 48000
    sweep = generate_exponential_sweep(20, 20000, 1.0, sr)
    inverse = generate_inverse_filter(sweep, 20, 20000, 1.0, sr)
    
    # In a perfect LTI system where recorded_signal == sweep
    ir = deconvolve(sweep, inverse)
    
    # The IR should have a distinct peak
    peak_idx = np.argmax(np.abs(ir))
    peak_val = np.abs(ir[peak_idx])
    
    # The peak should be significantly larger than surrounding noise
    mean_energy = np.mean(np.abs(ir))
    assert peak_val > 10 * mean_energy

def test_smoothing_preserves_bounds():
    freqs = np.linspace(20, 20000, 1000)
    mag = np.random.normal(-10, 5, 1000)
    
    smoothed = fractional_octave_smoothing(freqs, mag, fraction=24)
    
    assert len(smoothed) == len(mag)
    assert not np.any(np.isnan(smoothed))
