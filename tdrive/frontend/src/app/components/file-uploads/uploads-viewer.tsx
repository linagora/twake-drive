import { useUpload } from '@features/files/hooks/use-upload';
import Portal from '../portal';
import PendingRootList from './pending-root-components/pending-root-list';

const UploadsViewer = (): JSX.Element => {
  const { currentTask } = useUpload();

  // Destructure and provide default values for safety
  const { roots = {}, status, parentId } = currentTask || {};
  const rootKeys = Object.keys(roots);

  // Early return for clarity
  if (rootKeys.length === 0) {
    return <></>;
  }

  return <Portal className="relative z-[11]">
    <PendingRootList roots={roots} status={status} parentId={parentId} />
  </Portal>;
};

export default UploadsViewer;
