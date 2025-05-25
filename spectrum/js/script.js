document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".section").forEach((section, index, sections) => {
    section.addEventListener("wheel", (e) => {
      e.preventDefault();
      const direction = e.deltaY > 0 ? 1 : -1;
      const nextIndex = Math.min(Math.max(index + direction, 0), sections.length - 1);
      sections[nextIndex].scrollIntoView({ behavior: 'smooth' });
    }, { passive: false });
  });
});

        class WaveSculptor {
            constructor() {
                this.waveCanvas = document.getElementById('waveCanvas');
                this.spectrumCanvas = document.getElementById('spectrumCanvas');
                this.ctx = this.waveCanvas.getContext('2d');
                this.spectrumCtx = this.spectrumCanvas.getContext('2d');
                this.isDragging = false;
                this.selectedPoint = -1;
                this.sampleRate = 44100;

                // Audio setup
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.oscillator = null;
                this.gainNode = this.audioContext.createGain();
                this.gainNode.connect(this.audioContext.destination);
                this.gainNode.gain.value = 0.3;

                // Analyser setup
                this.analyser = this.audioContext.createAnalyser();
                this.analyser.fftSize = 2048;
                this.gainNode.connect(this.analyser);

                // Wave points
                this.points = Array.from({length: 41}, (_, i) => ({
                    x: i * (this.waveCanvas.width / 40),
                    y: this.waveCanvas.height/2,
                    locked: i % 5 === 0 // Lock every 5th point
                }));

                this.initEventListeners();
                this.draw();
                this.createPreset('sine');
            }

            initEventListeners() {
                // Canvas interactions
                this.waveCanvas.addEventListener('mousedown', (e) => this.startDrag(e));
                this.waveCanvas.addEventListener('mousemove', (e) => this.drag(e));
                this.waveCanvas.addEventListener('mouseup', () => this.endDrag());
                this.waveCanvas.addEventListener('touchstart', (e) => this.startDrag(e.touches[0]));
                this.waveCanvas.addEventListener('touchmove', (e) => this.drag(e.touches[0]));
                this.waveCanvas.addEventListener('touchend', () => this.endDrag());

                // Controls
                document.getElementById('playToggle').addEventListener('click', () => this.togglePlay());
                document.getElementById('frequency').addEventListener('input', (e) => this.updateFrequency(e.target.value));
                document.getElementById('reset').addEventListener('click', () => this.createPreset('sine'));
                document.querySelectorAll('.presets button').forEach(btn => {
                    btn.addEventListener('click', () => this.createPreset(btn.dataset.preset));
                });
            }

            startDrag(e) {
                const rect = this.waveCanvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                this.selectedPoint = this.points.findIndex(p => 
                    !p.locked && Math.abs(x - p.x) < 15 && Math.abs(y - p.y) < 15
                );

                if (this.selectedPoint > -1) {
                    this.isDragging = true;
                    this.waveCanvas.style.cursor = 'grabbing';
                }
            }

            drag(e) {
                if (!this.isDragging) return;
                const rect = this.waveCanvas.getBoundingClientRect();
                const y = e.clientY - rect.top;
                
                this.points[this.selectedPoint].y = Math.max(50, 
                    Math.min(this.waveCanvas.height - 50, y));
                
                this.draw();
                this.updateSound();
            }

            endDrag() {
                this.isDragging = false;
                this.selectedPoint = -1;
                this.waveCanvas.style.cursor = 'default';
            }

            draw() {
                // Clear canvas
                this.ctx.clearRect(0, 0, this.waveCanvas.width, this.waveCanvas.height);
                
                // Draw grid
                this.ctx.strokeStyle = '#FFFFFF20';
                this.ctx.beginPath();
                for (let x = 0; x <= this.waveCanvas.width; x += this.waveCanvas.width/10) {
                    this.ctx.moveTo(x, 0);
                    this.ctx.lineTo(x, this.waveCanvas.height);
                }
                for (let y = 0; y <= this.waveCanvas.height; y += this.waveCanvas.height/5) {
                    this.ctx.moveTo(0, y);
                    this.ctx.lineTo(this.waveCanvas.width, y);
                }
                this.ctx.stroke();

                // Draw waveform
                this.ctx.beginPath();
                this.ctx.strokeStyle = '#6C5CE7';
                this.ctx.lineWidth = 3;
                
                this.points.forEach((p, i) => {
                    if (i === 0) this.ctx.moveTo(p.x, p.y);
                    else {
                        const prev = this.points[i-1];
                        const cp1x = prev.x + (p.x - prev.x) * 0.25;
                        const cp1y = prev.y;
                        const cp2x = prev.x + (p.x - prev.x) * 0.75;
                        const cp2y = p.y;
                        this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p.x, p.y);
                    }
                });
                this.ctx.stroke();

                // Draw control points
                this.points.forEach((p, i) => {
                    if (p.locked) return;
                    this.ctx.fillStyle = i === this.selectedPoint ? '#FF5722' : '#4CAF50';
                    this.ctx.beginPath();
                    this.ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
                    this.ctx.fill();
                });
            }

            updateSound() {
                if (!this.oscillator) return;
                
                const values = this.points.map(p => 
                    (this.waveCanvas.height/2 - p.y) / (this.waveCanvas.height/2 - 50)
                );

                const real = new Float32Array(128);
                const imag = new Float32Array(128);
                
                // Calculate Fourier series
                const N = values.length;
                for (let n = 0; n < 128; n++) {
                    real[n] = values.reduce((sum, y, t) => 
                        sum + y * Math.cos(2 * Math.PI * n * t / N), 0) / N;
                    imag[n] = values.reduce((sum, y, t) => 
                        sum + y * Math.sin(2 * Math.PI * n * t / N), 0) / N;
                }

                const wave = this.audioContext.createPeriodicWave(real, imag);
                this.oscillator.setPeriodicWave(wave);
            }

            createPreset(type) {
                const period = this.waveCanvas.width;
                const amplitude = this.waveCanvas.height/2 - 50;
                
                this.points.forEach((p, i) => {
                    if (p.locked) return;
                    const phase = (p.x / period) * Math.PI * 2;
                    
                    switch(type) {
                        case 'sine':
                            p.y = this.waveCanvas.height/2 + Math.sin(phase) * amplitude;
                            break;
                        case 'square':
                            p.y = this.waveCanvas.height/2 + (Math.sign(Math.sin(phase))) * amplitude;
                            break;
                        case 'sawtooth':
                            p.y = this.waveCanvas.height/2 + ((phase % (Math.PI*2)) / (Math.PI*2) * 2 - 1) * amplitude;
                            break;
                        case 'triangle':
                            p.y = this.waveCanvas.height/2 + (Math.abs((phase % (Math.PI*2)) - Math.PI) / Math.PI * 2 - 1) * amplitude;
                            break;
                        case 'random':
                            p.y = this.waveCanvas.height/2 + (Math.random() * 2 - 1) * amplitude;
                            break;
                    }
                });
                
                this.draw();
                this.updateSound();
            }

            togglePlay() {
                const btn = document.getElementById('playToggle');
                if (this.oscillator) {
                    this.oscillator.stop();
                    this.oscillator.disconnect();
                    this.oscillator = null;
                    btn.textContent = '▶️ Play';
                } else {
                    this.oscillator = this.audioContext.createOscillator();
                    this.updateSound();
                    this.oscillator.frequency.setValueAtTime(
                        document.getElementById('frequency').value,
                        this.audioContext.currentTime
                    );
                    this.oscillator.connect(this.gainNode);
                    this.oscillator.start();
                    btn.textContent = '⏹️ Stop';
                    this.drawSpectrum();
                }
            }

            updateFrequency(value) {
                document.getElementById('frequency').value = value;
                if (this.oscillator) {
                    this.oscillator.frequency.setValueAtTime(value, this.audioContext.currentTime);
                }
            }

            drawSpectrum() {
                if (!this.oscillator) return;
                
                const bufferLength = this.analyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);
                
                const draw = () => {
                    requestAnimationFrame(draw);
                    this.analyser.getByteFrequencyData(dataArray);
                    
                    this.spectrumCtx.fillStyle = '#1A1A2E';
                    this.spectrumCtx.fillRect(0, 0, this.spectrumCanvas.width, this.spectrumCanvas.height);
                    
                    const barWidth = (this.spectrumCanvas.width / bufferLength) * 2.5;
                    let x = 0;
                    
                    for(let i = 0; i < bufferLength; i++) {
                        const barHeight = (dataArray[i] / 255) * this.spectrumCanvas.height;
                        
                        this.spectrumCtx.fillStyle = `hsl(${i * 360 / bufferLength}, 70%, 60%)`;
                        this.spectrumCtx.fillRect(
                            x, this.spectrumCanvas.height - barHeight,
                            barWidth, barHeight
                        );
                        
                        x += barWidth + 1;
                    }
                };
                
                draw();
            }
        }

        // Initialize application
        const waveSculptor = new WaveSculptor();