"""data/wordlist.txt の読み込み（build_questions.py / generate_images.py 共通）"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORDLIST = ROOT / "data" / "wordlist.txt"


def slugify(en: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", en.lower()).strip("-")


def load_words():
    """[{id, answer, en, level, emoji, category}] と [{name, icon}] を返す"""
    words, categories = [], []
    seen_answers, seen_ids = {}, set()
    category = None
    for lineno, raw in enumerate(WORDLIST.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.strip()
        if not line or (line.startswith("#") and not line.startswith("##")):
            continue
        if line.startswith("##"):
            name, _, icon = line[2:].partition("|")
            category = name.strip()
            if all(c["name"] != category for c in categories):
                categories.append({"name": category, "icon": icon.strip()})
            continue
        parts = [p.strip() for p in line.split("|")]
        if len(parts) < 3:
            raise SystemExit(f"wordlist.txt:{lineno}: 列が足りません: {raw}")
        answer, en, level = parts[0], parts[1], int(parts[2])
        emoji = parts[3] if len(parts) > 3 else ""
        if answer in seen_answers:
            print(f"⚠️  重複: {answer} (行{seen_answers[answer]} と 行{lineno}) → 後者をスキップ")
            continue
        seen_answers[answer] = lineno
        wid = slugify(en)
        base, n = wid, 2
        while wid in seen_ids:
            wid, n = f"{base}-{n}", n + 1
        seen_ids.add(wid)
        words.append({"id": wid, "answer": answer, "en": en, "level": level,
                      "emoji": emoji, "category": category})
    return words, categories
