testDir: 'tests',
timeout: 30000,
use: {
    browserName: 'chromium',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
},
reporter: [['list'], ['html', { output: 'test-results/report.html' }]]