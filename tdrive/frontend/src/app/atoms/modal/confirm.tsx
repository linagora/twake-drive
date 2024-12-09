import React from 'react';

import { Modal, ModalContent, ModalContentTheme } from '.';
import { Button, ButtonTheme } from 'app/atoms/button/button';

import Languages from 'features/global/services/languages-service';

export type ConfirmModalProps = {
  open: boolean;
  title: string;
  text: string;
  theme?: ModalContentTheme;
  icon?: React.ComponentType;
  skipCancelOnClose?: boolean;
  buttonOkTheme?: ButtonTheme;
  buttonOkLabel: string;
  buttonCancelLabel?: string;
  onClose: () => void;
  onCancel?: () => void;
  onOk: () => void;
};
export const ConfirmModal = (props: ConfirmModalProps) => {
  function dialogCloseHandler(confirm?: boolean) {
    return () => {
      if (confirm === true)
        props.onOk();
      else if (confirm === false || !props.skipCancelOnClose)
        props.onCancel && props.onCancel();
      props.onClose();
    };
  }
  return <>
    <Modal open={props.open} onClose={dialogCloseHandler()}>
      <ModalContent
        title={props.title}
        text={props.text}
        theme={props.theme}
        icon={props.icon}
        buttons={
          <>
            <Button
              className="ml-2"
              theme={props.buttonOkTheme || "danger"}
              onClick={dialogCloseHandler(true)}
              testClassId="confirm-modal-button-confirm"
            >
              {Languages.t(props.buttonOkLabel)}
            </Button>
            <Button
              theme='default'
              onClick={dialogCloseHandler(false)}
              testClassId="confirm-modal-button-cancel"
            >
              {Languages.t(props.buttonCancelLabel || "general.cancel")}
            </Button>
          </>
        }
      />
    </Modal>
  </>;
};