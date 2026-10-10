"""VOICEVOX エンジン（http://127.0.0.1:50021）で読み上げ音声を作り public/voice/<声>/ に mp3 で保存する

  python3 scripts/generate_voices.py                  # ずんだもん（足りない分だけ）
  python3 scripts/generate_voices.py --voice metan    # 声を指定
  python3 scripts/generate_voices.py --voice all      # 全員ぶん
  python3 scripts/generate_voices.py --sample         # 試し聞き用に数語だけ
  python3 scripts/generate_voices.py --force          # 作り直す

クレジット表記: タイトル画面に「VOICEVOX:〇〇」を全員ぶん表示（利用規約）
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
# アプリの声ID → VOICEVOX のスタイルID（すべて「ノーマル」）
VOICES = {'zundamon': 3, 'metan': 2, 'tsumugi': 8, 'mochiko': 20, 'nurserobo': 47}
VOICE_ROOT = ROOT / 'public' / 'voice'
MANIFEST_DIR = ROOT / 'src' / 'data' / 'voices'


def post(path, params, body=None):
    url = f'{ENGINE}{path}?{urllib.parse.urlencode(params)}'
    data = json.dumps(body).encode() if body is not None else b''
    req = urllib.request.Request(url, data=data, method='POST', headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def synth(text, dest, speaker):
    q = json.loads(post('/audio_query', {'text': text, 'speaker': speaker}))
    q.update(speedScale=1.0, intonationScale=1.25, prePhonemeLength=0.05, postPhonemeLength=0.08)
    wav = post('/synthesis', {'speaker': speaker}, q)
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'wav', '-i', '-', '-ac', '1', '-ar', '24000', '-b:a', '48k', str(dest)],
                   input=wav, check=True)


def generate(voice, texts, force=False, sample=False):
    speaker = VOICES[voice]
    out = VOICE_ROOT / voice
    out.mkdir(parents=True, exist_ok=True)
    manifest_path = MANIFEST_DIR / f'{voice}.json'
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() and not sample else {}

    def job(text):
        name = hashlib.sha1(text.encode()).hexdigest()[:10] + '.mp3'
        dest = out / name
        if force or not dest.exists():
            synth(text, dest, speaker)
        return text, f'voice/{voice}/{name}'

    with ThreadPoolExecutor(4) as ex:
        for i, (text, path) in enumerate(ex.map(job, texts), 1):
            manifest[text] = path
            if i % 200 == 0 or i == len(texts):
                print(f'  [{voice}] {i}/{len(texts)}')
    if sample:
        print('試し聞き:', out)
        return
    MANIFEST_DIR.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, separators=(',', ':')))
    print(f'✅ [{voice}] {len(manifest)}件 → {manifest_path.relative_to(ROOT)}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--voice', default='zundamon', help='声ID（' + ' / '.join(VOICES) + '）または all')
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
    for voice in (VOICES if args.voice == 'all' else [args.voice]):
        generate(voice, texts, args.force, args.sample)


if __name__ == '__main__':
    main()
