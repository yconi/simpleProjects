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