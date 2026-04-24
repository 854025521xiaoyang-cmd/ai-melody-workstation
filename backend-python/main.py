from __future__ import annotations

import json
import random
import secrets
import sys
import uuid
from datetime import datetime
from hashlib import pbkdf2_hmac
from pathlib import Path
from typing import Any, Dict, List

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
DATA_PATH = BASE_DIR / "data.json"
GENERATED_DIR = BASE_DIR / "generated"
DIST_DIR = PROJECT_ROOT / "dist"
PUBLIC_DIR = PROJECT_ROOT / "public"
SESSION_COOKIE = "piano_session"

sys.path.append(str(PROJECT_ROOT))

from piano_to_sheet import extract_f0, events_to_score, f0_to_events  # noqa: E402

import librosa  # noqa: E402

app = FastAPI()
GENERATED_DIR.mkdir(exist_ok=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"] ,
    allow_headers=["*"] ,
)

if DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")
if PUBLIC_DIR.exists():
    app.mount("/test-audio", StaticFiles(directory=PUBLIC_DIR / "test-audio"), name="test-audio")
app.mount("/static", StaticFiles(directory=PROJECT_ROOT), name="static")
app.mount("/generated", StaticFiles(directory=GENERATED_DIR), name="generated")


def load_data() -> Dict[str, Any]:
    if not DATA_PATH.exists():
        return {
            "users": [],
            "orders": [],
            "purchases": [],
            "sessions": {},
            "projects": [],
            "settings": {},
        }
    try:
        data = json.loads(DATA_PATH.read_text())
    except json.JSONDecodeError:
        data = {}
    data.setdefault("users", [])
    data.setdefault("orders", [])
    data.setdefault("purchases", [])
    data.setdefault("sessions", {})
    data.setdefault("projects", [])
    data.setdefault("settings", {})
    return data


def save_data(data: Dict[str, Any]) -> None:
    DATA_PATH.write_text(json.dumps(data, indent=2))


def hash_password(password: str, salt: str) -> str:
    digest = pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120_000)
    return digest.hex()


def require_user(request: Request) -> str:
    session_id = request.cookies.get(SESSION_COOKIE)
    if not session_id:
        raise HTTPException(status_code=401, detail="Not logged in")
    data = load_data()
    user_id = data.get("sessions", {}).get(session_id)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid session")
    return user_id


def get_optional_user_id(request: Request) -> str:
    session_id = request.cookies.get(SESSION_COOKIE)
    if not session_id:
        return "local-demo"
    data = load_data()
    return data.get("sessions", {}).get(session_id, "local-demo")


def pitch_to_midi(note_name: str) -> int:
    pitch_map = {
        "C": 0,
        "C#": 1,
        "Db": 1,
        "D": 2,
        "D#": 3,
        "Eb": 3,
        "E": 4,
        "F": 5,
        "F#": 6,
        "Gb": 6,
        "G": 7,
        "G#": 8,
        "Ab": 8,
        "A": 9,
        "A#": 10,
        "Bb": 10,
        "B": 11,
    }
    octave = int(note_name[-1])
    pitch = note_name[:-1]
    return 12 * (octave + 1) + pitch_map[pitch]


def parse_duration_beats(value: str) -> float:
    return {
        "16n": 0.25,
        "8n": 0.5,
        "4n": 1.0,
        "2n": 2.0,
        "1n": 4.0,
    }.get(value, 1.0)


def make_prompt_seed(*parts: str) -> int:
    joined = "|".join(parts)
    return abs(hash(joined)) % (2 ** 32)


def scales_map() -> Dict[str, List[str]]:
    return {
        "C major": ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"],
        "A minor": ["A3", "B3", "C4", "D4", "E4", "F4", "G4", "A4"],
        "D minor": ["D4", "E4", "F4", "G4", "A4", "Bb4", "C5", "D5"],
        "G major": ["G3", "A3", "B3", "C4", "D4", "E4", "F#4", "G4"],
    }


