"""wordlist.txt と イラスト(public/illust/*.svg, public/images/*.webp) から src/data/questions.json を作る"""
import json
from collections import Counter

from wordlist import ROOT, load_words

# 先にあるものを優先（Claudeが描いたSVG → 外部生成のWebP）
IMAGE_DIRS = [(ROOT / "public" / "illust", "svg"), (ROOT / "public" / "images", "webp")]
OUT = ROOT / "src" / "data" / "questions.json"


def main():
    words, categories = load_words()
    questions = []
    for w in words:
        q = {"id": w["id"], "a": w["answer"], "c": w["category"], "l": w["level"]}
        for d, ext in IMAGE_DIRS:
            if (d / f"{w['id']}.{ext}").exists():
                q["img"] = f"{d.name}/{w['id']}.{ext}"
                break
        if w["emoji"]:
            q["e"] = w["emoji"]
        questions.append(q)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"categories": categories, "questions": questions},
                              ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    levels = Counter(q["l"] for q in questions)
    with_img = sum("img" in q for q in questions)
    playable = sum("img" in q or "e" in q for q in questions)
    print(f"✅ {len(questions)}問 (レベル1:{levels[1]} / 2:{levels[2]} / 3:{levels[3]})")
    print(f"   画像あり {with_img}問 / あそべる(画像or絵文字) {playable}問 → {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
