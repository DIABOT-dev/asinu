import React, { useCallback, useRef, useState } from 'react';
import { AppModal, AppModalProps } from '../components/AppModal';

type ConfirmOpts = {
  title: string;
  message?: string;
  icon?: AppModalProps['icon'];
  iconColor?: string;
  iconBg?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
};

type ModalState = {
  visible: boolean;
  title: string;
  message?: string;
  icon?: AppModalProps['icon'];
  iconColor?: string;
  iconBg?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  hasCancel: boolean;
};

export function useModal() {
  const [state, setState] = useState<ModalState>({
    visible: false,
    title: '',
    hasCancel: false,
  });
  const onConfirmRef = useRef<() => void>(() => {});
  const onCancelRef = useRef<(() => void) | undefined>(undefined);

  const hide = useCallback(() => {
    setState(s => ({ ...s, visible: false }));
  }, []);

  const showInfo = useCallback((title: string, message?: string) => {
    onConfirmRef.current = hide;
    onCancelRef.current = undefined;
    setState({ visible: true, title, message, hasCancel: false });
  }, [hide]);

  const showConfirm = useCallback((opts: ConfirmOpts) => {
    onConfirmRef.current = () => { hide(); opts.onConfirm(); };
    onCancelRef.current = () => { hide(); opts.onCancel?.(); };
    setState({
      visible: true,
      title: opts.title,
      message: opts.message,
      icon: opts.icon,
      iconColor: opts.iconColor,
      iconBg: opts.iconBg,
      confirmLabel: opts.confirmLabel,
      cancelLabel: opts.cancelLabel,
      destructive: opts.destructive,
      hasCancel: true,
    });
  }, [hide]);

  const modal = (
    <AppModal
      visible={state.visible}
      title={state.title}
      message={state.message}
      icon={state.icon}
      iconColor={state.iconColor}
      iconBg={state.iconBg}
      confirmLabel={state.confirmLabel}
      cancelLabel={state.cancelLabel}
      destructive={state.destructive}
      onConfirm={() => onConfirmRef.current()}
      onCancel={state.hasCancel ? () => onCancelRef.current?.() : undefined}
    />
  );

  return { showInfo, showConfirm, hide, modal };
}
