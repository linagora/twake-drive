import A from '@atoms/link';
import { Modal, ModalContent } from '@atoms/modal';
import { Base } from '@atoms/text';
import { Transition } from '@headlessui/react';
import {
  ChevronLeftIcon,
  DocumentDownloadIcon,
  FolderDownloadIcon,
} from '@heroicons/react/outline';
import { ReactNode } from 'react';
import { atom, useRecoilState } from 'recoil';
import { slideXTransition, slideXTransitionReverted } from 'src/utils/transitions';
import Languages from "features/global/services/languages-service";

export type UploadModalAtomType = {
  open: boolean;
  parent_id: string;
  type?: string;
};

export const UploadModelAtom = atom<UploadModalAtomType>({
  key: 'UploadModalAtom',
  default: {
    open: false,
    parent_id: 'root',
  },
});

export const UploadModal = ({
  selectFromDevice,
  selectFolderFromDevice,
}: {
  selectFromDevice: () => void;
  selectFolderFromDevice: () => void;
  addFromUrl: (url: string, name: string) => void;
}) => {
  const [state, setState] = useRecoilState(UploadModelAtom);

  return (
    <Modal
      open={state.open}
      onClose={() => setState({ ...state, open: false })}
      className="!max-w-sm testid:upload-modal"
    >
      <ModalContent
        title={
          <div className="flex flex-row items-center justify-start">
            {!!state.type && (
              <A onClick={() => setState({ ...state, type: '' })}>
                <ChevronLeftIcon className="w-6 h-6" />
              </A>
            )}
            <span className="ml-2">{Languages.t('components.create_modal.upload_folder_or_doc')}</span>
          </div>
        }
      >
        <div
          style={{
            display: 'grid',
            gridTemplate: '1fr / 1fr',
          }}
        >
          <Transition
            style={{
              gridColumn: '1 / 1',
              gridRow: '1 / 1',
            }}
            show={!state.type}
            as="div"
            {...(!state.type ? slideXTransitionReverted : slideXTransition)}
          >
            <div className="-m-2" >
              <CreateModalOption
                icon={<DocumentDownloadIcon className="w-5 h-5" />}
                text={Languages.t('components.create_modal.upload_files')}
                onClick={() => selectFromDevice()}
                testClassId="upload-file-from-device"
              />
              <CreateModalOption
                icon={<FolderDownloadIcon className="w-5 h-5" />}
                text={Languages.t('components.create_modal.upload_folders')}
                onClick={() => selectFolderFromDevice()}
                testClassId="upload-folder-from-device"
              />
            </div>
          </Transition>
        </div>
      </ModalContent>
    </Modal>
  );
};

const CreateModalOption = (props: { icon: ReactNode; text: string; onClick: () => void; testClassId?: string; }) => {
  return (
    <div
      onClick={props.onClick}
      className={`flex flex-row p-4 dark:bg-zinc-900 dark:text-white bg-zinc-100 hover:bg-opacity-75 cursor-pointer rounded-md m-2 testid:${props.testClassId}`}
    >
      <div className="flex items-center justify-center">{props.icon}</div>
      <div className="grow flex items-center ml-2">
        <Base>{props.text}</Base>
      </div>
    </div>
  );
};