def chord_map() -> Dict[str, List[List[str]]]:
    return {
        "C major": [["C3", "E3", "G3"], ["F3", "A3", "C4"], ["G3", "B3", "D4"], ["A3", "C4", "E4"]],
        "A minor": [["A2", "C3", "E3"], ["F2", "A2", "C3"], ["C3", "E3", "G3"], ["G2", "B2", "D3"]],
        "D minor": [["D3", "F3", "A3"], ["Bb2", "D3", "F3"], ["F3", "A3", "C4"], ["C3", "E3", "G3"]],
        "G major": [["G2", "B2", "D3"], ["C3", "E3", "G3"], ["D3", "F#3", "A3"], ["E3", "G3", "B3"]],
    }


def pick_durations(style: str, mood: str, bpm: int) -> List[str]:
    if style == "K-Ballad" or mood == "韩系抒情":
        if bpm <= 72:
            return ["2n", "4n", "8n", "4n"]
        if bpm >= 96:
            return ["8n", "8n", "4n", "8n", "4n"]
        return ["4n", "8n", "8n", "4n", "4n"]
    if style == "Lo-fi":
        return ["4n", "8n", "4n", "8n"] if bpm <= 78 else ["8n", "8n", "4n", "8n"]
    if style == "电子":
        return ["8n", "8n", "4n", "8n"] if bpm <= 90 else ["16n", "8n", "16n", "8n", "4n"]
    if bpm <= 72:
        return ["2n", "4n", "4n"]
    if bpm >= 112:
        return ["16n", "8n", "8n", "16n", "4n"]
    return ["8n", "8n", "4n", "4n"]


def generate_sequence(
    prompt: str,
    mood: str,
    style: str,
    bpm: int,
    instrument: str,
    key: str,
    variant_index: int,
) -> Dict[str, Any]:
    scale = scales_map().get(key, scales_map()["A minor"])
    randomizer = random.Random(make_prompt_seed(prompt, mood, style, instrument, key, str(variant_index), str(bpm)))
    durations = pick_durations(style, mood, bpm)
    note_count = 10 if style == "电影感" else 14 if style == "电子" else 12
    if bpm <= 72:
        note_count = max(8, note_count - 2)
    elif bpm >= 110:
        note_count += 3

    sequence = []
    current_index = len(scale) // 2 - 1 + randomizer.randint(0, 1)
    current_beat = 0.0

    for idx in range(note_count):
        jump = 2 if randomizer.random() < 0.22 else 1
        direction = 1 if randomizer.random() > 0.48 else -1
        current_index += direction * jump
        current_index = max(0, min(len(scale) - 1, current_index))

        if style == "电影感" and idx % 4 == 3:
            current_index = min(len(scale) - 1, current_index + 1)
        if style == "K-Ballad" and idx % 4 == 2:
            current_index = max(1, current_index - 1)

        duration = durations[idx % len(durations)]
        beat_length = parse_duration_beats(duration)
        note_name = scale[current_index]
        sequence.append(
            {
                "note": note_name,
                "midi": pitch_to_midi(note_name),
                "duration": duration,
                "durationBeats": beat_length,
                "startBeat": round(current_beat, 2),
                "velocity": round(0.62 + randomizer.random() * 0.2, 2),
            }
        )
        current_beat += beat_length

    chords = [
        {"chord": chord, "startBeat": idx * 2, "duration": "2n"}
        for idx, chord in enumerate(chord_map().get(key, chord_map()["A minor"]))
    ]
    return {"sequences": sequence, "chords": chords}


