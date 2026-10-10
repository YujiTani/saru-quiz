"""VOICEVOX エンジン（http://127.0.0.1:50021）で読み上げ音声を作り public/voice/ に mp3 で保存する

  python3 scripts/generate_voices.py            # 足りない分だけ生成
  python3 scripts/generate_voices.py --sample   # 試し聞き用に数語だけ
  python3 scripts/generate_voices.py --force    # 全部作り直す

クレジット表記: 「VOICEVOX:ずんだもん」（タイトル画面に表示）
"""
import argparse
import hashlib
import json
import subprocess
import sys
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from voice_lines import PHRASES
from wordlist import ROOT, load_words

ENGINE = 'http://127.0.0.1:50021'
SPEAKER = 3  # ずんだもん（ノーマル）
OUT = ROOT / 'public' / 'voice'
MANIFEST = ROOT / 'src' / 'data' / 'voices.json'


def post(path, params, body=None):
    url = f'{ENGINE}{path}?{urllib.parse.urlencode(params)}'
    data = json.dumps(body).encode() if body is not None else b''
    req = urllib.request.Request(url, data=data, method='POST', headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def synth(text, dest):
    q = json.loads(post('/audio_query', {'text': text, 'speaker': SPEAKER}))
    q.update(speedScale=1.0, intonationScale=1.25, prePhonemeLength=0.05, postPhonemeLength=0.08)
    wav = post('/synthesis', {'speaker': SPEAKER}, q)
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'wav', '-i', '-', '-ac', '1', '-ar', '24000', '-b:a', '48k', str(dest)],
                   input=wav, check=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--sample', action='store_true')
    ap.add_argument('--force', action='store_true')
    args = ap.parse_args()
    try:
        urllib.request.urlopen(f'{ENGINE}/version', timeout=5)
    except Exception:
        sys.exit('VOICEVOX エンジンが起動していません（http://127.0.0.1:50021）')

    words, _ = load_words()
    texts = PHRASES + [w['answer'] for w in words]
    if args.sample:
        texts = ['これ、なあに？', 'せいかい！', 'りんご', 'ぺろぺろきゃんでぃー', 'しょうぼうしゃ', 'おしい！ これは、', 'だよ']
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() and not args.sample else {}

    def job(text):
        name = hashlib.sha1(text.encode()).hexdigest()[:10] + '.mp3'
        dest = OUT / name
        if args.force or not dest.exists():
            synth(text, dest)
        return text, f'voice/{name}'

    with ThreadPoolExecutor(4) as ex:
        for i, (text, path) in enumerate(ex.map(job, texts), 1):
            manifest[text] = path
            if i % 100 == 0 or i == len(texts):
                print(f'  {i}/{len(texts)}')
    if not args.sample:
        MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, separators=(',', ':')))
        print(f'✅ {len(manifest)}件 → {MANIFEST.relative_to(ROOT)}')
    else:
        print('試し聞き:', ', '.join(str(OUT / job(t)[1].split('/')[1]) for t in texts[:3]))


if __name__ == '__main__':
    main()
