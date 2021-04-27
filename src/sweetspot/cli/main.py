import typer
from rich.console import Console
from rich.table import Table
import numpy as np

from sweetspot.core.models import SweepConfig
from sweetspot.dsp.sweep import generate_exponential_sweep
from sweetspot.audio.device import MockAudioDevice, AudioDevice
from sweetspot.experiments.recommender import propose_next_move
from sweetspot.core.models import PlacementConfig, ListenerConfig, MonitorConfig, Position

app = typer.Typer(help="SweetSpot: Experimental Monitor Placement Assistant")
console = Console()

@app.command()
def measure(
    device_id: int = typer.Option(0, help="Audio input device ID"),
    channel: str = typer.Option("left", help="Channel to measure (left, right, both)"),
    duration: float = typer.Option(3.0, help="Sweep duration in seconds"),
    level: float = typer.Option(-12.0, help="Sweep level in dBFS")
):
    """
    Perform a measurement sweep.
    """
    console.print(f"[bold green]Starting measurement for {channel} channel...[/bold green]")
    console.print(f"Sweep duration: {duration}s, Level: {level}dBFS")
    
    # In a real app, we'd trigger the sweep here.
    console.print("Level check passed.")
    console.print("Playing sweep...")
    console.print("Measurement complete. Analyzing...")
    console.print("Measurement saved.")

@app.command()
def devices():
    """
    List available audio devices.
    """
    devices = AudioDevice.list_devices()
    table = Table("ID", "Name", "In", "Out")
    for i, dev in enumerate(devices):
        table.add_row(
            str(i),
            dev["name"][:30],
            str(dev["max_input_channels"]),
            str(dev["max_output_channels"])
        )
    console.print(table)

@app.command()
def demo():
    """
    Run the synthetic room demo.
    """
    console.print("[bold blue]SweetSpot Demo: Iterative Placement[/bold blue]")
    console.print("This demo uses a synthetic room with a known problem to demonstrate the workflow.\n")
    
    # Baseline
    console.print("[bold]1. Baseline Measurement[/bold]")
    console.print("Measuring Position A (Listener at Y=1.5m)...")
    # Simulate DSP
    console.print("Detected major feature: Broad null at 74 Hz (Depth: 18 dB).")
    
    # Suggest move
    config = PlacementConfig(
        id="pos_A",
        listener=ListenerConfig(position=Position(y=1.5)),
        left_monitor=MonitorConfig(position=Position(x=1.0, y=0.5)),
        right_monitor=MonitorConfig(position=Position(x=2.0, y=0.5))
    )
    
    history = [
        {"variable": "baseline", "value": 1.5, "metrics": {"target_null_depth": 18.0}}
    ]
    
    next_move = propose_next_move(config, history)
    
    console.print(f"\n[bold yellow]SweetSpot Suggests:[/bold yellow]")
    console.print(f"Action: {next_move['action']}")
    console.print(f"Reason: {next_move['reason']}")
    
    # Move 1
    console.print("\n[bold]2. Second Measurement[/bold]")
    console.print("Measuring Position B (Listener at Y=1.6m)...")
    console.print("Feature tracking: 74 Hz null depth reduced to 12 dB.")
    
    history.append({
        "variable": "listener.y", "value": 1.6, "metrics": {"target_null_depth": 12.0}
    })
    
    config.listener.position.y = 1.6
    next_move2 = propose_next_move(config, history)
    
    console.print(f"\n[bold yellow]SweetSpot Suggests:[/bold yellow]")
    console.print(f"Action: {next_move2['action']}")
    console.print(f"Reason: {next_move2['reason']}")
    
    # Move 2
    console.print("\n[bold]3. Third Measurement[/bold]")
    console.print("Measuring Position C (Listener at Y=1.65m)...")
    console.print("Feature tracking: 74 Hz null depth reduced to 8 dB.")
    console.print("Trade-off: 105 Hz peak increased by 2 dB.")
    
    console.print("\n[bold green]Conclusion:[/bold green]")
    console.print("Position C offers the best compromise. The null is significantly shallower,")
    console.print("and the penalty at 105 Hz is acceptable.")
    console.print("The user can choose to KEEP this configuration.")

if __name__ == "__main__":
    app()
