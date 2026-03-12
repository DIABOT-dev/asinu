#!/usr/bin/env python3
import os, re

# Very broad pattern: all Supplementary Multilingual Plane emoji + misc symbols
emoji_pattern = re.compile(
    '['
    '\U0001F000-\U0001FFFF'   # All SMP emoji blocks
    '\U00002600-\U000027BF'   # Misc symbols + Dingbats
    '\U0000FE00-\U0000FE0F'   # Variation selectors
    '\U00002702-\U000027B0'   # Dingbats
    '\U00002764'              # Heart
    '\U00002705'              # Check mark
    '\U0000274C'              # Cross mark
    '\U000026A0'              # Warning
    '\U0000200D'              # ZWJ
    '\U00002B50'              # Star
    '\U000023E9-\U000023F3'   # Media controls
    '\U000025AA-\U000025FE'   # Geometric shapes
    '\U00002934-\U00002935'   # Arrows
    '\U00002B05-\U00002B07'   # Arrows
    '\U00002B1B-\U00002B1C'   # Squares
    '\U00003030\U0000303D'    # Wavy dash
    '\U00003297\U00003299'    # CJK symbols
    '\U0000231A-\U0000231B'   # Watch/hourglass
    '\U000023CF'              # Eject
    '\U000023ED-\U000023EF'   # Media
    '\U00002122'              # TM
    '\U0000203C'              # Double exclamation
    '\U00002049'              # Exclamation question
    '\U00002139'              # Info
    '\U00002194-\U000021AA'   # Arrows
    '\U000025B6\U000025C0'    # Play buttons
    '\U00002714'              # Heavy check
    '\U00002716'              # Heavy X
    '\U00002728'              # Sparkles
    '\U0000274E'              # Cross mark
    '\U00002753-\U00002755'   # Question marks
    '\U00002757'              # Exclamation
    '\U00002763'              # Heart exclamation
    '\U00002795-\U00002797'   # Plus/minus/divide    
    '\U000027A1'              # Right arrow
    '\U000027B0'              # Curly loop
    ']+', re.UNICODE
)

base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(base)
dirs = ['app', 'src']
exts = {'.tsx', '.ts', '.json'}
results = []

for d in dirs:
    for root, _, files in os.walk(d):
        for fname in sorted(files):
            _, ext = os.path.splitext(fname)
            if ext not in exts:
                continue
            fpath = os.path.join(root, fname)
            try:
                with open(fpath, 'r', encoding='utf-8') as f:
                    for i, line in enumerate(f, 1):
                        matches = emoji_pattern.findall(line)
                        if matches:
                            emojis_found = list(set(''.join(matches)))
                            results.append((fpath, i, emojis_found, line.rstrip()))
            except Exception:
                pass

for fpath, lineno, emojis, line in results:
    emoji_str = ' '.join(emojis)
    print(f'{fpath}:{lineno}: emojis=[{emoji_str}] | {line[:250]}')

print(f'\nTotal: {len(results)} lines with emojis found across {len(set(r[0] for r in results))} files')

# ALSO: search for any non-ASCII character above U+2000 that might be emoji-like
import re as re2
high_unicode = re2.compile(r'[^\x00-\u1FFF]')
print('\n--- Additional: All chars above U+2000 ---')
extra_results = []
for d in dirs:
    for root, _, files in os.walk(d):
        for fname in sorted(files):
            _, ext = os.path.splitext(fname)
            if ext not in exts:
                continue
            fpath = os.path.join(root, fname)
            try:
                with open(fpath, 'r', encoding='utf-8') as f:
                    for i, line in enumerate(f, 1):
                        found = high_unicode.findall(line)
                        if found:
                            chars = sorted(set(found))
                            info = ' '.join(f'{c}(U+{ord(c):04X})' for c in chars)
                            extra_results.append((fpath, i, info, line.rstrip()))
            except Exception:
                pass

for fpath, lineno, info, line in extra_results:
    print(f'{fpath}:{lineno}: [{info}] {line[:200]}')

print(f'\nExtra total: {len(extra_results)} lines with high Unicode across {len(set(r[0] for r in extra_results))} files')
