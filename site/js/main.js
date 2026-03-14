document.addEventListener('DOMContentLoaded', () => {
  // ─── Scroll reveal ───
  const reveals = document.querySelectorAll('.reveal');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  reveals.forEach((el) => revealObserver.observe(el));

  // ─── Layer stack sequential reveal ───
  const layerStack = document.querySelector('.layer-stack');
  if (layerStack) {
    const layerObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const items = entry.target.querySelectorAll('.layer-item');
          items.forEach((item, i) => {
            setTimeout(() => item.classList.add('verified'), 400 + i * 300);
          });
          layerObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });
    layerObserver.observe(layerStack);
  }

  // ─── Counter animation ───
  const counters = document.querySelectorAll('.metric-value[data-target]');
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        counterObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach((el) => counterObserver.observe(el));

  function animateCounter(el) {
    const target = parseInt(el.dataset.target, 10);
    const suffix = el.dataset.suffix || '';
    const duration = 1200;
    const start = performance.now();

    function update(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * target);

      if (target >= 1000) {
        el.textContent = current.toLocaleString() + suffix;
      } else {
        el.textContent = current + suffix;
      }

      if (progress < 1) requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
  }

  // ─── Comparison bar animation ───
  const bars = document.querySelectorAll('.bar-fill');
  const barObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const bar = entry.target;
        const width = bar.style.width;
        bar.style.width = '0%';
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            bar.style.width = width;
          });
        });
        barObserver.unobserve(bar);
      }
    });
  }, { threshold: 0.5 });

  bars.forEach((bar) => barObserver.observe(bar));

  // ─── Copy buttons ───
  document.querySelectorAll('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const code = btn.parentElement.querySelector('code');
      if (!code) return;

      navigator.clipboard.writeText(code.textContent).then(() => {
        const original = btn.textContent;
        btn.textContent = 'Copied!';
        btn.style.background = 'var(--success)';
        btn.style.borderColor = 'var(--success)';
        setTimeout(() => {
          btn.textContent = original;
          btn.style.background = '';
          btn.style.borderColor = '';
        }, 2000);
      });
    });
  });

  // ─── Tab switching ───
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      btn.closest('.install-tabs').querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      btn.closest('.install-tabs').querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + tabId).classList.add('active');
    });
  });

  // ─── Benchmark charts ───
  loadBenchmarks();
});

async function loadBenchmarks() {
  try {
    const res = await fetch('data/benchmarks.json');
    const data = await res.json();
    const grid = document.getElementById('benchmark-grid');
    if (!grid) return;

    data.repos.forEach((repo, i) => {
      const card = document.createElement('div');
      card.className = 'benchmark-card';

      card.innerHTML = `
        <div class="benchmark-card-header">
          <h4>${repo.name}</h4>
          <span class="category-badge">${repo.category}</span>
        </div>
        <canvas id="chart-${i}"></canvas>
        <div class="benchmark-improvements">
          <div class="improvement-stat">
            <span class="pct">-${repo.improvement.tokens_pct}%</span>
            <span class="label">Tokens</span>
          </div>
          <div class="improvement-stat">
            <span class="pct">-${repo.improvement.time_pct}%</span>
            <span class="label">Time</span>
          </div>
          <div class="improvement-stat">
            <span class="pct">-${repo.improvement.backtrack_pct}%</span>
            <span class="label">Backtrack</span>
          </div>
        </div>
      `;

      grid.appendChild(card);

      const ctx = document.getElementById(`chart-${i}`).getContext('2d');
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['Tokens (k)', 'Time (s)', 'Backtrack'],
          datasets: [
            {
              label: 'Before',
              data: [
                Math.round(repo.baseline.total_tokens / 1000),
                repo.baseline.total_time,
                repo.baseline.avg_backtrack * 100
              ],
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              borderRadius: 4
            },
            {
              label: 'After',
              data: [
                Math.round(repo.after.total_tokens / 1000),
                repo.after.total_time,
                repo.after.avg_backtrack * 100
              ],
              backgroundColor: '#5e6ad2',
              borderRadius: 4
            }
          ]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            duration: 1200,
            easing: 'easeOutQuart'
          },
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: 'rgba(240,239,244,0.35)',
                font: { size: 10 },
                boxWidth: 10,
                padding: 14
              }
            }
          },
          scales: {
            x: {
              grid: { color: 'rgba(255,255,255,0.04)' },
              ticks: { color: 'rgba(240,239,244,0.35)', font: { size: 10 } }
            },
            y: {
              grid: { display: false },
              ticks: { color: 'rgba(240,239,244,0.45)', font: { size: 10 } }
            }
          }
        }
      });
    });
  } catch (e) {
    console.error('Failed to load benchmarks:', e);
  }
}
