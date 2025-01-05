import { useState } from 'react';

import Languages from 'features/global/services/languages-service';
import { copyToClipboard } from '@features/global/utils/CopyClipboard';

import { Button } from '@atoms/button/button';
import { LinkIcon, CheckCircleIcon } from '@heroicons/react/outline';
import { ToasterService } from 'app/features/global/services/toaster-service';

export const CopyLinkButton = (props: {
  textToCopy?: string | false;
  onGetTextToCopy?: () => Promise<string>;
  labels?: {
    unavailable: string;
    ready: string;
    justCopied: string;
  };
}) => {
  const [didJustCompleteACopy, setDidJustCompleteACopy] = useState<boolean>(false);
  const [isGettingTextToCopy, setIsGettingTextToCopy] = useState<boolean>(false);
  const haveTextToCopy = props.textToCopy && props.textToCopy.length > 0 || false;
  function doCopy(text: string) {
    copyToClipboard(text);
    setIsGettingTextToCopy(false);
    if (!didJustCompleteACopy) {
      // No point enqueuing further ones, the first timeout will undo immediately anyway
      // so not bothering with useEffect either - tiny window of a tiny leak in improbable use case
      setDidJustCompleteACopy(true);
      setTimeout(() => setDidJustCompleteACopy(false), 1500);
    }
  }
  return (
    <Button
      onClick={async () => {
        if (!haveTextToCopy) {
          if (props.onGetTextToCopy) {
            setIsGettingTextToCopy(true);
            try {
              doCopy(await props.onGetTextToCopy());
            } catch (e) {
              ToasterService.error(Languages.t("scenes.error_on_tdrive"));
            } finally {
              setIsGettingTextToCopy(false);
            }

          }
          return;
        }
        doCopy(props.textToCopy as string);
      }}
      loading={isGettingTextToCopy}
      disabled={!haveTextToCopy && !props.onGetTextToCopy}
      theme={didJustCompleteACopy ? "green" : "primary"}
      className="justify-center w-64"
      testClassId="copy-link-button"
    >
      { didJustCompleteACopy
        ? <CheckCircleIcon className="w-5 mr-2" />
        : (isGettingTextToCopy || <LinkIcon className="w-5 mr-2" />)
      }
      {Languages.t(
        didJustCompleteACopy
        ? (props.labels?.justCopied ?? 'components.public-link-copied-info')
        : (haveTextToCopy
          ? (props.labels?.ready ?? "components.public-link-copy")
          : (props.labels?.unavailable ?? "components.public-link-get")))}
    </Button>
  );
}