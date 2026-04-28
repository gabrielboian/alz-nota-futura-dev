"""Extract text, frames, and stats from V2 excalidraw and compare to V1."""
import json
from pathlib import Path

ROOT = Path("/Users/gabrielboian/Desktop/dev.nosync/t2c/alz-nota-futura")


def extract(path: Path, out_dir: Path, tag: str):
    data = json.loads(path.read_text())
    elements = data.get("elements", [])

    texts = []
    frames = []
    for el in elements:
        et = el.get("type")
        if et == "text":
            texts.append({
                "id": el.get("id"),
                "x": el.get("x"),
                "y": el.get("y"),
                "text": el.get("text", ""),
                "frameId": el.get("frameId"),
            })
        elif et == "frame":
            frames.append({
                "id": el.get("id"),
                "x": el.get("x"),
                "y": el.get("y"),
                "w": el.get("width"),
                "h": el.get("height"),
                "name": el.get("name", ""),
            })

    # Sort texts by frame, then by position
    frame_map = {f["id"]: f for f in frames}

    def fkey(t):
        f = frame_map.get(t.get("frameId"))
        fname = (f["name"] if f else "_NOFRAME") or "_UNNAMED"
        return (fname, float(t.get("y") or 0), float(t.get("x") or 0))

    texts.sort(key=fkey)

    # Texts dump grouped by frame
    lines = []
    current_frame = None
    for t in texts:
        f = frame_map.get(t.get("frameId"))
        fname = (f["name"] if f else "_NOFRAME") or "_UNNAMED"
        if fname != current_frame:
            current_frame = fname
            lines.append(f"\n\n=== FRAME: {fname} ===")
        text = t["text"].replace("\n", " | ")
        lines.append(text)

    (out_dir / f"_excalidraw_texts_{tag}.txt").write_text("\n".join(lines), encoding="utf-8")

    # Frames listing
    frame_lines = [f"{f['name']}\t(w={f['w']}, h={f['h']})" for f in sorted(frames, key=lambda x: float(x.get("y") or 0))]
    (out_dir / f"_excalidraw_frames_{tag}.txt").write_text("\n".join(frame_lines), encoding="utf-8")

    print(f"{tag}: {len(elements)} elements, {len(texts)} texts, {len(frames)} frames")
    return {"texts": texts, "frames": frames}


v1 = extract(ROOT / "v1" / "Nota Entrega Futura.excalidraw", ROOT / "v1", "v1")
v2 = extract(ROOT / "v2" / "Nota Entrega Futura.excalidraw", ROOT / "v2", "v2")

v1_frame_names = {f["name"] for f in v1["frames"]}
v2_frame_names = {f["name"] for f in v2["frames"]}
added = v2_frame_names - v1_frame_names
removed = v1_frame_names - v2_frame_names
print(f"\nAdded frames (V2 only): {sorted(added)}")
print(f"Removed frames (V1 only): {sorted(removed)}")

v1_texts = sorted(t["text"] for t in v1["texts"])
v2_texts = sorted(t["text"] for t in v2["texts"])
new_texts = set(v2_texts) - set(v1_texts)
gone_texts = set(v1_texts) - set(v2_texts)
print(f"\nNew text blocks: {len(new_texts)}  |  Removed text blocks: {len(gone_texts)}")
