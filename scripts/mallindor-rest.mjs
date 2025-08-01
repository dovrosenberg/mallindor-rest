/**
 * Mallindor Rest Module - Main Entry Point
 * Implements Mallindor-style rest mechanics with exhaustion, partial healing, and custom dialog triggers.
 */

import { shortRest } from './short-rest.mjs';
import { relaxRest } from './relax-rest.mjs';
import { longRest } from './long-rest.mjs';
import { SocketManager } from './socket.mjs';

Hooks.once('init', async () => {
  SocketManager.init();
});

Hooks.once('ready', async () => {
  // Assign the imported functions to the game object
  game.mallindorRest = {
    shortRest,
    relaxRest,
    longRest
  };

  console.log('Mallindor Rest Module | All rest functions loaded and assigned');
});
