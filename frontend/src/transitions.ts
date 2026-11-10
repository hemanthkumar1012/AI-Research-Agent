/* ── Animated Transitions System ───────────────────────── */
/* Smooth page transitions, panel morphing, and micro-        */
/* animations for all interactive elements                    */

export function fadeIn(el: HTMLElement, duration: number = 300): Promise<void> {
  return new Promise(resolve => {
    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";
    el.style.transition = `opacity ${duration}ms ease, transform ${duration}ms ease`;
    el.offsetHeight; // force reflow
    el.style.opacity = "1";
    el.style.transform = "translateY(0)";
    setTimeout(resolve, duration);
  });
}

export function fadeOut(el: HTMLElement, duration: number = 200): Promise<void> {
  return new Promise(resolve => {
    el.style.transition = `opacity ${duration}ms ease, transform ${duration}ms ease`;
    el.style.opacity = "0";
    el.style.transform = "translateY(-4px)";
    setTimeout(resolve, duration);
  });
}

export function slideIn(el: HTMLElement, direction: "left" | "right" | "up" | "down" = "left", duration: number = 300): Promise<void> {
  const transforms: Record<string, string> = {
    left: "translateX(-20px)",
    right: "translateX(20px)",
    up: "translateY(-20px)",
    down: "translateY(20px)"
  };
  return new Promise(resolve => {
    el.style.opacity = "0";
    el.style.transform = transforms[direction];
    el.style.transition = `opacity ${duration}ms ease, transform ${duration}ms cubic-bezier(0.22,1,0.36,1)`;
    el.offsetHeight;
    el.style.opacity = "1";
    el.style.transform = "translate(0,0)";
    setTimeout(resolve, duration);
  });
}

export function scaleIn(el: HTMLElement, duration: number = 250): Promise<void> {
  return new Promise(resolve => {
    el.style.opacity = "0";
    el.style.transform = "scale(0.92)";
    el.style.transition = `opacity ${duration}ms ease, transform ${duration}ms cubic-bezier(0.34,1.56,0.64,1)`;
    el.offsetHeight;
    el.style.opacity = "1";
    el.style.transform = "scale(1)";
    setTimeout(resolve, duration);
  });
}

export function morphPanel(from: HTMLElement, to: HTMLElement, duration: number = 350): Promise<void> {
  return new Promise(resolve => {
    const fromRect = from.getBoundingClientRect();
    from.style.transition = `opacity ${duration / 2}ms ease, transform ${duration / 2}ms ease`;
    from.style.opacity = "0";
    from.style.transform = "scale(0.96)";

    setTimeout(() => {
      from.style.display = "none";
      to.style.display = "";
      to.style.opacity = "0";
      to.style.transform = "scale(1.02)";
      to.style.transition = `opacity ${duration / 2}ms ease, transform ${duration / 2}ms ease`;
      to.offsetHeight;
      to.style.opacity = "1";
      to.style.transform = "scale(1)";
      setTimeout(resolve, duration / 2);
    }, duration / 2);
  });
}

export function staggerChildren(parent: HTMLElement, selector: string, delay: number = 50): void {
  const children = parent.querySelectorAll(selector);
  children.forEach((child, i) => {
    const el = child as HTMLElement;
    el.style.opacity = "0";
    el.style.transform = "translateY(10px)";
    el.style.transition = `opacity 300ms ease ${i * delay}ms, transform 300ms ease ${i * delay}ms`;
    requestAnimationFrame(() => {
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    });
  });
}

export function pulseElement(el: HTMLElement): void {
  el.style.transition = "transform 150ms ease";
  el.style.transform = "scale(1.05)";
  setTimeout(() => {
    el.style.transform = "scale(1)";
  }, 150);
}

export function shakeElement(el: HTMLElement): void {
  el.style.animation = "none";
  el.offsetHeight;
  el.style.animation = "shake 0.4s ease";
  setTimeout(() => { el.style.animation = ""; }, 400);
}

// CSS keyframes injected once
let injected = false;
export function injectTransitionStyles(): void {
  if (injected) return;
  injected = true;
  const style = document.createElement("style");
  style.textContent = `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20% { transform: translateX(-4px); }
      40% { transform: translateX(4px); }
      60% { transform: translateX(-2px); }
      80% { transform: translateX(2px); }
    }
    @keyframes ripple {
      to { transform: scale(2); opacity: 0; }
    }
    .ripple-effect {
      position: absolute;
      border-radius: 50%;
      background: var(--accent);
      opacity: 0.3;
      pointer-events: none;
      animation: ripple 0.5s ease-out forwards;
    }
  `;
  document.head.appendChild(style);
}

export function addRipple(el: HTMLElement, event: MouseEvent): void {
  const rect = el.getBoundingClientRect();
  const ripple = document.createElement("span");
  ripple.className = "ripple-effect";
  const size = Math.max(rect.width, rect.height);
  ripple.style.width = ripple.style.height = size + "px";
  ripple.style.left = (event.clientX - rect.left - size / 2) + "px";
  ripple.style.top = (event.clientY - rect.top - size / 2) + "px";
  el.style.position = "relative";
  el.style.overflow = "hidden";
  el.appendChild(ripple);
  setTimeout(() => ripple.remove(), 500);
}
