// Product page preview: starts the muted looping clip on arrival (it is set up in the markup with its poster, so the
// box never moves). Under reduced motion the clip is never loaded: the poster frame stays. The playtest reads
// window.__previewFirstFrame (ms from navigation start to the first moving frame).
import { calmMotion } from './calm.js';

const video = document.querySelector('video[data-preview]');
if (video) {
  if (calmMotion()) {
    video.dataset.state = 'poster';
  } else {
    video.src = video.dataset.src;
    video.dataset.state = 'loading';
    const first = () => {
      window.__previewFirstFrame = Math.round(performance.now());
      video.dataset.state = 'playing';
    };
    if ('requestVideoFrameCallback' in video) {
      video.requestVideoFrameCallback((now, meta) => {
        if (meta.mediaTime > 0 || meta.presentedFrames > 1) first();
        else video.requestVideoFrameCallback(() => first());
      });
    } else {
      video.addEventListener('timeupdate', function once() {
        if (video.currentTime > 0) { video.removeEventListener('timeupdate', once); first(); }
      });
    }
    video.play().catch(() => { video.dataset.state = 'poster'; });
  }
}
