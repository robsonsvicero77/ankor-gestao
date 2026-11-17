const DESIGN_COLOR_VARIABLES = {
  brandPrimary: '--brand-primary',
  textPrimary: '--text-primary',
  textSecondary: '--text-secondary',
  border: '--border-color',
  surfaceAlt: '--surface-alt',
};

export function getDesignColors() {
  const styles = window.getComputedStyle(document.documentElement);
  return Object.fromEntries(
    Object.entries(DESIGN_COLOR_VARIABLES).map(([name, variable]) => {
      const color = styles.getPropertyValue(variable).trim();
      if (!color) {
        throw new Error(`Token de cor não configurado: ${variable}`);
      }
      return [name, color];
    })
  );
}
