document.addEventListener('DOMContentLoaded', () => {
  // Copy buttons
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

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      // Deactivate all
      btn.closest('.install-tabs').querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      btn.closest('.install-tabs').querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      // Activate selected
      btn.classList.add('active');
      document.getElementById('tab-' + tabId).classList.add('active');
    });
  });

  // Benchmark charts
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
              backgroundColor: '#444',
              borderRadius: 3
            },
            {
              label: 'After',
              data: [
                Math.round(repo.after.total_tokens / 1000),
                repo.after.total_time,
                repo.after.avg_backtrack * 100
              ],
              backgroundColor: '#3b82f6',
              borderRadius: 3
            }
          ]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: '#888',
                font: { size: 11 },
                boxWidth: 12,
                padding: 12
              }
            }
          },
          scales: {
            x: {
              grid: { color: '#262626' },
              ticks: { color: '#888', font: { size: 10 } }
            },
            y: {
              grid: { display: false },
              ticks: { color: '#888', font: { size: 10 } }
            }
          }
        }
      });
    });
  } catch (e) {
    console.error('Failed to load benchmarks:', e);
  }
}
