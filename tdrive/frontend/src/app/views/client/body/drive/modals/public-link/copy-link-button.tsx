import { useState } from 'react';

import Languages from 'features/global/services/languages-service';
import { copyToClipboard } from '@features/global/utils/CopyClipboard';

import { Button } from '@atoms/button/button';
import { LinkIcon, CheckCircleIcon } from '@heroicons/react/outline';

export const CopyLinkButton = (props: {
  textToCopy?: string | false;
}) => {
  const [didJustCompleteACopy, setDidJustCompleteACopy] = useState<boolean>(false);
  const haveTextToCopy = props.textToCopy && props.textToCopy.length > 0 || false;
  return (
    <Button
      onClick={() => {
        if (!haveTextToCopy) return;
        copyToClipboard(props.textToCopy as string);
        if (!didJustCompleteACopy) {
          // No point enqueuing further ones, the first timeout will undo immediately anyway
          // so not bothering with useEffect either - tiny window of a tiny leak in improbable use case
          setDidJustCompleteACopy(true);
          setTimeout(() => setDidJustCompleteACopy(false), 1500);
        }
      }}
      disabled={!haveTextToCopy}
      theme={didJustCompleteACopy ? "green" : "primary"}
      className="justify-center w-64"
      testClassId="copy-link-button"
    >
      { didJustCompleteACopy
        ? <CheckCircleIcon className="w-5 mr-2" />
        : <LinkIcon className="w-5 mr-2" />
      }
      {Languages.t(
        didJustCompleteACopy
        ? 'components.public-link-copied-info'
        : (haveTextToCopy
          ? "components.public-link-copy"
          : "components.public-link-get"))}
    </Button>
  );
}