def build_variants(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    prompt = payload.get("prompt", "")
    mood = payload.get("mood", "韩系抒情")
    style = payload.get("style", "K-Ballad")
    bpm = int(payload.get("bpm", 74))
    instrument = payload.get("instrument", "Soft EP")
    key = payload.get("key", "A minor")
    duration = payload.get("duration", "16小节")

    if style == "K-Ballad" or mood == "韩系抒情":
        ideas = [
            ("Seoul Night Playground", "韩系抒情主歌感", "更像韩剧 OST 的温柔主歌，钢琴起手很舒服。"),
            ("Soft Carousel Heart", "更适合副歌", "旋律更抓耳，带一点甜和失落交织的感觉。"),
            ("Midnight Han River", "夜晚氛围更强", "更适合做过门或情绪铺垫段落。"),
        ]
        hints = [
            "AI 建议：适合温柔男声 Ballad。",
            "AI 建议：副歌可抬高一个八度。",
            "AI 建议：加一点 Bell 会更梦幻。",
        ]
    else:
        ideas = [
            ("Moonlit Tide", "更贴近氛围感", "旋律起伏柔和，适合做主歌或片头段落。"),
            ("Soft Blue Echo", "更适合副歌", "记忆点更强，情绪推进更明显。"),
            ("Glass Rain Theme", "节奏更轻盈", "律动更自然，适合继续扩写成完整片段。"),
        ]
        hints = [
            "AI 建议：继续往副歌方向扩写。",
            "AI 建议：降低 8 BPM 会更沉一点。",
            "AI 建议：加入弦乐更有层次。",
        ]

    variants = []
    for idx, (title, tag, desc) in enumerate(ideas):
        next_bpm = max(60, min(150, bpm + (idx - 1) * 6))
        variants.append(
            {
                "id": f"{uuid.uuid4()}",
                "title": title,
                "tag": tag,
                "desc": desc,
                "bars": 16 if duration == "16小节" else 8,
                "bpm": next_bpm,
                "style": style,
                "mood": mood,
                "instrument": instrument,
                "key": key,
                "confidence": 82 + idx * 4,
                "aiHint": hints[idx],
                "melody": generate_sequence(prompt, mood, style, next_bpm, instrument, key, idx),
                "sourceMode": "生成",
            }
        )
    return variants


def continue_variant(variant: Dict[str, Any]) -> Dict[str, Any]:
    extra = generate_sequence(
        f"{variant['title']} continuation",
        variant["mood"],
        variant["style"],
        int(variant["bpm"]),
        variant["instrument"],
        variant["key"],
        7,
    )
    base_notes = variant["melody"]["sequences"]
    last_beat = base_notes[-1]["startBeat"] + base_notes[-1]["durationBeats"] if base_notes else 0.0
    appended = []
    for item in extra["sequences"][: max(6, int(len(extra["sequences"]) * 0.8))]:
        appended.append({**item, "startBeat": round(item["startBeat"] + last_beat, 2)})

    base_chords = variant["melody"]["chords"]
    last_chord = base_chords[-1]["startBeat"] + 2 if base_chords else 0
    next_chords = [{**item, "startBeat": item["startBeat"] + last_chord} for item in extra["chords"]]
    return {
        **variant,
        "id": str(uuid.uuid4()),
        "title": f"{variant['title']} · 续写版",
        "tag": "已续写",
        "desc": f"{variant['desc']} AI 已基于当前动机继续扩展后半段。",
        "bars": int(variant["bars"]) + 8,
        "confidence": min(98, int(variant["confidence"]) + 2),
        "aiHint": "AI 已完成续写：后半段做了情绪承接，可继续做副歌或桥段。",
        "melody": {"sequences": [*base_notes, *appended], "chords": [*base_chords, *next_chords]},
        "sourceMode": "续写",
    }


def rearrange_variant(variant: Dict[str, Any]) -> Dict[str, Any]:
    style_plan = {
        "K-Ballad": {"style": "电影感", "instrument": "钢琴", "bpmOffset": 8, "label": "电影感改编"},
        "电影感": {"style": "Lo-fi", "instrument": "Bell", "bpmOffset": -10, "label": "Lo-fi改编"},
        "Lo-fi": {"style": "流行", "instrument": "Soft EP", "bpmOffset": 6, "label": "流行改编"},
    }.get(variant["style"], {"style": "K-Ballad", "instrument": "Soft EP", "bpmOffset": -6, "label": "韩系改编"})

    next_mood = "浪漫" if variant["mood"] == "韩系抒情" else variant["mood"]
    next_bpm = max(60, min(150, int(variant["bpm"]) + style_plan["bpmOffset"]))
    return {
        **variant,
        "id": str(uuid.uuid4()),
        "title": f"{variant['title']} · 改编版",
        "tag": style_plan["label"],
        "desc": f"AI 已基于当前版本完成改编，整体风格改成更偏 {style_plan['style']} 的表达。",
        "bpm": next_bpm,
        "style": style_plan["style"],
        "instrument": style_plan["instrument"],
        "mood": next_mood,
        "aiHint": "AI 已完成改编：保留原本动机，但重新组织了节奏、音色和风格走向。",
        "melody": generate_sequence(
            f"{variant['title']} rearranged {style_plan['style']}",
            next_mood,
            style_plan["style"],
            next_bpm,
            style_plan["instrument"],
            variant["key"],
            9,
        ),
        "sourceMode": "改编",
    }


def chord_suggestion(variant: Dict[str, Any]) -> Dict[str, Any]:
    progression_map = {
        "A minor": ["Am", "F", "C", "G"],
        "C major": ["C", "G", "Am", "F"],
        "D minor": ["Dm", "Bb", "F", "C"],
        "G major": ["G", "D", "Em", "C"],
    }
    progression = progression_map.get(variant["key"], ["Am", "F", "C", "G"])
    return {
        **variant,
        "aiHint": f"AI 已补全和弦：当前建议走向为 {' - '.join(progression)}。",
        "progression": progression,
        "sourceMode": "配和弦",
    }


def restyle_variant(variant: Dict[str, Any], next_style: str) -> Dict[str, Any]:
    next_instrument = {
        "流行": "Soft EP",
        "电影感": "钢琴",
        "Lo-fi": "Bell",
        "电子": "Synth",
        "古典": "钢琴",
        "抒情钢琴": "钢琴",
        "K-Ballad": "Soft EP",
    }.get(next_style, variant["instrument"])
    return {
        **variant,
        "id": str(uuid.uuid4()),
        "title": f"{variant['title']} · {next_style}版",
        "tag": f"{next_style}换风格",
        "style": next_style,
        "instrument": next_instrument,
        "desc": f"已将当前版本切换为 {next_style} 方向，并重算了旋律组织方式。",
        "aiHint": f"AI 已换风格：当前更偏 {next_style} 的节奏与音色表达。",
        "melody": generate_sequence(
            f"{variant['title']} restyle {next_style}",
            variant["mood"],
            next_style,
            int(variant["bpm"]),
            next_instrument,
            variant["key"],
            11,
        ),
        "sourceMode": "换风格",
    }


@app.get("/")
def index():
    if (DIST_DIR / "index.html").exists():
        return FileResponse(DIST_DIR / "index.html")
    return FileResponse(PROJECT_ROOT / "index.html")


@app.get("/{full_path:path}")
def spa_fallback(full_path: str):
    requested = PROJECT_ROOT / full_path
    if requested.exists() and requested.is_file():
        return FileResponse(requested)
    if (DIST_DIR / "index.html").exists():
        return FileResponse(DIST_DIR / "index.html")
    raise HTTPException(status_code=404, detail="Not found")


@app.post("/api/register")
async def register(request: Request):
    payload = await request.json()
    email = payload.get("email")
    password = payload.get("password")
    if not email or not password or len(password) < 6:
        raise HTTPException(status_code=400, detail="Invalid input")
    data = load_data()
    if any(u["email"] == email for u in data["users"]):
        raise HTTPException(status_code=409, detail="Email exists")
    salt = secrets.token_hex(8)
    user = {
        "id": str(uuid.uuid4()),
        "email": email,
        "salt": salt,
        "passwordHash": hash_password(password, salt),
    }
    data["users"].append(user)
    session_id = str(uuid.uuid4())
    data.setdefault("sessions", {})[session_id] = user["id"]
    save_data(data)
    response = JSONResponse({"ok": True})
    response.set_cookie(SESSION_COOKIE, session_id, httponly=True, samesite="lax")
    return response


@app.post("/api/login")
async def login(request: Request):
    payload = await request.json()
    email = payload.get("email")
    password = payload.get("password")
    if not email or not password:
        raise HTTPException(status_code=400, detail="Invalid input")
    data = load_data()
    user = next((u for u in data["users"] if u["email"] == email), None)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if hash_password(password, user["salt"]) != user["passwordHash"]:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    session_id = str(uuid.uuid4())
    data.setdefault("sessions", {})[session_id] = user["id"]
    save_data(data)
    response = JSONResponse({"ok": True})
    response.set_cookie(SESSION_COOKIE, session_id, httponly=True, samesite="lax")
    return response


@app.post("/api/logout")
def logout(request: Request):
    session_id = request.cookies.get(SESSION_COOKIE)
    data = load_data()
    if session_id and session_id in data.get("sessions", {}):
        del data["sessions"][session_id]
    save_data(data)
    response = JSONResponse({"ok": True})
    response.delete_cookie(SESSION_COOKIE)
    return response


@app.get("/api/me")
def me(request: Request):
    user_id = require_user(request)
    data = load_data()
    user = next((u for u in data["users"] if u["id"] == user_id), None)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid session")
    unlocked = any(
        p["userId"] == user_id and p["songId"] == "demo-song" for p in data["purchases"]
    )
    return {"user": {"id": user["id"], "email": user["email"]}, "unlocked": unlocked}


@app.post("/api/orders")
async def create_order(request: Request):
    user_id = require_user(request)
    payload = await request.json()
    song_id = payload.get("songId")
    channel = payload.get("channel") or "wechat"
    if not song_id:
        raise HTTPException(status_code=400, detail="Missing songId")
    data = load_data()
    order = {
        "id": str(uuid.uuid4()),
        "userId": user_id,
        "songId": song_id,
        "channel": channel,
        "amount": 1200,
        "status": "PENDING",
        "createdAt": datetime.utcnow().isoformat() + "Z",
    }
    data["orders"].append(order)
    save_data(data)
    return {"id": order["id"], "status": order["status"]}


@app.post("/api/orders/{order_id}/mock-pay")
def mock_pay(order_id: str, request: Request):
    user_id = require_user(request)
    data = load_data()
    order = next((o for o in data["orders"] if o["id"] == order_id), None)
    if not order or order["userId"] != user_id:
        raise HTTPException(status_code=404, detail="Order not found")
    order["status"] = "PAID"
    if not any(p["userId"] == user_id and p["songId"] == order["songId"] for p in data["purchases"]):
        data["purchases"].append(
            {
                "id": str(uuid.uuid4()),
                "userId": user_id,
                "songId": order["songId"],
                "paidAt": datetime.utcnow().isoformat() + "Z",
                "channel": order["channel"],
            }
        )
    save_data(data)
    return {"ok": True}


@app.post("/api/pay/wechat/prepay")
def wechat_prepay(request: Request):
    require_user(request)
    return JSONResponse(
        {
            "error": "WeChat Pay not configured",
            "hint": "Set WECHAT_APPID/WECHAT_MCH_ID/WECHAT_API_KEY and implement prepay.",
        },
        status_code=501,
    )


@app.post("/api/pay/alipay/prepay")
def alipay_prepay(request: Request):
    require_user(request)
    return JSONResponse(
        {
            "error": "Alipay not configured",
            "hint": "Set ALIPAY_APP_ID/ALIPAY_PRIVATE_KEY and implement prepay.",
        },
        status_code=501,
    )


@app.post("/api/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    bpm: float = Form(120.0),
    sr: int = Form(22050),
    frame_length: int = Form(2048),
    hop_length: int = Form(256),
    min_duration: float = Form(0.1),
    fmin: float = Form(27.5),
    fmax: float = Form(4186.0),
):
    suffix = Path(audio.filename or "upload.wav").suffix or ".wav"
    job_id = str(uuid.uuid4())
    input_path = GENERATED_DIR / f"{job_id}{suffix}"
    output_path = GENERATED_DIR / f"{job_id}.musicxml"

    content = await audio.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty audio file")
    input_path.write_bytes(content)

    try:
        y, loaded_sr = librosa.load(input_path, sr=sr, mono=True)
        f0 = extract_f0(
            y=y,
            sr=loaded_sr,
            fmin=fmin,
            fmax=fmax,
            frame_length=frame_length,
            hop_length=hop_length,
        )
        events = f0_to_events(
            f0=f0,
            hop_s=hop_length / loaded_sr,
            min_duration_s=min_duration,
        )
        score = events_to_score(events, bpm=bpm, add_rests=True)
        score.write("musicxml", fp=output_path)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {exc}") from exc
    finally:
        if input_path.exists():
            input_path.unlink(missing_ok=True)

    return {
        "ok": True,
        "jobId": job_id,
        "bpm": bpm,
        "noteCount": len(events),
        "notes": [
            {
                "midi": event.midi,
                "name": librosa.midi_to_note(event.midi),
                "start": round(event.start_s, 3),
                "end": round(event.end_s, 3),
                "duration": round(event.end_s - event.start_s, 3),
            }
            for event in events
        ],
        "musicXmlUrl": f"/generated/{output_path.name}",
    }


@app.post("/api/compose/generate")
async def compose_generate(request: Request):
    payload = await request.json()
    return {"ok": True, "variants": build_variants(payload)}


@app.post("/api/compose/continue")
async def compose_continue(request: Request):
    payload = await request.json()
    variant = payload.get("variant")
    if not variant:
        raise HTTPException(status_code=400, detail="Missing variant")
    return {"ok": True, "variant": continue_variant(variant)}


@app.post("/api/compose/rearrange")
async def compose_rearrange(request: Request):
    payload = await request.json()
    variant = payload.get("variant")
    if not variant:
        raise HTTPException(status_code=400, detail="Missing variant")
    return {"ok": True, "variant": rearrange_variant(variant)}


@app.post("/api/compose/chords")
async def compose_chords(request: Request):
    payload = await request.json()
    variant = payload.get("variant")
    if not variant:
        raise HTTPException(status_code=400, detail="Missing variant")
    return {"ok": True, "variant": chord_suggestion(variant)}


@app.post("/api/compose/restyle")
async def compose_restyle(request: Request):
    payload = await request.json()
    variant = payload.get("variant")
    next_style = payload.get("nextStyle") or "电影感"
    if not variant:
        raise HTTPException(status_code=400, detail="Missing variant")
    return {"ok": True, "variant": restyle_variant(variant, next_style)}


@app.get("/api/projects")
def list_projects(request: Request):
    owner_id = get_optional_user_id(request)
    data = load_data()
    projects = [item for item in data["projects"] if item.get("ownerId") == owner_id]
    projects.sort(key=lambda item: item.get("updatedAt", ""), reverse=True)
    return {"projects": projects}


@app.post("/api/projects")
async def create_project(request: Request):
    owner_id = get_optional_user_id(request)
    payload = await request.json()
    title = (payload.get("title") or "").strip() or "未命名工程"
    project = {
        "id": str(uuid.uuid4()),
        "ownerId": owner_id,
        "title": title,
        "type": payload.get("type") or "本地工程",
        "version": payload.get("version") or "版本 1",
        "time": payload.get("time") or "刚刚",
        "summary": payload.get("summary") or "新建创作工程",
        "variantCount": int(payload.get("variantCount") or 0),
        "payload": payload.get("payload") or {},
        "createdAt": datetime.utcnow().isoformat() + "Z",
        "updatedAt": datetime.utcnow().isoformat() + "Z",
    }
    data = load_data()
    data["projects"].append(project)
    save_data(data)
    return {"ok": True, "project": project}


@app.put("/api/projects/{project_id}")
async def update_project(project_id: str, request: Request):
    owner_id = get_optional_user_id(request)
    payload = await request.json()
    data = load_data()
    project = next((item for item in data["projects"] if item["id"] == project_id and item["ownerId"] == owner_id), None)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    for key in ["title", "type", "version", "time", "summary", "variantCount", "payload"]:
        if key in payload:
            project[key] = payload[key]
    project["updatedAt"] = datetime.utcnow().isoformat() + "Z"
    save_data(data)
    return {"ok": True, "project": project}


@app.delete("/api/projects/{project_id}")
def delete_project(project_id: str, request: Request):
    owner_id = get_optional_user_id(request)
    data = load_data()
    before = len(data["projects"])
    data["projects"] = [item for item in data["projects"] if not (item["id"] == project_id and item["ownerId"] == owner_id)]
    if len(data["projects"]) == before:
        raise HTTPException(status_code=404, detail="Project not found")
    save_data(data)
    return {"ok": True}


@app.get("/api/settings")
def get_settings(request: Request):
    owner_id = get_optional_user_id(request)
    data = load_data()
    defaults = {
        "cloudSync": False,
        "quality": "高音质",
        "theme": "深色模式",
        "storageUsed": "0.4 GB",
        "displayName": "本地创作者",
    }
    settings = data["settings"].get(owner_id, defaults)
    return {"settings": settings}


@app.put("/api/settings")
async def update_settings(request: Request):
    owner_id = get_optional_user_id(request)
    payload = await request.json()
    data = load_data()
    defaults = {
        "cloudSync": False,
        "quality": "高音质",
        "theme": "深色模式",
        "storageUsed": "0.4 GB",
        "displayName": "本地创作者",
    }
    merged = {**defaults, **data["settings"].get(owner_id, {}), **payload}
    data["settings"][owner_id] = merged
    save_data(data)
    return {"ok": True, "settings": merged}
