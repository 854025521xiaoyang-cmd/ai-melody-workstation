#!/usr/bin/env python3
import argparse
from dataclasses import dataclass
from typing import List, Optional

import librosa
import numpy as np
import music21 as m21


@dataclass
class NoteEvent:
    midi: int
    start_s: float
    end_s: float


def extract_f0(
    y: np.ndarray,
    sr: int,
    fmin: float,
    fmax: float,
    frame_length: int,
    hop_length: int,
) -> np.ndarray:
    f0, voiced_flag, _ = librosa.pyin(
        y,
        fmin=fmin,
        fmax=fmax,
        sr=sr,
        frame_length=frame_length,
        hop_length=hop_length,
    )
    f0 = np.where(voiced_flag, f0, np.nan)
    return f0


def f0_to_events(
    f0: np.ndarray,
    hop_s: float,
    min_duration_s: float,
) -> List[NoteEvent]:
    events: List[NoteEvent] = []
    current_midi: Optional[int] = None
    current_start: Optional[float] = None

    for i, hz in enumerate(f0):
        t = i * hop_s
        if np.isnan(hz):
            if current_midi is not None:
                end_t = t
                if end_t - current_start >= min_duration_s:
                    events.append(NoteEvent(current_midi, current_start, end_t))
                current_midi = None
                current_start = None
            continue

        midi = int(np.rint(librosa.hz_to_midi(hz)))

        if current_midi is None:
            current_midi = midi
            current_start = t
            continue

        if midi != current_midi:
            end_t = t
            if end_t - current_start >= min_duration_s:
                events.append(NoteEvent(current_midi, current_start, end_t))
            current_midi = midi
            current_start = t

    if current_midi is not None:
        end_t = len(f0) * hop_s
        if end_t - current_start >= min_duration_s:
            events.append(NoteEvent(current_midi, current_start, end_t))

    return events


def events_to_score(
    events: List[NoteEvent],
    bpm: float,
    add_rests: bool,
) -> m21.stream.Stream:
    def quantize(value: float) -> float:
        return max(0.25, round(value * 4) / 4)

    stream = m21.stream.Stream()
    stream.append(m21.tempo.MetronomeMark(number=bpm))

    current_time = 0.0
    sec_to_quarter = bpm / 60.0

    for ev in events:
        if add_rests and ev.start_s > current_time:
            rest_dur = quantize((ev.start_s - current_time) * sec_to_quarter)
            rest = m21.note.Rest()
            rest.quarterLength = rest_dur
            stream.append(rest)

        note = m21.note.Note()
        note.pitch.midi = ev.midi
        note.quarterLength = quantize((ev.end_s - ev.start_s) * sec_to_quarter)
        stream.append(note)
        current_time = ev.end_s

    return stream


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Convert piano audio to notes and generate sheet music (MusicXML)."
    )
    parser.add_argument("input", help="Path to audio file (wav/mp3/etc.)")
    parser.add_argument(
        "-o",
        "--output",
        default="output.musicxml",
        help="Output MusicXML path",
    )
    parser.add_argument("--bpm", type=float, default=120.0, help="Tempo for score")
    parser.add_argument("--sr", type=int, default=22050, help="Resample rate")
    parser.add_argument("--frame-length", type=int, default=2048)
    parser.add_argument("--hop-length", type=int, default=256)
    parser.add_argument("--min-duration", type=float, default=0.1)
    parser.add_argument("--no-rests", action="store_true")
    parser.add_argument("--fmin", type=float, default=27.5)
    parser.add_argument("--fmax", type=float, default=4186.0)

    args = parser.parse_args()

    y, sr = librosa.load(args.input, sr=args.sr, mono=True)
    f0 = extract_f0(
        y=y,
        sr=sr,
        fmin=args.fmin,
        fmax=args.fmax,
        frame_length=args.frame_length,
        hop_length=args.hop_length,
    )
    events = f0_to_events(
        f0=f0,
        hop_s=args.hop_length / sr,
        min_duration_s=args.min_duration,
    )
    score = events_to_score(events, bpm=args.bpm, add_rests=not args.no_rests)
    score.write("musicxml", fp=args.output)


if __name__ == "__main__":
    main()
