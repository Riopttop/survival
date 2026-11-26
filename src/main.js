import './ui/style.css';
import { World } from './engine/world.js';
import { loadAll } from './engine/assets.js';
import { Game } from './game/game.js';
import { UI } from './ui/ui.js';

const canvas = document.getElementById('view');

async function boot() {
  await Promise.all([loadAll(), document.fonts?.load('16px Galmuri11').catch(() => {})]);
  const world = new World(canvas);
  const ui = new UI(document.getElementById('ui'), world.camera);
  const game = new Game(world, ui);

  let mode = 'menu'; // menu | play | pause
  const start = () => { game.reset(); mode = 'play'; ui.setPlaying(true); };
  ui.onRetry = start;
  ui.onPause = () => {
    if (mode !== 'play' || game.choosing || game.state.over) return;
    mode = 'pause';
    ui.showPause(() => { mode = 'play'; });
  };
  ui.ready(start);

  // Adaptive quality: if the first seconds run slow, step quality down.
  let last = performance.now(), slow = 0, sampled = 0;
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    sampled++;
    if (sampled > 30 && sampled < 600) { slow = slow * 0.95 + (dt > 0.026 ? 1 : 0) * 0.05; if (slow > 0.6) { world.lowerQuality(); slow = 0; } }

    if (mode === 'menu') {
      game.input = { x: 0, y: 0 };
      game.update(dt, false);
    } else {
      game.input = ui.moveInput();
      game.update(mode === 'play' ? dt : 0, mode === 'play');
    }
    ui.update(game);
    world.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.__game = game; // debugging/tests
}

boot();
