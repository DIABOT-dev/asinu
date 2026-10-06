type Props = {
  onInteraction?: () => void;
};

/**
 * The global green plus launcher is retired on every screen. Keep the export
 * compatible with older callers, but mount no native view, modal or effects.
 * Check-in actions remain available on Home and the dedicated check-in screens.
 */
export const AsinuEmergencyFAB = (_props: Props) => null;
