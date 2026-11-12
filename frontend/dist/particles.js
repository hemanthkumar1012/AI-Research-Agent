/* ── Advanced Particle System ─────────────────────────── */
/* Modes: field (drift), constellation (network), vortex  */
export class ParticleField {
    canvas;
    ctx;
    particles = [];
    raf = 0;
    mouse = { x: -1000, y: -1000 };
    count = 60;
    connectDist = 140;
    mode = "field";
    time = 0;
    hueBase = 220;
    constructor(container) {
        this.canvas = document.createElement("canvas");
        this.canvas.id = "particles";
        this.canvas.style.cssText =
            "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;opacity:.35";
        container.prepend(this.canvas);
        this.ctx = this.canvas.getContext("2d");
        this.resize();
        this.spawn();
        window.addEventListener("resize", () => this.resize());
        document.addEventListener("mousemove", (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
        this.animate();
    }
    setMode(m) {
        this.mode = m;
        if (m === "constellation") {
            this.count = 40;
            this.connectDist = 200;
        }
        else if (m === "vortex") {
            this.count = 80;
            this.connectDist = 100;
        }
        else {
            this.count = 60;
            this.connectDist = 140;
        }
        this.spawn();
    }
    setHue(h) { this.hueBase = h; }
    setDensity(n) {
        this.count = Math.max(10, Math.min(200, n));
        this.spawn();
    }
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    spawn() {
        this.particles = [];
        for (let i = 0; i < this.count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 0.5 + 0.1;
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: Math.cos(angle) * speed * 0.4,
                vy: Math.sin(angle) * speed * 0.4,
                r: Math.random() * 2.5 + 0.6,
                opacity: Math.random() * 0.5 + 0.15,
                hue: this.hueBase + Math.random() * 60 - 30,
                life: 0,
                maxLife: 600 + Math.random() * 400,
                angle,
                speed,
            });
        }
    }
    animate = () => {
        const { ctx, canvas, particles, mouse } = this;
        this.time++;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const p of particles) {
            p.life++;
            // Mode-specific movement
            if (this.mode === "vortex") {
                const cx = canvas.width / 2;
                const cy = canvas.height / 2;
                const dx = p.x - cx;
                const dy = p.y - cy;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx) + 0.02;
                p.vx = Math.cos(angle) * dist * 0.003;
                p.vy = Math.sin(angle) * dist * 0.003;
                p.vx += (cx + Math.cos(angle) * dist - p.x) * 0.001;
                p.vy += (cy + Math.sin(angle) * dist - p.y) * 0.001;
            }
            else if (this.mode === "constellation") {
                // Gentle drift with slight attraction to center
                p.vx += (canvas.width / 2 - p.x) * 0.00001;
                p.vy += (canvas.height / 2 - p.y) * 0.00001;
            }
            p.x += p.vx;
            p.y += p.vy;
            // Bounds
            if (p.x < -20)
                p.x = canvas.width + 20;
            if (p.x > canvas.width + 20)
                p.x = -20;
            if (p.y < -20)
                p.y = canvas.height + 20;
            if (p.y > canvas.height + 20)
                p.y = -20;
            // Mouse repulsion
            const dx = p.x - mouse.x;
            const dy = p.y - mouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 150) {
                const force = (150 - dist) / 150;
                p.vx += (dx / dist) * force * 0.2;
                p.vy += (dy / dist) * force * 0.2;
            }
            // Damping
            p.vx *= 0.997;
            p.vy *= 0.997;
            // Fade based on life
            const lifeFade = p.life < 30 ? p.life / 30 :
                p.life > p.maxLife - 30 ? (p.maxLife - p.life) / 30 : 1;
            // Draw particle with glow
            const op = p.opacity * lifeFade;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${p.hue + this.time * 0.05}, 70%, 70%, ${op})`;
            ctx.fill();
            // Glow for larger particles
            if (p.r > 1.5) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${p.hue}, 70%, 70%, ${op * 0.1})`;
                ctx.fill();
            }
            // Respawn dead particles
            if (p.life >= p.maxLife) {
                p.x = Math.random() * canvas.width;
                p.y = Math.random() * canvas.height;
                p.life = 0;
                p.hue = this.hueBase + Math.random() * 60 - 30;
            }
        }
        // Connection lines
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < this.connectDist) {
                    const alpha = (1 - d / this.connectDist) * 0.15;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    const avgHue = (particles[i].hue + particles[j].hue) / 2;
                    ctx.strokeStyle = `hsla(${avgHue}, 60%, 65%, ${alpha})`;
                    ctx.lineWidth = this.mode === "constellation" ? 0.8 : 0.5;
                    ctx.stroke();
                }
            }
        }
        // Mouse attraction lines (constellation mode)
        if (this.mode === "constellation" && mouse.x > 0) {
            for (const p of particles) {
                const dx = p.x - mouse.x;
                const dy = p.y - mouse.y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < 200) {
                    ctx.beginPath();
                    ctx.moveTo(mouse.x, mouse.y);
                    ctx.lineTo(p.x, p.y);
                    ctx.strokeStyle = `hsla(${this.hueBase}, 80%, 75%, ${(1 - d / 200) * 0.2})`;
                    ctx.lineWidth = 0.4;
                    ctx.stroke();
                }
            }
        }
        this.raf = requestAnimationFrame(this.animate);
    };
    destroy() {
        cancelAnimationFrame(this.raf);
        this.canvas.remove();
    }
}
//# sourceMappingURL=particles.js.map