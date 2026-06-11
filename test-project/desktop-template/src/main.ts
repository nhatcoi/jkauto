import { invoke } from '@tauri-apps/api/core';

window.addEventListener('DOMContentLoaded', () => {
  const greetBtn = document.querySelector('#btn-desktop-greet');
  const greetMsg = document.querySelector('#desktop-greet-msg');

  if (greetBtn && greetMsg) {
    greetBtn.addEventListener('click', async () => {
      try {
        const response = await invoke<string>('greet', { name: 'Automation Studio' });
        greetMsg.textContent = response;
      } catch (err) {
        console.error(err);
        greetMsg.textContent = 'Greet command simulated';
      }
    });
  }
});
