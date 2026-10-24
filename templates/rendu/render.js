// Usage : node render.js <quiz.json> <long|short> <sortie.mp4> [fps] [--stills t1,t2,...] [--safe]
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');

(async () => {
  const [quizPath, fmt, out, fpsArg, ...rest] = process.argv.slice(2);
  const fps = +fpsArg || 30;
  const stillsIdx = rest.indexOf('--stills');
  const stills = stillsIdx >= 0 ? rest[stillsIdx + 1].split(',').map(Number) : null;
  const [W, H] = fmt === 'long' ? [1920, 1080] : [1080, 1920];
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.goto('file://' + path.join(__dirname, 'template.html'));
  const quiz = JSON.parse(fs.readFileSync(quizPath, 'utf8'));
  await page.evaluate(([q, f, safe]) => { build(q, f); if (safe) document.body.classList.add('showsafe'); }, [quiz, fmt, rest.includes('--safe')]);
  const duration = await page.evaluate(() => DURATION);
  const tl = await page.evaluate(() => TL);
  const events = await page.evaluate(() => EVENTS);
  await page.evaluate(() => Promise.all(["400 10px 'Archivo Black'", "800 10px 'Bricolage Grotesque'", "500 10px 'Bricolage Grotesque'", "10px 'Permanent Marker'", "700 10px 'Space Mono'"].map(f => document.fonts.load(f))));

  if (stills) {
    for (const [k, t] of stills.entries()) {
      await page.evaluate(t => renderAt(t), t);
      await page.screenshot({ path: out.replace(/\.png$/, `-${k + 1}.png`) });
    }
    await browser.close();
    return;
  }

  fs.writeFileSync(out + '.timeline.json', JSON.stringify({ duration, tl, events }));
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium', out + '.video.mp4'], { stdio: ['pipe', 'inherit', 'inherit'] });
  const n = Math.round(duration * fps);
  for (let i = 0; i < n; i++) {
    await page.evaluate(t => renderAt(t), i / fps);
    const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
  execFileSync('python3', [path.join(__dirname, 'audio.py'), out + '.timeline.json', out + '.wav']);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', out + '.video.mp4', '-i', out + '.wav', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', out]);
  for (const f of ['.video.mp4', '.wav', '.timeline.json']) fs.unlinkSync(out + f);
  console.log('ok', out, duration + 's', n + ' images');
})();
