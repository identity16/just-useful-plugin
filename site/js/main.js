document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const code = btn.parentElement.querySelector('code');
      if (!code) return;

      navigator.clipboard.writeText(code.textContent).then(() => {
        const original = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => {
          btn.textContent = original;
        }, 2000);
      });
    });
  });
});
