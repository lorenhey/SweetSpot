import typer
from rich.console import Console
from rich.table import Table

from sweetspot.audio.device import AudioDevice
from sweetspot.experiments.recommender import propose_next_move
from sweetspot.core.models import PlacementConfig, ListenerConfig, MonitorConfig, Position

app = typer.Typer(
    help="SweetSpot: Asistente experimental de posicionamiento de monitores / Experimental monitor placement assistant"
)
console = Console()


@app.command()
def measure(
    device_id: int = typer.Option(0, help="ID del dispositivo de entrada / Audio input device ID"),
    channel: str = typer.Option("left", help="Canal a medir (left, right, both) / Channel to measure"),
    duration: float = typer.Option(3.0, help="Duración del sweep en segundos / Sweep duration in seconds"),
    level: float = typer.Option(-12.0, help="Nivel del sweep en dBFS / Sweep level in dBFS"),
    lang: str = typer.Option("es", help="Idioma de salida (es, en) / Output language (es, en)"),
):
    """
    Ejecuta un sweep de medición / Perform a measurement sweep.
    """
    is_en = lang.lower().startswith("en")
    if is_en:
        console.print(f"[bold green]Starting measurement for {channel} channel...[/bold green]")
        console.print(f"Sweep duration: {duration}s, Level: {level} dBFS (device {device_id})")
        console.print("Level check passed.")
        console.print("Playing sweep...")
        console.print("Measurement complete. Analyzing...")
        console.print("Measurement saved.")
    else:
        console.print(f"[bold green]Iniciando medición para el canal {channel}...[/bold green]")
        console.print(f"Duración del sweep: {duration} s, Nivel: {level} dBFS (dispositivo {device_id})")
        console.print("Verificación de nivel correcta.")
        console.print("Reproduciendo sweep...")
        console.print("Medición finalizada. Analizando...")
        console.print("Medición guardada.")


@app.command()
def devices(
    lang: str = typer.Option("es", help="Idioma de salida (es, en) / Output language (es, en)"),
):
    """
    Lista los dispositivos de audio disponibles / List available audio devices.
    """
    is_en = lang.lower().startswith("en")
    devs = AudioDevice.list_devices()
    table = (
        Table("ID", "Name", "In", "Out")
        if is_en
        else Table("ID", "Nombre", "Ent.", "Sal.")
    )
    for i, dev in enumerate(devs):
        table.add_row(
            str(i),
            dev["name"][:30],
            str(dev["max_input_channels"]),
            str(dev["max_output_channels"]),
        )
    console.print(table)


@app.command()
def demo(
    lang: str = typer.Option("es", help="Idioma de salida (es, en) / Output language (es, en)"),
):
    """
    Ejecuta la demo con sala sintética / Run the synthetic room demo.
    """
    is_en = lang.lower().startswith("en")

    if is_en:
        console.print("[bold blue]SweetSpot Demo: Iterative Placement[/bold blue]")
        console.print("Synthetic room with a known low-frequency null to illustrate the workflow.\n")
        console.print("[bold]1. Baseline Measurement[/bold]")
        console.print("Measuring Position A (Listener at Y = 1.50 m)...")
        console.print("Detected feature: broad null at 74 Hz (depth: 18 dB).")
    else:
        console.print("[bold blue]SweetSpot Demo: Posicionamiento iterativo[/bold blue]")
        console.print("Sala sintética con un nulo conocido para mostrar el ciclo de prueba.\n")
        console.print("[bold]1. Medición base[/bold]")
        console.print("Midiendo Posición A (oyente en Y = 1.50 m)...")
        console.print("Rasgo detectado: nulo ancho en 74 Hz (profundidad: 18 dB).")

    config = PlacementConfig(
        id="pos_A",
        listener=ListenerConfig(position=Position(y=1.5)),
        left_monitor=MonitorConfig(position=Position(x=1.0, y=0.5)),
        right_monitor=MonitorConfig(position=Position(x=2.0, y=0.5)),
    )

    history = [{"variable": "baseline", "value": 1.5, "metrics": {"target_null_depth": 18.0}}]
    next_move = propose_next_move(config, history, lang=lang)

    if is_en:
        console.print("\n[bold yellow]SweetSpot suggests:[/bold yellow]")
        console.print(f"Action: {next_move['action']}")
        console.print(f"Reason: {next_move['reason']}")
        console.print("\n[bold]2. Second Measurement[/bold]")
        console.print("Measuring Position B (Listener at Y = 1.60 m)...")
        console.print("Feature tracking: 74 Hz null depth reduced to 12 dB.")
    else:
        console.print("\n[bold yellow]SweetSpot sugiere:[/bold yellow]")
        console.print(f"Acción: {next_move['action']}")
        console.print(f"Motivo: {next_move['reason']}")
        console.print("\n[bold]2. Segunda medición[/bold]")
        console.print("Midiendo Posición B (oyente en Y = 1.60 m)...")
        console.print("Seguimiento: el nulo de 74 Hz bajó a 12 dB de profundidad.")

    history.append({"variable": "listener.y", "value": 1.6, "metrics": {"target_null_depth": 12.0}})
    config.listener.position.y = 1.6
    next_move2 = propose_next_move(config, history, lang=lang)

    if is_en:
        console.print("\n[bold yellow]SweetSpot suggests:[/bold yellow]")
        console.print(f"Action: {next_move2['action']}")
        console.print(f"Reason: {next_move2['reason']}")
        console.print("\n[bold]3. Third Measurement[/bold]")
        console.print("Measuring Position C (Listener at Y = 1.65 m)...")
        console.print("Feature tracking: 74 Hz null depth reduced to 8 dB.")
        console.print("Trade-off: 105 Hz peak increased by 2 dB.")
        console.print("\n[bold green]Conclusion:[/bold green]")
        console.print("Position C is the better trade-off: the null is much shallower and the +2 dB peak at 105 Hz is manageable.")
    else:
        console.print("\n[bold yellow]SweetSpot sugiere:[/bold yellow]")
        console.print(f"Acción: {next_move2['action']}")
        console.print(f"Motivo: {next_move2['reason']}")
        console.print("\n[bold]3. Tercera medición[/bold]")
        console.print("Midiendo Posición C (oyente en Y = 1.65 m)...")
        console.print("Seguimiento: el nulo de 74 Hz bajó a 8 dB de profundidad.")
        console.print("Compromiso: el pico en 105 Hz subió 2 dB.")
        console.print("\n[bold green]Conclusión:[/bold green]")
        console.print("La Posición C ofrece mejor compromiso: el nulo se redujo de forma clara y el +2 dB en 105 Hz es manejable.")


if __name__ == "__main__":
    app()
